"""Tests for BenchmarkIntakeService parsing, validation, and privacy protection."""

from pathlib import Path

from benchshield.services.intake_service import BenchmarkIntakeService


def test_valid_json_intake_passes():
    """Verify that a valid JSON benchmark imports atomically and separates public vs vault items."""
    fixture_path = (
        Path(__file__).resolve().parents[4] / "fixtures" / "synthetic_benchmark_valid.json"
    )
    content = fixture_path.read_text(encoding="utf-8")
    raw_items = BenchmarkIntakeService.parse_json(content)

    response, public_items, gold_records = BenchmarkIntakeService.validate_and_process(
        raw_items, benchmark_name="Pilot Benchmark", workspace_id="ws_test"
    )

    assert response.status == "accepted"
    assert response.benchmark_version_id is not None
    assert response.benchmark_version_id.startswith("bmv_")
    assert response.total_rows == 3
    assert response.valid_rows == 3
    assert len(response.errors) == 0

    assert len(public_items) == 3
    assert len(gold_records) == 3

    # Public items must not have gold answers
    for item in public_items:
        assert not hasattr(item, "gold_answer")
        item_dict = item.model_dump()
        assert "gold_answer" not in item_dict

    # Gold records must contain the vaulted answers
    assert gold_records[0].gold_answer_text == "Sub-surface thorium reactor"
    assert gold_records[1].gold_choice_id == "B"
    assert gold_records[1].gold_answer_text == "East Station"


def test_valid_csv_intake_passes():
    """Verify that valid CSV benchmark content is accepted."""
    fixture_path = (
        Path(__file__).resolve().parents[4] / "fixtures" / "synthetic_benchmark_valid.csv"
    )
    content = fixture_path.read_text(encoding="utf-8")
    raw_items = BenchmarkIntakeService.parse_csv(content)

    response, public_items, gold_records = BenchmarkIntakeService.validate_and_process(
        raw_items, benchmark_name="CSV Benchmark", workspace_id="ws_csv"
    )

    assert response.status == "accepted"
    assert response.total_rows == 3
    assert len(public_items) == 3
    assert len(gold_records) == 3


def test_utf8_bom_handling():
    """Verify that UTF-8 with BOM is gracefully decoded without parsing errors."""
    csv_with_bom = "\ufeffexternal_id,task_type,question,gold_answer\nITEM-01,exact_short_answer,What is 2+2?,4\n"
    raw_items = BenchmarkIntakeService.parse_csv(csv_with_bom)
    response, public_items, gold_records = BenchmarkIntakeService.validate_and_process(raw_items)

    assert response.status == "accepted"
    assert len(public_items) == 1
    assert public_items[0].external_id == "ITEM-01"


def test_atomic_rejection_on_negative_fixture():
    """Verify atomic rejection: any invalid row causes rejection with no usable benchmark version."""
    fixture_path = (
        Path(__file__).resolve().parents[4] / "fixtures" / "synthetic_benchmark_invalid.csv"
    )
    content = fixture_path.read_text(encoding="utf-8")
    raw_items = BenchmarkIntakeService.parse_csv(content)

    response, public_items, gold_records = BenchmarkIntakeService.validate_and_process(raw_items)

    assert response.status == "rejected"
    assert response.benchmark_version_id is None
    assert len(public_items) == 0
    assert len(gold_records) == 0
    assert len(response.errors) > 0

    error_codes = {e.error_code for e in response.errors}
    assert "duplicate_item_id" in error_codes
    assert "unsupported_task_type" in error_codes
    assert "missing_required_field" in error_codes
    assert "invalid_choices" in error_codes
    assert "invalid_gold_answer_mapping" in error_codes


def test_reordered_choices_preserve_answer_identity():
    """Verify reordered multiple-choice options map to the correct text regardless of position."""
    # Item 1: A=North, B=East, gold=B
    raw_item_1 = {
        "external_id": "REORDER-01",
        "task_type": "multiple_choice",
        "question": "Which station?",
        "choices": [
            {"id": "A", "text": "North"},
            {"id": "B", "text": "East"},
        ],
        "gold_answer": "B",
    }
    # Item 2: Same question, but reordered options: A=East, B=North, gold=East
    raw_item_2 = {
        "external_id": "REORDER-02",
        "task_type": "multiple_choice",
        "question": "Which station?",
        "choices": [
            {"id": "A", "text": "East"},
            {"id": "B", "text": "North"},
        ],
        "gold_answer": "East",
    }

    response, public_items, gold_records = BenchmarkIntakeService.validate_and_process(
        [raw_item_1, raw_item_2]
    )

    assert response.status == "accepted"
    assert len(gold_records) == 2
    # Both resolve to "East" as the protected reference text!
    assert gold_records[0].gold_answer_text == "East"
    assert gold_records[0].gold_choice_id == "B"
    assert gold_records[1].gold_answer_text == "East"
    assert gold_records[1].gold_choice_id == "A"


def test_error_message_never_echoes_protected_answer():
    """CRITICAL SECURITY TEST: Ensure error messages never contain or echo the protected answer."""
    secret_answer = "SECRET_SUPER_CONFIDENTIAL_KEY_XYZ_987"
    raw_item = {
        "external_id": "LEAK-TEST-01",
        "task_type": "multiple_choice",
        "question": "What is the secret?",
        "choices": [
            {"id": "A", "text": "Option Alpha"},
            {"id": "B", "text": "Option Beta"},
        ],
        "gold_answer": secret_answer,  # Does not match any choice
    }

    response, public_items, gold_records = BenchmarkIntakeService.validate_and_process([raw_item])

    assert response.status == "rejected"
    assert len(response.errors) > 0

    # Assert secret string is nowhere in any error field or message
    for err in response.errors:
        assert secret_answer not in err.message
        assert secret_answer not in err.field
        assert secret_answer not in err.error_code
