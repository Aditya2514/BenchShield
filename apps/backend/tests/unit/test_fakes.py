"""Tests for deterministic fake provider adapters."""

import pytest

from benchshield.domain.enums import GraderOutcome, SourceFamily, TaskType
from benchshield.domain.models.benchmarks import ChoiceOption
from benchshield.domain.models.evidence import SourceSnapshot
from benchshield.domain.models.intake import GoldVaultRecord
from benchshield.providers.fakes import (
    FakeEvidenceStorageAdapter,
    FakeFetchAdapter,
    FakeGoldVaultAdapter,
    FakeModelReasoningAdapter,
    FakeSearchAdapter,
    FakeTrustedGradingAdapter,
)
from benchshield.providers.interfaces import (
    AdapterRateLimitError,
    AdapterTimeoutError,
    AdapterUnavailableError,
    SearchResult,
)


def test_fake_search_adapter():
    """Verify FakeSearchAdapter returns canned results and tracks usage."""
    canned_results = [
        SearchResult(
            title="Valdora Gazette",
            url="https://news.valdora.example.com/capital",
            snippet="Kaelis is the capital of Valdora.",
            source_family=SourceFamily.WEB_SEARCH,
        )
    ]
    adapter = FakeSearchAdapter(responses={"What is the capital of Valdora?": canned_results})

    results, usage = adapter.search("What is the capital of Valdora?")
    assert len(results) == 1
    assert results[0].url == "https://news.valdora.example.com/capital"
    assert usage.queries_count == 1
    assert usage.cost_usd > 0
    assert len(adapter.call_history) == 1

    # Test simulated timeout
    adapter.should_timeout = True
    with pytest.raises(AdapterTimeoutError):
        adapter.search("What is the capital of Valdora?")

    # Test simulated rate limit
    adapter.should_timeout = False
    adapter.should_rate_limit = True
    with pytest.raises(AdapterRateLimitError):
        adapter.search("What is the capital of Valdora?")

    # Test simulated outage
    adapter.should_rate_limit = False
    adapter.should_fail = True
    with pytest.raises(AdapterUnavailableError):
        adapter.search("What is the capital of Valdora?")


def test_fake_fetch_adapter():
    """Verify FakeFetchAdapter returns page content and handles errors."""
    adapter = FakeFetchAdapter()
    page, usage = adapter.fetch("https://fictional-station.org/k7")
    assert page.final_url == "https://fictional-station.org/k7"
    assert page.status_code == 200
    assert page.content_hash is not None
    assert usage.fetches_count == 1

    adapter.should_timeout = True
    with pytest.raises(AdapterTimeoutError):
        adapter.fetch("https://fictional-station.org/k7")


def test_fake_model_reasoning_adapter():
    """Verify FakeModelReasoningAdapter returns deterministic canned output and tracks tokens."""
    adapter = FakeModelReasoningAdapter(canned_response="The calculated speed is 75 km/h.")
    output, usage = adapter.generate("Calculate speed for 150km in 2h.")
    assert output == "The calculated speed is 75 km/h."
    assert usage.output_tokens > 0
    assert len(adapter.prompts) == 1


def test_fake_evidence_storage_adapter():
    """Verify FakeEvidenceStorageAdapter stores and retrieves snapshots."""
    storage = FakeEvidenceStorageAdapter()
    snapshot = SourceSnapshot(
        snapshot_id="snp_001",
        source_url="https://wiki.example.com",
        final_url="https://wiki.example.com",
        source_family=SourceFamily.ACADEMIC_ARCHIVE,
        content_hash="abc123hash",
    )
    raw_html = "<html><body>Evidence text</body></html>"

    uri = storage.save_snapshot(snapshot, raw_html)
    assert uri == "memory://snapshots/snp_001"

    retrieved_snp, retrieved_content = storage.get_snapshot("snp_001")
    assert retrieved_snp is not None
    assert retrieved_snp.snapshot_id == "snp_001"
    assert retrieved_content == raw_html


def test_fake_gold_vault_and_trusted_grader():
    """Verify that TrustedGradingAdapter grades candidate answers against vaulted reference answers without leaking gold."""
    vault = FakeGoldVaultAdapter()
    grader = FakeTrustedGradingAdapter(vault=vault)

    # Store gold records in vault
    vault.store_gold_records(
        [
            GoldVaultRecord(
                vault_item_id="gld_01",
                benchmark_version_id="bmv_test",
                item_version_id="itv_01",
                external_id="ITEM-SHORT",
                answer_revision_id="anr_01",
                gold_answer_text="Sub-surface thorium reactor",
                gold_choice_id=None,
                content_hash="hash1",
            ),
            GoldVaultRecord(
                vault_item_id="gld_02",
                benchmark_version_id="bmv_test",
                item_version_id="itv_02",
                external_id="ITEM-MCQ",
                answer_revision_id="anr_02",
                gold_answer_text="East Station",
                gold_choice_id="B",
                content_hash="hash2",
            ),
        ]
    )

    # 1. Exact short-answer grading
    outcome_correct, explanation = grader.grade(
        benchmark_version_id="bmv_test",
        external_id="ITEM-SHORT",
        candidate_answer="sub-surface thorium reactor",  # case-insensitive match
        task_type=TaskType.EXACT_SHORT_ANSWER,
    )
    assert outcome_correct == GraderOutcome.CORRECT

    outcome_incorrect, _ = grader.grade(
        benchmark_version_id="bmv_test",
        external_id="ITEM-SHORT",
        candidate_answer="solar panels",
        task_type=TaskType.EXACT_SHORT_ANSWER,
    )
    assert outcome_incorrect == GraderOutcome.INCORRECT

    # 2. Multiple-choice grading (matching by choice letter or reordered option text)
    # Candidate matches choice ID "B"
    outcome_mcq, _ = grader.grade(
        benchmark_version_id="bmv_test",
        external_id="ITEM-MCQ",
        candidate_answer="B",
        task_type=TaskType.MULTIPLE_CHOICE,
    )
    assert outcome_mcq == GraderOutcome.CORRECT

    # Candidate matches option text "East Station"
    outcome_mcq_text, _ = grader.grade(
        benchmark_version_id="bmv_test",
        external_id="ITEM-MCQ",
        candidate_answer="east station",
        task_type=TaskType.MULTIPLE_CHOICE,
    )
    assert outcome_mcq_text == GraderOutcome.CORRECT

    # Reordered choices: In this new ordering, East Station is choice "A"
    reordered_choices = [
        ChoiceOption(id="A", text="East Station"),
        ChoiceOption(id="B", text="North Station"),
    ]
    outcome_reordered, _ = grader.grade(
        benchmark_version_id="bmv_test",
        external_id="ITEM-MCQ",
        candidate_answer="A",  # Choice A in the reordered set corresponds to East Station
        task_type=TaskType.MULTIPLE_CHOICE,
        choices=reordered_choices,
    )
    assert outcome_reordered == GraderOutcome.CORRECT
