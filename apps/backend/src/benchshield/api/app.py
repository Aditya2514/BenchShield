"""Authoritative FastAPI application factory and API endpoints for BenchShield.

Phase B1 Capabilities:
- Operational benchmark imports with atomic public/vault boundary persistence.
- Operational benchmark and version metadata retrieval.
- Operational paginated item listing (strictly excluding protected gold answers).
- Operational immutable evaluation policy creation and retrieval.
- Request correlation ID tracking and structured sanitized error handling.
- Health liveness and readiness endpoints.
- Phase B2: investigations, SSE progress, cancellation.
- Phase B3: verification, findings, append-only reviews, frozen reports.
- Optional B4 experiments return HTTP 501 Not Implemented.
"""

import json
from typing import Annotated
from uuid import uuid4

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.exceptions import HTTPException as StarletteHTTPException

from benchshield.api.auth import AuthenticatedActor, Permission, require_permission
from benchshield.config import Settings, get_settings
from benchshield.domain.enums import ClaimStatus, ErrorCode, ExposureType, TemporalStatus
from benchshield.domain.models.benchmarks import (
    BenchmarkRecord,
    BenchmarkVersion,
    ItemVersionListResponse,
)
from benchshield.domain.models.errors import ErrorDetail, ErrorResponse
from benchshield.domain.models.experiments import ExperimentConfig, ExperimentCreateRequest
from benchshield.domain.models.findings import (
    FindingListResponse,
    FindingView,
    VerificationRunResponse,
)
from benchshield.domain.models.intake import BenchmarkImportRequest, BenchmarkImportResponse
from benchshield.domain.models.investigations import (
    InvestigationCancelRequest,
    InvestigationCancelResponse,
    InvestigationCreateRequest,
    InvestigationStatusResponse,
)
from benchshield.domain.models.policies import (
    EvaluationPolicyCreateRequest,
    EvaluationPolicyRecord,
    EvaluationPolicyVersion,
)
from benchshield.domain.models.reports import ReportCreateRequest, ReportStatusResponse
from benchshield.domain.models.reviews import (
    ReviewCreateRequest,
    ReviewDecision,
    ReviewHistoryResponse,
)
from benchshield.persistence.database import check_database_readiness, get_db_session
from benchshield.services.audit_service import AuditService
from benchshield.services.benchmark_service import BenchmarkService
from benchshield.services.intake_service import BenchmarkIntakeService
from benchshield.services.investigation_service import InvestigationService
from benchshield.services.policy_service import PolicyService


