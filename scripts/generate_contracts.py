"""Script to generate OpenAPI specification and Event JSON schemas into docs/contracts."""

import json
import os
import sys
from pathlib import Path

# Ensure backend package is in pythonpath
current_dir = Path(__file__).resolve().parent
repo_root = current_dir.parent
backend_src = repo_root / "apps" / "backend" / "src"

if str(backend_src) not in sys.path:
    sys.path.insert(0, str(backend_src))

from benchshield.api.app import contract_app
from benchshield.domain.models.events import (
    CandidateDiscoveredEventData,
    InvestigationProgressEventData,
    SnapshotRefreshRequiredEventData,
    SSEEventEnvelope,
)


def generate_contracts() -> None:
    contracts_dir = repo_root / "docs" / "contracts"
    events_dir = contracts_dir / "events"
    contracts_dir.mkdir(parents=True, exist_ok=True)
    events_dir.mkdir(parents=True, exist_ok=True)

    # 1. Export OpenAPI Specification
    openapi_schema = contract_app.openapi()
    openapi_file = contracts_dir / "openapi.json"
    with open(openapi_file, "w", encoding="utf-8") as f:
        json.dump(openapi_schema, f, indent=2, sort_keys=True)
    print(f"Generated: {openapi_file}")

    # 2. Export Event JSON Schemas
    event_models = {
        "sse_envelope.json": SSEEventEnvelope,
        "progress_event.json": InvestigationProgressEventData,
        "candidate_discovered_event.json": CandidateDiscoveredEventData,
        "snapshot_refresh_required_event.json": SnapshotRefreshRequiredEventData,
    }

    consolidated_events = {}
    for filename, model in event_models.items():
        schema = model.model_json_schema()
        file_path = events_dir / filename
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(schema, f, indent=2, sort_keys=True)
        consolidated_events[filename.replace(".json", "")] = schema
        print(f"Generated: {file_path}")

    # Consolidated events.json for easy single-schema access
    consolidated_file = contracts_dir / "events.json"
    with open(consolidated_file, "w", encoding="utf-8") as f:
        json.dump(consolidated_events, f, indent=2, sort_keys=True)
    print(f"Generated: {consolidated_file}")


if __name__ == "__main__":
    generate_contracts()
