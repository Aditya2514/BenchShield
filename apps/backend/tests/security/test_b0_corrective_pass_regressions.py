"""Failing regression tests for B0 defects.

Tests reproduce:
1. ItemIntake metadata leaking into public ItemVersion metadata.
2. SSEEventEnvelope accepting arbitrary dict[str, Any] and arbitrary data.
3. Changing reference answer preserving benchmark_version_id and item_version_id.
4. SSE endpoint advertising list[SSEEventEnvelope] as JSON array rather than text/event-stream.
5. Declared ErrorResponse not matching HTTPException/validation error responses.
6. Event schemas validated with jsonschema.
"""

import json
from pathlib import Path

import jsonschema
import pytest
from fastapi.testclient import TestClient

from benchshield.api.app import contract_app
from benchshield.api.auth import create_jwt_token
from benchshield.config import Settings, set_settings
from benchshield.domain.enums import ErrorCode, EventType
from benchshield.domain.models.errors import ErrorResponse
from benchshield.domain.models.events import SSEEventEnvelope
from benchshield.services.intake_service import BenchmarkIntakeService


@pytest.fixture(autouse=True)
def enable_auth_shortcuts():
    """Ensure in-memory regression tests have auth shortcuts enabled."""
    cfg = Settings(allow_insecure_auth_shortcuts=True)
    set_settings(cfg)
    yield
    set_settings(None)


client = TestClient(contract_app)


def test_defect1_intake_metadata_leak_into_public_item_version():
    """Defect 1: ItemIntake metadata with protected fields must not escape to public ItemVersion."""
    secret_value = "SECRET_GOLD_IN_METADATA_XYZ"
    raw_item = {
        "external_id": "META-LEAK-01",
        "task_type": "exact_short_answer",
        "question": "What is the secret?",
        "gold_answer": "RealAnswer",
        "metadata": {
            "gold_answer": secret_value,
            "secret_note": "Confidential internal note",
            "domain": "sci_fi",
        },
    }

    # Should reject unexpected/disallowed metadata keys or strictly exclude them from public items
    response, public_items, _ = BenchmarkIntakeService.validate_and_process([raw_item])

    if response.status == "accepted" and public_items:
        public_meta_json = json.dumps(
            public_items[0].metadata
            if isinstance(public_items[0].metadata, dict)
            else public_items[0].metadata.model_dump()
        )
        assert secret_value not in public_meta_json, (
            "Protected field in metadata leaked into public ItemVersion!"
        )
        assert "gold_answer" not in public_meta_json, (
            "Disallowed 'gold_answer' key found in public ItemVersion.metadata!"
        )
    else:
        # Or validation correctly rejected the disallowed metadata field
        assert response.status == "rejected"
        assert any(e.field == "metadata" for e in response.errors)


def test_defect2_sse_envelope_rejects_arbitrary_data_and_gold_answer():
    """Defect 2: SSEEventEnvelope must not accept arbitrary dict[str, Any] containing secret fields."""
    from pydantic import ValidationError

    secret_payload = {"gold_answer": "LEAKED_VIA_SSE", "random_untyped_junk": 12345}

    # Attempting to construct an SSE envelope with arbitrary untyped dict or secret payload must fail
    with pytest.raises(ValidationError) as exc_info:
        SSEEventEnvelope(
            event_id="evt_0001",
            investigation_id="inv_001",
            type=EventType.INVESTIGATION_STARTED,
            data=secret_payload,
        )
    assert "extra_forbidden" in str(exc_info.value) or "gold_answer" in str(exc_info.value)