def _raise_contract_placeholder(phase: str = "B2") -> None:
    """Helper to reject unimplemented operational endpoints while retaining valid contract schemas."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=f"Contract placeholder only. Operational endpoint implementation is deferred to {phase}+.",
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    """Production application factory."""
    cfg = settings or get_settings()

    app = FastAPI(
        title="BenchShield Exposure Audit API",
        version="0.1.0",
        description=(
            "Authoritative API contract for BenchShield benchmark exposure audits, "
            "evidence reviews, and optional controlled attacker experiments."
        ),
        responses={
            400: {"model": ErrorResponse, "description": "Validation error"},
            401: {"model": ErrorResponse, "description": "Unauthorized"},
            403: {"model": ErrorResponse, "description": "Forbidden or policy blocked"},
            404: {"model": ErrorResponse, "description": "Resource not found"},
            409: {"model": ErrorResponse, "description": "Version or idempotency conflict"},
            422: {"model": ErrorResponse, "description": "Unprocessable entity validation error"},
            500: {"model": ErrorResponse, "description": "Internal server error"},
            501: {
                "model": ErrorResponse,
                "description": "Operation deferred to subsequent implementation phase",
            },
        },
    )

    # 1. Request Correlation ID Middleware
    @app.middleware("http")
    async def correlation_id_middleware(request: Request, call_next):
        corr_id = request.headers.get("x-request-id")
        if not corr_id or len(corr_id) > 128:
            corr_id = f"req_{uuid4().hex[:16]}"
        request.state.correlation_id = corr_id
        response = await call_next(request)
        response.headers["x-request-id"] = corr_id
        return response

    # 2. Sanitized Request Validation Handler
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details: list[ErrorDetail] = []
        for err in exc.errors():
            loc = err.get("loc", ())
            clean_loc = [str(x) for x in loc if str(x) != "body"]
            field_name = ".".join(clean_loc) if clean_loc else "request"
            err_type = err.get("type", "validation_error")

            if err_type == "json_invalid":
                field_name = "body"
                sanitized_msg = "Invalid JSON payload syntax."
            else:
                err_msg = err.get("msg", "Invalid value")
                sanitized_msg = str(err_msg).split(" [type=")[0]

            details.append(
                ErrorDetail(
                    field=field_name,
                    code=f"invalid_{err_type.replace('.', '_')}",
                    message=sanitized_msg,
                )
            )

        correlation_id = getattr(request.state, "correlation_id", "req_validation")
        error_resp = ErrorResponse(
            error=ErrorCode.VALIDATION_FAILED,
            message="Request payload failed schema validation.",
            details=details,
            request_id=correlation_id,
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_resp.model_dump(mode="json"),
        )

    # 3. Standardized HTTP Exception Handler
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code_mapping = {
            status.HTTP_400_BAD_REQUEST: ErrorCode.VALIDATION_FAILED,
            status.HTTP_401_UNAUTHORIZED: ErrorCode.FORBIDDEN,
            status.HTTP_403_FORBIDDEN: ErrorCode.FORBIDDEN,
            status.HTTP_404_NOT_FOUND: ErrorCode.NOT_FOUND,
            status.HTTP_409_CONFLICT: ErrorCode.VERSION_CONFLICT,
            status.HTTP_501_NOT_IMPLEMENTED: ErrorCode.NOT_IMPLEMENTED,
        }
        error_code = code_mapping.get(exc.status_code, ErrorCode.INTERNAL_ERROR)
        correlation_id = getattr(request.state, "correlation_id", "req_error")

        error_resp = ErrorResponse(
            error=error_code,
            message=str(exc.detail),
            details=[],
            request_id=correlation_id,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=error_resp.model_dump(mode="json"),
        )

    # -----------------------------------------------------------------------
    # Health Endpoints
    # -----------------------------------------------------------------------
    @app.get("/health/live", tags=["Health"], summary="Liveness probe")
    async def health_live():
        return {"status": "alive"}

    @app.get("/health/ready", tags=["Health"], summary="Readiness probe")
    async def health_ready():
        is_ready = await check_database_readiness()
        if not is_ready:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database connectivity unavailable.",
            )
        return {"status": "ready", "database": "connected"}

    # -----------------------------------------------------------------------
    # Operational Endpoints (Phase B1)
    # -----------------------------------------------------------------------
    @app.post(
        "/api/v1/benchmarks",
        response_model=BenchmarkImportResponse,
        status_code=status.HTTP_200_OK,
        summary="Import and validate benchmark",
        description="Validate benchmark CSV/JSON items. Returns immutable version ID or row errors without echoing protected answers.",
        tags=["Benchmarks"],
    )
    async def import_benchmark(
        payload: BenchmarkImportRequest,
        request: Request,
        actor: AuthenticatedActor = Depends(require_permission(Permission.IMPORT_BENCHMARK)),
        idempotency_key: Annotated[
            str | None,
            Header(alias="Idempotency-Key", description="Optional client idempotency key"),
        ] = None,
        db: AsyncSession = Depends(get_db_session),
    ):
        service = BenchmarkService(db, settings=cfg)
        correlation_id = getattr(request.state, "correlation_id", "req_anon")
        return await service.import_benchmark(
            payload,
            actor=actor,
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
        )

    @app.post(
        "/api/v1/benchmarks/upload",
        response_model=BenchmarkImportResponse,
        status_code=status.HTTP_200_OK,
        summary="Upload benchmark file (CSV or JSON)",
        description="Upload and validate a benchmark CSV or JSON file. Returns immutable version ID or row errors without retaining files or echoing protected answers.",
        tags=["Benchmarks"],
    )
    async def upload_benchmark_file(
        name: Annotated[str, Form(description="Benchmark name")],
        file: UploadFile = File(description="CSV or JSON benchmark file"),
        request: Request = None,
        actor: AuthenticatedActor = Depends(require_permission(Permission.IMPORT_BENCHMARK)),
        idempotency_key: Annotated[
            str | None,
            Header(alias="Idempotency-Key", description="Optional client idempotency key"),
        ] = None,
        db: AsyncSession = Depends(get_db_session),
    ):
        service = BenchmarkService(db, settings=cfg)
        correlation_id = (
            getattr(request.state, "correlation_id", "req_anon") if request else "req_anon"
        )

        # 1. Enforce max content length before unbounded memory usage
        max_bytes = 50 * 1024 * 1024
        raw_bytes = await file.read(max_bytes + 1)
        if len(raw_bytes) > max_bytes:
            await file.close()
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Uploaded file exceeds maximum limit of {max_bytes} bytes.",
            )
        await file.close()

        # 2. Parse CSV or JSON content
        filename = (file.filename or "").lower()
        content_type = (file.content_type or "").lower()
        items_raw: list[dict] = []
        if filename.endswith(".csv") or "csv" in content_type:
            try:
                items_raw = BenchmarkIntakeService.parse_csv(raw_bytes)
            except ValueError as err:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(err),
                ) from err
        else:
            try:
                parsed_json = json.loads(raw_bytes.decode("utf-8-sig"))
                if isinstance(parsed_json, list):
                    items_raw = parsed_json
                elif isinstance(parsed_json, dict) and "items" in parsed_json:
                    items_raw = parsed_json["items"]
                else:
                    raise ValueError(
                        "JSON file must contain an array of items or an object with an 'items' array."
                    )
            except Exception as err:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Malformed JSON file: {err}",
                ) from err

        return await service.import_benchmark_items(
            name=name,
            raw_items=items_raw,
            actor=actor,
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
        )

    @app.get(
        "/api/v1/benchmarks/{benchmark_id}",
        response_model=BenchmarkRecord,
        status_code=status.HTTP_200_OK,
        summary="Get benchmark metadata",
        description="Retrieve parent benchmark entity and version counts.",
        tags=["Benchmarks"],
    )
    async def get_benchmark(
        benchmark_id: str,
        actor: AuthenticatedActor = Depends(require_permission(Permission.READ_BENCHMARK)),
        db: AsyncSession = Depends(get_db_session),
    ):
        service = BenchmarkService(db, settings=cfg)
        return await service.get_benchmark(benchmark_id, actor=actor)

    @app.get(
        "/api/v1/benchmarks/versions/{version_id}",
        response_model=BenchmarkVersion,
        status_code=status.HTTP_200_OK,
        summary="Get benchmark version",
        description="Retrieve immutable benchmark version metadata.",
        tags=["Benchmarks"],
    )
    async def get_benchmark_version(
        version_id: str,
        actor: AuthenticatedActor = Depends(require_permission(Permission.READ_BENCHMARK)),
        db: AsyncSession = Depends(get_db_session),
    ):
        service = BenchmarkService(db, settings=cfg)
        return await service.get_benchmark_version(version_id, actor=actor)

    @app.get(
        "/api/v1/benchmarks/versions/{version_id}/items",
        response_model=ItemVersionListResponse,
        status_code=status.HTTP_200_OK,
        summary="List benchmark items",
        description="Paginated retrieval of public item versions (gold answers strictly excluded).",
        tags=["Benchmarks"],
    )
    async def list_benchmark_items(
        version_id: str,
        page: Annotated[int, Query(ge=1, description="Page number")] = 1,
        page_size: Annotated[int, Query(ge=1, le=500, description="Items per page")] = 50,
        actor: AuthenticatedActor = Depends(require_permission(Permission.READ_BENCHMARK)),
        db: AsyncSession = Depends(get_db_session),
    ):
        service = BenchmarkService(db, settings=cfg)
        return await service.list_items(version_id, actor=actor, page=page, page_size=page_size)

    @app.post(
        "/api/v1/policies",
        response_model=EvaluationPolicyVersion,
        status_code=status.HTTP_201_CREATED,
        summary="Create evaluation policy",
        description="Store an immutable evaluation policy version containing source and privacy boundaries.",
        tags=["Policies"],
    )
    async def create_policy(
        payload: EvaluationPolicyCreateRequest,
        request: Request,
        actor: AuthenticatedActor = Depends(require_permission(Permission.CREATE_POLICY)),
        db: AsyncSession = Depends(get_db_session),
    ):
        service = PolicyService(db, settings=cfg)
        correlation_id = getattr(request.state, "correlation_id", "req_anon")
        return await service.create_policy(payload, actor=actor, correlation_id=correlation_id)

    @app.get(
        "/api/v1/policies/{policy_id}",
        response_model=EvaluationPolicyRecord,
        status_code=status.HTTP_200_OK,
        summary="Get policy entity",
        description="Retrieve parent evaluation policy entity and latest version.",
        tags=["Policies"],
    )
    async def get_policy(
        policy_id: str,
        actor: AuthenticatedActor = Depends(require_permission(Permission.READ_POLICY)),
        db: AsyncSession = Depends(get_db_session),
    ):
        service = PolicyService(db, settings=cfg)
        return await service.get_policy(policy_id, actor=actor)

    @app.get(
        "/api/v1/policies/versions/{version_id}",
        response_model=EvaluationPolicyVersion,
        status_code=status.HTTP_200_OK,
        summary="Get policy version",
        description="Retrieve immutable evaluation policy version details.",
        tags=["Policies"],
    )
    async def get_policy_version(
        version_id: str,
        actor: AuthenticatedActor = Depends(require_permission(Permission.READ_POLICY)),
        db: AsyncSession = Depends(get_db_session),
    ):
        service = PolicyService(db, settings=cfg)
        return await service.get_policy_version(version_id, actor=actor)

    # -----------------------------------------------------------------------
    # Operational Endpoints (Phase B2)
    # -----------------------------------------------------------------------
    @app.post(
        "/api/v1/investigations",
        response_model=InvestigationStatusResponse,
        status_code=status.HTTP_202_ACCEPTED,
        summary="Launch investigation",
        description="Validate policy and budget, and launch an exposure audit investigation. Requires Idempotency-Key.",
        tags=["Investigations"],
    )
    async def launch_investigation(
        payload: InvestigationCreateRequest,
        request: Request,
        idempotency_key: Annotated[
            str, Header(alias="Idempotency-Key", description="Unique client idempotency key")
        ],
        actor: AuthenticatedActor = Depends(require_permission(Permission.LAUNCH_INVESTIGATION)),
        db: AsyncSession = Depends(get_db_session),
    ):
        service = InvestigationService(db, settings=cfg)
        correlation_id = getattr(request.state, "correlation_id", "req_anon")
        return await service.launch_investigation(
            payload,
            actor=actor,
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
        )

    @app.get(
        "/api/v1/investigations/{investigation_id}",
        response_model=InvestigationStatusResponse,
        status_code=status.HTTP_200_OK,
        summary="Get investigation status",
        description="Retrieve investigation state, item counts, partial coverage, budget consumption, and limitations.",
        tags=["Investigations"],
    )
    async def get_investigation(
        investigation_id: str,
        actor: AuthenticatedActor = Depends(require_permission(Permission.READ_INVESTIGATION)),
        db: AsyncSession = Depends(get_db_session),
    ):
        service = InvestigationService(db, settings=cfg)
        return await service.get_investigation(investigation_id, actor=actor)

    @app.get(
        "/api/v1/investigations/{investigation_id}/events",
        responses={
            200: {
                "description": "Authenticated Server-Sent Events stream emitting real-time progress events.",
                "content": {
                    "text/event-stream": {
                        "schema": {
                            "type": "string",
                            "description": (
                                "Server-Sent Events progress stream. Each event is framed as:\n"
                                "id: <monotonic_event_id>\n"
                                "event: <event_type>\n"
                                "data: <SSEEventEnvelope_JSON>\n\n"
                                "Clients resume playback using the Last-Event-ID HTTP request header."
                            ),
                        }
                    }
                },
            },
            401: {"model": ErrorResponse, "description": "Unauthorized"},
            404: {"model": ErrorResponse, "description": "Investigation not found"},
            410: {
                "model": ErrorResponse,
                "description": "Cursor expired (snapshot refresh required)",
            },
        },
        summary="Stream investigation events",
        description=(
            "Authenticated text/event-stream SSE stream emitting monotonic public progress events. "
            "Event framing: 'id: <id>\\nevent: <type>\\ndata: <json>\\n\\n'. Reconnect using Last-Event-ID header."
        ),
        tags=["Investigations"],
    )
    async def get_investigation_events(
        investigation_id: str,
        last_event_id: Annotated[
            str | None, Header(alias="Last-Event-ID", description="Reconnect cursor ID")
        ] = None,
        actor: AuthenticatedActor = Depends(require_permission(Permission.READ_INVESTIGATION)),
        db: AsyncSession = Depends(get_db_session),
    ):
        service = InvestigationService(db, settings=cfg)
        # Pre-flight check to verify access and 404
        await service.get_investigation(investigation_id, actor=actor)
        return StreamingResponse(
            service.get_event_stream(investigation_id, actor=actor, last_event_id=last_event_id),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    @app.post(
        "/api/v1/investigations/{investigation_id}/cancel",
        response_model=InvestigationCancelResponse,
        status_code=status.HTTP_200_OK,
        summary="Cancel investigation",
        description="Idempotent cancellation request to signal running workers and halt new task dispatch.",
        tags=["Investigations"],
    )
    async def cancel_investigation(
        investigation_id: str,
        payload: InvestigationCancelRequest,
        request: Request,
        idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
        actor: AuthenticatedActor = Depends(require_permission(Permission.CANCEL_INVESTIGATION)),
        db: AsyncSession = Depends(get_db_session),
    ):
        service = InvestigationService(db, settings=cfg)
        correlation_id = getattr(request.state, "correlation_id", "req_anon")
        return await service.cancel_investigation(
            investigation_id,
            payload,
            actor=actor,
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
        )

    # -----------------------------------------------------------------------
    # Operational Endpoints (Phase B3): verification, findings, reviews, reports
    # -----------------------------------------------------------------------
    @app.post(
        "/api/v1/investigations/{investigation_id}/verify",
        response_model=VerificationRunResponse,
        status_code=status.HTTP_200_OK,
        summary="Verify discovered candidates",
        description=(
            "Run the trusted grader over every not-yet-verified candidate source: task identity "
            "first, then answer agreement, then temporal assessment. Idempotent."
        ),
        tags=["Findings"],
    )
    async def verify_investigation(
        investigation_id: str,
        request: Request,
        actor: AuthenticatedActor = Depends(require_permission(Permission.LAUNCH_INVESTIGATION)),
        db: AsyncSession = Depends(get_db_session),
    ):
        correlation_id = getattr(request.state, "correlation_id", "req_anon")
        return await AuditService(db, settings=cfg).verify_investigation(
            investigation_id, actor=actor, correlation_id=correlation_id
        )

    @app.get(
        "/api/v1/investigations/{investigation_id}/findings",
        response_model=FindingListResponse,
        status_code=status.HTTP_200_OK,
        summary="List investigation findings",
        description="Paginated list of findings with independent exposure, task identity, answer match, and temporal dimensions. Rejected and unresolved claims are included.",
        tags=["Findings"],
    )
    async def list_findings(
        investigation_id: str,
        page: Annotated[int, Query(ge=1, description="Page number")] = 1,
        size: Annotated[int, Query(ge=1, le=100, description="Items per page")] = 20,
        exposure_type: Annotated[
            ExposureType | None, Query(description="Filter by exposure type")
        ] = None,
        temporal_status: Annotated[
            TemporalStatus | None, Query(description="Filter by temporal status")
        ] = None,
        claim_status: Annotated[
            ClaimStatus | None, Query(description="Filter by claim status")
        ] = None,
        actor: AuthenticatedActor = Depends(require_permission(Permission.READ_INVESTIGATION)),
        db: AsyncSession = Depends(get_db_session),
    ):
        return await AuditService(db, settings=cfg).list_findings(
            investigation_id,
            actor=actor,
            page=page,
            size=size,
            exposure_type=exposure_type,
            temporal_status=temporal_status,
            claim_status=claim_status,
        )

    @app.get(
        "/api/v1/findings/{finding_id}",
        response_model=FindingView,
        status_code=status.HTTP_200_OK,
        summary="Get finding",
        tags=["Findings"],
    )
    async def get_finding(
        finding_id: str,
        actor: AuthenticatedActor = Depends(require_permission(Permission.READ_INVESTIGATION)),
        db: AsyncSession = Depends(get_db_session),
    ):
        return await AuditService(db, settings=cfg).get_finding(finding_id, actor=actor)

    @app.post(
        "/api/v1/findings/{finding_id}/reviews",
        response_model=ReviewDecision,
        status_code=status.HTTP_201_CREATED,
        summary="Submit reviewer decision",
        description="Append human review decision with expected finding version; returns 409 on version conflict.",
        tags=["Reviews"],
    )
    async def submit_review(
        finding_id: str,
        payload: ReviewCreateRequest,
        request: Request,
        actor: AuthenticatedActor = Depends(require_permission(Permission.REVIEW_FINDINGS)),
        db: AsyncSession = Depends(get_db_session),
    ):
        correlation_id = getattr(request.state, "correlation_id", "req_anon")
        return await AuditService(db, settings=cfg).submit_review(
            finding_id, payload, actor=actor, correlation_id=correlation_id
        )

    @app.get(
        "/api/v1/findings/{finding_id}/reviews",
        response_model=ReviewHistoryResponse,
        status_code=status.HTTP_200_OK,
        summary="Get review history",
        description="Append-only reviewer decision history in version order.",
        tags=["Reviews"],
    )
    async def get_review_history(
        finding_id: str,
        actor: AuthenticatedActor = Depends(require_permission(Permission.READ_INVESTIGATION)),
        db: AsyncSession = Depends(get_db_session),
    ):
        return await AuditService(db, settings=cfg).review_history(finding_id, actor=actor)

    @app.post(
        "/api/v1/investigations/{investigation_id}/experiments",
        response_model=ExperimentConfig,
        status_code=status.HTTP_202_ACCEPTED,
        summary="Launch optional controlled experiment",
        description="Create pinned optional attacker experiment after frozen discovery verification.",
        tags=["Experiments"],
    )
    async def launch_experiment(
        investigation_id: str,
        payload: ExperimentCreateRequest,
    ):
        _raise_contract_placeholder("B4")

    @app.post(
        "/api/v1/investigations/{investigation_id}/reports",
        response_model=ReportStatusResponse,
        status_code=status.HTTP_202_ACCEPTED,
        summary="Create frozen report export",
        description="Freeze findings, reviewer decisions, policy and scope into an immutable versioned report.",
        tags=["Reports"],
    )
    async def create_report(
        investigation_id: str,
        payload: ReportCreateRequest,
        request: Request,
        actor: AuthenticatedActor = Depends(require_permission(Permission.EXPORT_REPORTS)),
        db: AsyncSession = Depends(get_db_session),
    ):
        if payload.investigation_id != investigation_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Body investigation_id does not match path.",
            )
        correlation_id = getattr(request.state, "correlation_id", "req_anon")
        return await AuditService(db, settings=cfg).create_report(
            investigation_id, actor=actor, correlation_id=correlation_id
        )

    @app.get(
        "/api/v1/reports/{report_id}",
        response_model=ReportStatusResponse,
        status_code=status.HTTP_200_OK,
        summary="Get report export status",
        description="Check export generation status and retrieve authorized download reference.",
        tags=["Reports"],
    )
    async def get_report(
        report_id: str,
        actor: AuthenticatedActor = Depends(require_permission(Permission.EXPORT_REPORTS)),
        db: AsyncSession = Depends(get_db_session),
    ):
        return await AuditService(db, settings=cfg).get_report(report_id, actor=actor)

    @app.get(
        "/api/v1/reports/{report_id}/download",
        status_code=status.HTTP_200_OK,
        summary="Download frozen report",
        description="Return the frozen report JSON. Authorization is re-checked on every download.",
        tags=["Reports"],
    )
    async def download_report(
        report_id: str,
        actor: AuthenticatedActor = Depends(require_permission(Permission.EXPORT_REPORTS)),
        db: AsyncSession = Depends(get_db_session),
    ):
        return await AuditService(db, settings=cfg).download_report(report_id, actor=actor)

    return app


# Default singleton contract app for OpenAPI generation and testing
contract_app = create_app()
