"""Minimal FastAPI contract application.

NOTICE: This application is strictly for API contract definition, OpenAPI schema generation,
and contract testing during Phase B0. Placeholder endpoints explicitly return HTTP 501 Not Implemented
and NEVER return fabricated successful results. Full service persistence and execution are deferred
to subsequent delivery phases (B1+).
"""

from typing import Annotated

from fastapi import FastAPI, Header, HTTPException, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from benchshield.domain.enums import ErrorCode, ExposureType, TemporalStatus
from benchshield.domain.models.errors import ErrorDetail, ErrorResponse
from benchshield.domain.models.experiments import ExperimentConfig, ExperimentCreateRequest
from benchshield.domain.models.findings import FindingListResponse
from benchshield.domain.models.intake import BenchmarkImportRequest, BenchmarkImportResponse
from benchshield.domain.models.investigations import (
    InvestigationCancelRequest,
    InvestigationCancelResponse,
    InvestigationCreateRequest,
    InvestigationStatusResponse,
)
from benchshield.domain.models.policies import (
    EvaluationPolicyCreateRequest,
    EvaluationPolicyVersion,
)
from benchshield.domain.models.reports import ReportCreateRequest, ReportStatusResponse
from benchshield.domain.models.reviews import ReviewCreateRequest, ReviewDecision

contract_app = FastAPI(
    title="BenchShield Exposure Audit API",
    version="0.1.0",
    description=(
        "Authoritative API contract for BenchShield benchmark exposure audits, "
        "evidence reviews, and optional controlled attacker experiments."
    ),
    responses={
        400: {"model": ErrorResponse, "description": "Validation error"},
        403: {"model": ErrorResponse, "description": "Policy blocked or forbidden"},
        404: {"model": ErrorResponse, "description": "Resource not found"},
        409: {"model": ErrorResponse, "description": "Version conflict"},
        422: {"model": ErrorResponse, "description": "Unprocessable entity validation error"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
        501: {
            "model": ErrorResponse,
            "description": "Operation deferred to subsequent implementation phase",
        },
    },
)


@contract_app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Safe request validation handler conforming to ErrorResponse contract.

    CRITICAL PRIVACY BOUNDARY: Never echoes submitted values or context dictionaries.
    """
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

    error_resp = ErrorResponse(
        error=ErrorCode.VALIDATION_FAILED,
        message="Request payload failed schema validation.",
        details=details,
        request_id=request.headers.get("x-request-id", "req_validation"),
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=error_resp.model_dump(mode="json"),
    )


@contract_app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Standardized HTTP error response handler conforming to ErrorResponse."""
    code_mapping = {
        status.HTTP_400_BAD_REQUEST: ErrorCode.VALIDATION_FAILED,
        status.HTTP_403_FORBIDDEN: ErrorCode.FORBIDDEN,
        status.HTTP_404_NOT_FOUND: ErrorCode.NOT_FOUND,
        status.HTTP_409_CONFLICT: ErrorCode.VERSION_CONFLICT,
        status.HTTP_501_NOT_IMPLEMENTED: ErrorCode.NOT_IMPLEMENTED,
    }
    error_code = code_mapping.get(exc.status_code, ErrorCode.INTERNAL_ERROR)

    error_resp = ErrorResponse(
        error=error_code,
        message=str(exc.detail),
        details=[],
        request_id=request.headers.get("x-request-id", "req_error"),
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=error_resp.model_dump(mode="json"),
    )


def _raise_contract_placeholder() -> None:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Contract placeholder only. Operational endpoint implementation is deferred to B1+.",
    )


@contract_app.post(
    "/api/v1/benchmarks",
    response_model=BenchmarkImportResponse,
    status_code=status.HTTP_200_OK,
    summary="Import and validate benchmark",
    description="Validate benchmark CSV/JSON items. Returns immutable version ID or row errors without echoing protected answers.",
    tags=["Benchmarks"],
)
async def import_benchmark(payload: BenchmarkImportRequest):
    _raise_contract_placeholder()


@contract_app.post(
    "/api/v1/policies",
    response_model=EvaluationPolicyVersion,
    status_code=status.HTTP_201_CREATED,
    summary="Create evaluation policy",
    description="Store an immutable evaluation policy version containing source and privacy boundaries.",
    tags=["Policies"],
)
async def create_policy(payload: EvaluationPolicyCreateRequest):
    _raise_contract_placeholder()


@contract_app.post(
    "/api/v1/investigations",
    response_model=InvestigationStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Launch investigation",
    description="Validate policy and budget, and launch an exposure audit investigation. Requires Idempotency-Key.",
    tags=["Investigations"],
)
async def launch_investigation(
    payload: InvestigationCreateRequest,
    idempotency_key: Annotated[
        str, Header(alias="Idempotency-Key", description="Unique client idempotency key")
    ],
):
    _raise_contract_placeholder()


@contract_app.get(
    "/api/v1/investigations/{investigation_id}",
    response_model=InvestigationStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get investigation status",
    description="Retrieve investigation state, item counts, partial coverage, budget consumption, and limitations.",
    tags=["Investigations"],
)
async def get_investigation(investigation_id: str):
    _raise_contract_placeholder()


@contract_app.get(
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
        410: {"model": ErrorResponse, "description": "Cursor expired (snapshot refresh required)"},
        501: {"model": ErrorResponse, "description": "Contract placeholder only (deferred to B2)"},
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
):
    _raise_contract_placeholder()


@contract_app.post(
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
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
):
    _raise_contract_placeholder()


@contract_app.get(
    "/api/v1/investigations/{investigation_id}/findings",
    response_model=FindingListResponse,
    status_code=status.HTTP_200_OK,
    summary="List investigation findings",
    description="Paginated list of findings with independent exposure, task identity, answer match, and temporal dimensions.",
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
):
    _raise_contract_placeholder()


@contract_app.post(
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
):
    _raise_contract_placeholder()


@contract_app.post(
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
    _raise_contract_placeholder()


@contract_app.post(
    "/api/v1/investigations/{investigation_id}/reports",
    response_model=ReportStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Create frozen report export",
    description="Freeze report inputs and queue an asynchronous export job.",
    tags=["Reports"],
)
async def create_report(
    investigation_id: str,
    payload: ReportCreateRequest,
):
    _raise_contract_placeholder()


@contract_app.get(
    "/api/v1/reports/{report_id}",
    response_model=ReportStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get report export status",
    description="Check export generation status and retrieve authorized download reference.",
    tags=["Reports"],
)
async def get_report(report_id: str):
    _raise_contract_placeholder()