def test_defect3_changing_gold_answer_must_change_version_ids():
    """Defect 3: Changing reference answer must produce a new benchmark_version_id and item binding."""
    item_a = {
        "external_id": "ITEM-V-01",
        "task_type": "exact_short_answer",
        "question": "What is the capital of Valdora?",
        "gold_answer": "AnswerAlpha",
    }
    item_b = {
        "external_id": "ITEM-V-01",
        "task_type": "exact_short_answer",
        "question": "What is the capital of Valdora?",
        "gold_answer": "AnswerBeta",
    }

    res_a, pub_a, gold_a = BenchmarkIntakeService.validate_and_process(
        [item_a], workspace_id="ws_01"
    )
    res_b, pub_b, gold_b = BenchmarkIntakeService.validate_and_process(
        [item_b], workspace_id="ws_01"
    )

    assert res_a.status == "accepted"
    assert res_b.status == "accepted"

    assert res_a.benchmark_version_id != res_b.benchmark_version_id, (
        f"Benchmark version ID must change when gold answer changes! Both got {res_a.benchmark_version_id}"
    )


def test_defect4_sse_endpoint_advertises_event_stream_not_json_array():
    """Defect 4: SSE endpoint in OpenAPI must advertise text/event-stream, not list[SSEEventEnvelope] JSON."""
    openapi = contract_app.openapi()
    events_path = openapi["paths"]["/api/v1/investigations/{investigation_id}/events"]["get"]
    responses = events_path["responses"]

    assert "200" in responses
    content = responses["200"].get("content", {})
    assert "text/event-stream" in content, (
        f"SSE endpoint should advertise 'text/event-stream', found: {list(content.keys())}"
    )
    assert (
        "application/json" not in content
        or content.get("application/json", {}).get("schema", {}).get("type") != "array"
    ), "SSE endpoint must not describe the stream as a JSON array"


def test_defect5_http_placeholder_and_validation_errors_match_error_response():
    """Defect 5: HTTP 501 and HTTP 422 error bodies must conform to ErrorResponse schema."""
    # Test 501 placeholder
    res_501 = client.get("/api/v1/investigations/inv_test_501")
    assert res_501.status_code == 501
    body_501 = res_501.json()
    # Must validate as ErrorResponse
    err_501 = ErrorResponse.model_validate(body_501)
    assert err_501.error is not None
    assert "detail" not in body_501, (
        "Error response must not use default Starlette {'detail': '...'} structure"
    )

    # Test 422 validation failure on bad payload
    secret_sentinel = "SECRET_SENTINEL_IN_BODY_123"
    token = create_jwt_token("usr_admin", "admin@benchshield.com")
    auth_headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": "ws_1"}
    res_422 = client.post(
        "/api/v1/policies",
        json={
            "workspace_id": "ws_1",
            "name": "Policy",
            "reviewer_identity": secret_sentinel,
            "evaluation_cutoff": "not-a-date",
        },
        headers=auth_headers,
    )
    assert res_422.status_code in (400, 422)
    body_422 = res_422.json()
    err_422 = ErrorResponse.model_validate(body_422)
    assert err_422.error is not None
    # Ensure raw input values are not echoed in details
    for d in err_422.details:
        assert secret_sentinel not in (d.message or "")
        assert secret_sentinel not in (d.field or "")


def test_defect6_event_schemas_full_validation_with_jsonschema():
    """Defect 6: Event schemas must be valid JSON Schemas and validate instances."""
    repo_root = Path(__file__).resolve().parents[4]
    envelope_schema_path = repo_root / "docs" / "contracts" / "events" / "sse_envelope.json"
    assert envelope_schema_path.exists()

    schema = json.loads(envelope_schema_path.read_text(encoding="utf-8"))
    # Validate schema using Draft202012Validator
    jsonschema.Draft202012Validator.check_schema(schema)


# ---------------------------------------------------------------------------
# Section A: Protect metadata and event boundaries
# ---------------------------------------------------------------------------


