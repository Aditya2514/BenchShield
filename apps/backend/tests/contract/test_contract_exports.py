"""Tests verifying contract exports freshness, OpenAPI compliance, and JSON Schema validity."""

import json
from pathlib import Path

import jsonschema
from fastapi.testclient import TestClient

from benchshield.api.app import contract_app
from benchshield.domain.enums import ErrorCode
from benchshield.domain.models.errors import ErrorResponse
from benchshield.domain.models.events import (
    CandidateDiscoveredEventData,
    InvestigationProgressEventData,
    SnapshotRefreshRequiredEventData,
    SSEEventEnvelope,
)

client = TestClient(contract_app)


def test_openapi_export_is_up_to_date():
    """Detect stale OpenAPI export by comparing checked-in file with app.openapi()."""
    repo_root = Path(__file__).resolve().parents[4]
    openapi_file = repo_root / "docs" / "contracts" / "openapi.json"

    assert openapi_file.exists(), (
        "docs/contracts/openapi.json does not exist. Run scripts/generate_contracts.py"
    )

    exported_schema = json.loads(openapi_file.read_text(encoding="utf-8"))
    current_schema = contract_app.openapi()

    assert exported_schema == current_schema, (
        "docs/contracts/openapi.json is stale! Run 'python scripts/generate_contracts.py' to regenerate."
    )


def test_event_schemas_full_validity_and_freshness():
    """Verify event schemas are valid JSON Schema documents and match current model definitions."""
    repo_root = Path(__file__).resolve().parents[4]
    contracts_dir = repo_root / "docs" / "contracts"
    events_dir = contracts_dir / "events"

    event_models = {
        "sse_envelope.json": SSEEventEnvelope,
        "progress_event.json": InvestigationProgressEventData,
        "candidate_discovered_event.json": CandidateDiscoveredEventData,
        "snapshot_refresh_required_event.json": SnapshotRefreshRequiredEventData,
    }

    validator = jsonschema.Draft202012Validator

    for filename, model in event_models.items():
        path = events_dir / filename
        assert path.exists(), f"Missing event schema: {path}"
        schema = json.loads(path.read_text(encoding="utf-8"))

        # 1. Full JSON Schema spec validity
        validator.check_schema(schema)

        # 2. Freshness check against current model definition
        current_model_schema = model.model_json_schema()
        assert schema == current_model_schema, (
            f"Event schema {filename} is stale! Run 'python scripts/generate_contracts.py' to regenerate."
        )

    # Validate consolidated events.json
    consolidated_file = contracts_dir / "events.json"
    assert consolidated_file.exists(), "Missing docs/contracts/events.json"
    consolidated = json.loads(consolidated_file.read_text(encoding="utf-8"))
    for expected_key in [
        "sse_envelope",
        "progress_event",
        "candidate_discovered_event",
        "snapshot_refresh_required_event",
    ]:
        assert expected_key in consolidated
        validator.check_schema(consolidated[expected_key])


def test_fixtures_manifest_structure_and_validity():
    """Verify that all synthetic fixtures in manifest.json have valid structure, IDs, and partition labels."""
    repo_root = Path(__file__).resolve().parents[4]
    manifest_path = repo_root / "fixtures" / "manifest.json"
    assert manifest_path.exists(), "Missing fixtures/manifest.json"

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert "fixtures" in manifest
    assert len(manifest["fixtures"]) >= 19

    case_ids = set()
    for fix in manifest["fixtures"]:
        case_id = fix.get("case_id")
        assert case_id, "Fixture entry missing case_id"
        assert case_id not in case_ids, f"Duplicate fixture case_id: {case_id}"
        case_ids.add(case_id)

        assert fix.get("partition") in ("development", "held_out")
        assert "expected_outcome" in fix
        assert "label_rationale" in fix
        assert "input" in fix


def test_contract_app_placeholder_endpoints_return_501_error_response():
    """Verify that contract-only app returns 501 matching declared ErrorResponse."""
    res = client.post(
        "/api/v1/benchmarks",
        json={
            "workspace_id": "ws",
            "name": "Test",
            "items": [
                {
                    "external_id": "1",
                    "task_type": "exact_short_answer",
                    "question": "Q?",
                    "gold_answer": "A",
                }
            ],
        },
    )
    assert res.status_code == 501
    err = ErrorResponse.model_validate(res.json())
    assert err.error == ErrorCode.NOT_IMPLEMENTED
    assert "Contract placeholder only" in err.message

    res_get = client.get("/api/v1/investigations/inv_123")
    assert res_get.status_code == 501
    err_get = ErrorResponse.model_validate(res_get.json())
    assert err_get.error == ErrorCode.NOT_IMPLEMENTED
