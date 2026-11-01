"""Security and privacy boundary regression tests.

Guarantees:
- Protected gold answers and grading rubrics are strictly isolated to the vault boundary.
- Public response schemas never include gold answers.
- Serialized public items, SSE events, and error messages never leak reference answers.
"""

import json

from benchshield.domain.enums import (
    EventType,
    TaskType,
)
from benchshield.domain.models.benchmarks import ChoiceOption, ItemVersion
from benchshield.domain.models.events import SSEEventEnvelope
from benchshield.services.intake_service import BenchmarkIntakeService


def test_public_item_version_schema_has_no_gold_field():
    """Ensure ItemVersion schema definition contains no gold answer attributes."""
    assert "gold_answer" not in ItemVersion.model_fields
    assert "gold_answer_text" not in ItemVersion.model_fields
    assert "reference_answer" not in ItemVersion.model_fields
    assert "rubric" not in ItemVersion.model_fields


def test_public_response_serialization_excludes_gold_answers():
    """Verify serialized JSON representation of public models contains no gold answers."""
    item = ItemVersion(
        item_version_id="itv_100",
        benchmark_version_id="bmv_200",
        external_id="EXT-100",
        task_type=TaskType.MULTIPLE_CHOICE,
        question="Which station?",
        choices=[
            ChoiceOption(id="A", text="North Station"),
            ChoiceOption(id="B", text="East Station"),
        ],
        answer_revision_id="anr_0123456789abcdef",
    )
    json_str = item.model_dump_json()
    assert "gold" not in json_str.lower()
    assert "reference_answer" not in json_str.lower()


def test_intake_service_separates_public_and_vault_boundaries():
    """Verify that intake service places gold answers ONLY in GoldVaultRecord."""
    secret = "TOP_SECRET_ANSWER_HASH_99"
    raw_item = {
        "external_id": "TEST-SEC-01",
        "task_type": "exact_short_answer",
        "question": "What is the vault key?",
        "gold_answer": secret,
    }

    response, public_items, gold_records = BenchmarkIntakeService.validate_and_process([raw_item])

    assert response.status == "accepted"
    assert len(public_items) == 1
    assert len(gold_records) == 1

    # Public item does not contain secret
    assert secret not in public_items[0].model_dump_json()

    # Vault record contains secret
    assert gold_records[0].gold_answer_text == secret


def test_error_response_does_not_leak_gold_answer():
    """Verify ImportRowError excludes gold answer string when mapping fails."""
    secret = "CONFIDENTIAL_KEY_555"
    raw_item = {
        "external_id": "TEST-SEC-02",
        "task_type": "multiple_choice",
        "question": "Question text?",
        "choices": [
            {"id": "A", "text": "Choice 1"},
            {"id": "B", "text": "Choice 2"},
        ],
        "gold_answer": secret,
    }

    response, public_items, gold_records = BenchmarkIntakeService.validate_and_process([raw_item])
    assert response.status == "rejected"
    error_dump = json.dumps([e.model_dump() for e in response.errors])
    assert secret not in error_dump


def test_sse_event_envelope_excludes_gold_answers():
    """Ensure SSE telemetry envelope data contains no secret payload."""
    event = SSEEventEnvelope(
        event_id="evt_000001",
        investigation_id="inv_001",
        type=EventType.INVESTIGATION_STARTED,
        data={
            "benchmark_version_id": "bmv_001",
            "total_items": 10,
        },
    )
    dumped = event.model_dump_json()
    assert "gold" not in dumped.lower()