def test_section_a_deliberate_secret_injection_metadata():
    """Verify that synthetic secrets injected into metadata (top-level or nested) are rejected."""
    # 1. Disallowed top-level key
    secret_key = "INTERNAL_RESEARCH_KEY_999"
    bad_meta_item = {
        "external_id": "SEC-A-01",
        "task_type": "exact_short_answer",
        "question": "What is the capital?",
        "gold_answer": "ValidAnswer",
        "metadata": {
            "internal_secret": secret_key,
        },
    }
    resp, _, _ = BenchmarkIntakeService.validate_and_process([bad_meta_item])
    assert resp.status == "rejected"
    assert any(
        e.field == "metadata" and e.error_code == "disallowed_metadata_field" for e in resp.errors
    )
    dumped_errors = json.dumps([e.model_dump() for e in resp.errors])
    assert secret_key not in dumped_errors

    # 2. Allowlisted fields pass cleanly without leaking gold answer
    good_meta_item = {
        "external_id": "SEC-A-02",
        "task_type": "exact_short_answer",
        "question": "What is the capital?",
        "gold_answer": "ValidAnswer",
        "metadata": {
            "domain": "geography",
            "difficulty": "easy",
            "tags": ["capitals", "world"],
            "source_reference": "https://example.org/atlas",
            "license": "CC-BY-4.0",
        },
    }
    resp_good, public_items, gold_records = BenchmarkIntakeService.validate_and_process(
        [good_meta_item]
    )
    assert resp_good.status == "accepted"
    assert len(public_items) == 1
    assert public_items[0].metadata.domain == "geography"
    assert "ValidAnswer" not in public_items[0].model_dump_json()


def test_section_a_deliberate_secret_injection_events():
    """Verify that arbitrary payloads, extra secret fields, and mismatched types are rejected."""
    from datetime import UTC, datetime

    from pydantic import ValidationError

    from benchshield.domain.models.events import (
        InvestigationCancelledPayload,
        InvestigationStartedPayload,
    )

    # 1. Extra secret field injected into payload
    with pytest.raises(ValidationError) as exc:
        InvestigationStartedPayload(
            benchmark_version_id="bmv_123",
            total_items=10,
            secret_leak="TOP_SECRET_ANSWER_INSIDE_EVENT",  # type: ignore
        )
    assert "extra_forbidden" in str(exc.value)

    # 2. Mismatched event type and payload
    cancelled_payload = InvestigationCancelledPayload(
        cancelled_at=datetime.now(UTC),
        reason="User requested cancellation",
    )
    with pytest.raises(ValidationError) as exc:
        SSEEventEnvelope(
            event_id="evt_01",
            investigation_id="inv_01",
            type=EventType.INVESTIGATION_STARTED,  # Mismatched! Expects InvestigationStartedPayload
            data=cancelled_payload,
        )
    assert "does not match expected payload" in str(exc.value)


# ---------------------------------------------------------------------------
# Section B: Version identity, protected answer references, and tenant isolation
# ---------------------------------------------------------------------------


def test_section_b_version_identity_and_reproducibility():
    """Verify version binding behavior: unchanged, changed answers, changed questions, choices, workspaces."""
    import hashlib

    base_item = {
        "external_id": "ITEM-BIND-01",
        "task_type": "multiple_choice",
        "question": "What is the primary cooling agent?",
        "choices": [
            {"id": "A", "text": "Liquid sodium"},
            {"id": "B", "text": "Helium gas"},
        ],
        "gold_answer": "B",
    }

    # 1. Independent imports generate fresh opaque revision IDs (no deterministic answer hash)
    res1, pub1, _ = BenchmarkIntakeService.validate_and_process([base_item], workspace_id="ws_acme")
    res2, pub2, _ = BenchmarkIntakeService.validate_and_process([base_item], workspace_id="ws_acme")
    assert res1.benchmark_version_id != res2.benchmark_version_id
    assert pub1[0].answer_revision_id != pub2[0].answer_revision_id
    assert pub1[0].answer_revision_id.startswith("anr_")

    # 2. Changed answer yields different benchmark and answer revision versions
    item_diff_ans = dict(base_item)
    item_diff_ans["gold_answer"] = "A"
    res_ans, pub_ans, _ = BenchmarkIntakeService.validate_and_process(
        [item_diff_ans], workspace_id="ws_acme"
    )
    assert res_ans.benchmark_version_id != res1.benchmark_version_id
    assert pub_ans[0].answer_revision_id != pub1[0].answer_revision_id

    # 3. Changed question yields different benchmark version and item version
    item_diff_q = dict(base_item)
    item_diff_q["question"] = "What is the secondary cooling agent?"
    res_q, pub_q, _ = BenchmarkIntakeService.validate_and_process(
        [item_diff_q], workspace_id="ws_acme"
    )
    assert res_q.benchmark_version_id != res1.benchmark_version_id
    assert pub_q[0].item_version_id != pub1[0].item_version_id

    # 4. Changed choices yields different benchmark version
    item_diff_c = dict(base_item)
    item_diff_c["choices"] = [
        {"id": "A", "text": "Liquid sodium"},
        {"id": "B", "text": "Helium gas"},
        {"id": "C", "text": "Heavy water"},
    ]
    res_c, pub_c, _ = BenchmarkIntakeService.validate_and_process(
        [item_diff_c], workspace_id="ws_acme"
    )
    assert res_c.benchmark_version_id != res1.benchmark_version_id

    # 5. Different workspaces isolate version identities (no cross-workspace collision)
    res_ws, pub_ws, _ = BenchmarkIntakeService.validate_and_process(
        [base_item], workspace_id="ws_other_corp"
    )
    assert res_ws.benchmark_version_id != res1.benchmark_version_id
    assert pub_ws[0].answer_revision_id != pub1[0].answer_revision_id
    assert pub_ws[0].item_version_id != pub1[0].item_version_id

    # 6. Low-entropy answer protection: bare sha256("B") must NOT be exposed
    bare_answer_hash = hashlib.sha256(b"B").hexdigest()
    assert bare_answer_hash[:16] not in pub1[0].answer_revision_id
    assert bare_answer_hash[:16] not in res1.benchmark_version_id


