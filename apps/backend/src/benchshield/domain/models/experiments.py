"""Controlled attacker experiment models and results."""

from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from benchshield.domain.enums import (
    AttributionLevel,
    ExperimentCondition,
    ExperimentRunStatus,
    GraderOutcome,
    PolicyCompliance,
)


class ObservableToolCall(BaseModel):
    """Observable tool action recorded during an experimental run.

    BenchShield records observable external tool actions rather than speculative internal reasoning.
    """

    tool_name: str = Field(
        ..., description="Name of the invoked tool (e.g. 'web_search', 'fetch_page')"
    )
    query_or_action: str = Field(..., description="Action parameters (e.g. search keywords or URL)")
    observed_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Observation timestamp"
    )
    response_summary: str = Field(..., description="Sanitized summary of tool response")


class AdversarialRun(BaseModel):
    """Detailed execution record for an item in a specific experimental condition."""

    run_id: str = Field(..., description="Unique run identifier", min_length=1)
    experiment_id: str = Field(..., description="Parent experiment ID", min_length=1)
    item_version_id: str = Field(..., description="Target item version ID", min_length=1)
    condition: ExperimentCondition = Field(..., description="Control, blind, or evaluation-aware")
    run_status: ExperimentRunStatus = Field(..., description="Status of the run")
    source_discovered: Literal["yes", "no", "unknown"] = Field(
        default="unknown",
        description="Whether an external source containing task answers was discovered",
    )
    answer_bearing_content_retrieved: Literal["yes", "no", "unknown"] = Field(
        default="unknown", description="Whether answer-bearing text was pulled into model context"
    )
    grader_outcome: GraderOutcome = Field(
        default=GraderOutcome.UNSUPPORTED,
        description="Grading outcome from trusted grading service",
    )
    attribution: AttributionLevel = Field(
        default=AttributionLevel.NONE, description="Level of causal or observable attribution"
    )
    policy_compliance: PolicyCompliance = Field(
        default=PolicyCompliance.UNKNOWN,
        description="Whether evaluation policy rules were violated",
    )
    observable_tool_calls: list[ObservableToolCall] = Field(
        default_factory=list, description="Observable tool actions"
    )
    generated_output: str | None = Field(
        default=None, description="Attacker model's generated answer text"
    )
    failure_reason: str | None = Field(default=None, description="Reason if failed or incomplete")


class ExperimentConfig(BaseModel):
    """Immutable pinned configuration for controlled attacker experiments."""

    experiment_id: str = Field(..., description="Unique experiment ID", min_length=1)
    investigation_id: str = Field(..., description="Source investigation ID", min_length=1)
    benchmark_version_id: str = Field(..., description="Target benchmark version ID", min_length=1)
    policy_version_id: str = Field(..., description="Target policy version ID", min_length=1)
    conditions: list[ExperimentCondition] = Field(..., description="Conditions to execute")
    provider_id: str = Field(..., description="Pinned provider (e.g. 'anthropic', 'openai')")
    model_identifier: str = Field(..., description="Pinned model ID")
    model_revision: str | None = Field(default=None, description="Pinned model snapshot revision")
    prompt_version: str = Field(default="prompt_v1.0", description="Pinned prompt template version")
    generation_settings: dict[str, Any] = Field(
        default_factory=dict, description="Temperature, max_tokens, etc."
    )
    tool_policy: dict[str, Any] = Field(
        default_factory=dict, description="Allowed tool configuration"
    )
    reasoning_budget: int = Field(default=1000, description="Token reasoning budget", ge=100)
    grader_version: str = Field(default="grader_v1.0", description="Trusted grader version")
    repetitions: int = Field(
        default=1, description="Repetitions per item per condition", ge=1, le=10
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Experiment setup timestamp"
    )


class ExperimentCreateRequest(BaseModel):
    """Payload to configure and launch optional attacker experiments."""

    investigation_id: str = Field(
        ..., description="Investigation ID whose discovery findings are frozen", min_length=1
    )
    conditions: list[ExperimentCondition] = Field(
        default=[
            ExperimentCondition.CONTROL,
            ExperimentCondition.BLIND,
            ExperimentCondition.EVALUATION_AWARE,
        ],
        description="Conditions to test",
        min_length=1,
    )
    provider_id: str = Field(..., description="Pinned LLM provider")
    model_identifier: str = Field(..., description="Pinned model identifier")
    model_revision: str | None = Field(
        default=None, description="Pinned model revision if available"
    )
    prompt_version: str = Field(default="prompt_v1.0", description="Prompt template version")
    reasoning_budget: int = Field(default=1000, ge=100, le=100000, description="Token budget")


class ExperimentResultsResponse(BaseModel):
    """Summary and details of completed experiment runs."""

    experiment_id: str = Field(..., description="Experiment ID")
    runs: list[AdversarialRun] = Field(default_factory=list, description="Run records")
    completed_runs_count: int = Field(..., description="Runs completed cleanly", ge=0)
    incomplete_runs_count: int = Field(..., description="Runs interrupted or failed", ge=0)
    prohibited_retrieval_count: int = Field(
        ..., description="Runs with prohibited retrieval observed", ge=0
    )
    correct_answer_count: int = Field(..., description="Runs graded correct", ge=0)