# ---------------------------------------------------------------------------
# Section C: Hardened intake failures
# ---------------------------------------------------------------------------


def test_section_c_hardened_intake_failures():
    """Verify bounded and sanitized validation across all failure modes."""
    # 1. Non-object JSON rows
    res, _, _ = BenchmarkIntakeService.validate_and_process(["not a dict", 12345, None])
    assert res.status == "rejected"
    assert any(e.error_code == "invalid_row_format" for e in res.errors)

    # 2. Malformed choice JSON (must not silently discard or fallback)
    item_malformed_json_choice = {
        "external_id": "CHOICE-FAIL-01",
        "task_type": "multiple_choice",
        "question": "Question?",
        "choices": "[{'id': 'A', malformed json",
        "gold_answer": "A",
    }
    res_mj, _, _ = BenchmarkIntakeService.validate_and_process([item_malformed_json_choice])
    assert res_mj.status == "rejected"
    assert any(e.field == "choices" and e.error_code == "invalid_choices" for e in res_mj.errors)

    # 3. Duplicate choice IDs and duplicate choice texts
    item_dup_choice = {
        "external_id": "CHOICE-FAIL-02",
        "task_type": "multiple_choice",
        "question": "Question?",
        "choices": [
            {"id": "A", "text": "Option One"},
            {"id": "A", "text": "Option Two"},
        ],
        "gold_answer": "Option One",
    }
    res_dc, _, _ = BenchmarkIntakeService.validate_and_process([item_dup_choice])
    assert res_dc.status == "rejected"
    assert any(e.error_code == "duplicate_choice_id" for e in res_dc.errors)

    item_dup_text = {
        "external_id": "CHOICE-FAIL-03",
        "task_type": "multiple_choice",
        "question": "Question?",
        "choices": [
            {"id": "A", "text": "Option Same"},
            {"id": "B", "text": "Option Same"},
        ],
        "gold_answer": "A",
    }
    res_dt, _, _ = BenchmarkIntakeService.validate_and_process([item_dup_text])
    assert res_dt.status == "rejected"
    assert any(e.error_code == "duplicate_choice_text" for e in res_dt.errors)

    # 4. Overlength fields
    long_gold = "X" * 20_000
    item_long_gold = {
        "external_id": "LONG-01",
        "task_type": "exact_short_answer",
        "question": "Question?",
        "gold_answer": long_gold,
    }
    res_lg, _, _ = BenchmarkIntakeService.validate_and_process([item_long_gold])
    assert res_lg.status == "rejected"
    assert any(e.field == "gold_answer" and e.error_code == "field_too_long" for e in res_lg.errors)
    # Ensure long gold string is not echoed in errors
    dump_lg = json.dumps([e.model_dump() for e in res_lg.errors])
    assert long_gold not in dump_lg

    # 5. Empty imports
    res_empty, _, _ = BenchmarkIntakeService.validate_and_process([])
    assert res_empty.status == "rejected"
    assert any(e.error_code == "empty_import" for e in res_empty.errors)

    # 6. Invalid character encoding
    with pytest.raises(ValueError) as enc_exc:
        BenchmarkIntakeService.parse_csv(b"\xff\xfe\x00\x00")
    assert "Invalid character encoding" in str(enc_exc.value)

    # 7. Duplicate CSV headers
    csv_dup_header = "external_id,question,gold_answer,external_id\n1,Q,A,1\n"
    with pytest.raises(ValueError) as hdr_exc:
        BenchmarkIntakeService.parse_csv(csv_dup_header)
    assert "Duplicate CSV header" in str(hdr_exc.value)


# ---------------------------------------------------------------------------
# Section D: HTTP validation and error contracts
# ---------------------------------------------------------------------------


def test_section_d_http_validation_safety_and_no_sentinel_leaks():
    """Verify HTTP validation never leaks raw submitted values or sentinels."""
    # 1. Invalid payload with distinct sentinel to POST /api/v1/benchmarks
    secret_sentinel = "DISTINCT_SECRET_SENTINEL_ALPHA_999"
    token = create_jwt_token("usr_admin", "admin@benchshield.com")
    auth_headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": "ws_test"}
    res = client.post(
        "/api/v1/benchmarks",
        json={
            "workspace_id": "ws_test",
            "name": "Test Benchmark",
            "items": [
                {
                    "external_id": "1",
                    "task_type": "unsupported_task_type",  # Invalid enum value!
                    "question": "What is it?",
                    "gold_answer": secret_sentinel,
                }
            ],
        },
        headers=auth_headers,
    )
    assert res.status_code == 422
    err_body = res.json()
    err_resp = ErrorResponse.model_validate(err_body)
    assert err_resp.error == ErrorCode.VALIDATION_FAILED
    # Crucial assertion: Sentinel must NOT appear in response JSON body
    assert secret_sentinel not in res.text

    # 2. Malformed JSON with sentinel in raw body
    malformed_sentinel = "MALFORMED_JSON_SECRET_SENTINEL_777"
    raw_bad_json = f'{{"workspace_id": "{malformed_sentinel}", "broken_json": '.encode()
    malformed_headers = dict(auth_headers)
    malformed_headers["Content-Type"] = "application/json"
    res_bad_json = client.post(
        "/api/v1/benchmarks",
        content=raw_bad_json,
        headers=malformed_headers,
    )
    assert res_bad_json.status_code == 422
    err_resp_bad = ErrorResponse.model_validate(res_bad_json.json())
    assert err_resp_bad.error == ErrorCode.VALIDATION_FAILED
    assert malformed_sentinel not in res_bad_json.text


# ---------------------------------------------------------------------------
# Section E: SSE Event stream documentation and framing
# ---------------------------------------------------------------------------


def test_section_e_event_stream_documentation_and_contract():
    """Verify SSE endpoint contract documentation and 501 unimplemented response."""
    openapi = contract_app.openapi()
    events_endpoint = openapi["paths"]["/api/v1/investigations/{investigation_id}/events"]["get"]

    # Advertises text/event-stream
    content = events_endpoint["responses"]["200"]["content"]
    assert "text/event-stream" in content
    # Framing documentation present
    desc = events_endpoint["description"]
    assert "text/event-stream" in desc
    assert "Last-Event-ID" in desc
    assert "id:" in desc
    assert "event:" in desc
    assert "data:" in desc

    # Endpoint returns 501 with ErrorResponse
    res = client.get("/api/v1/investigations/inv_live_stream_test/events")
    assert res.status_code == 501
    err = ErrorResponse.model_validate(res.json())
    assert err.error == ErrorCode.NOT_IMPLEMENTED
    assert "detail" not in res.json()
