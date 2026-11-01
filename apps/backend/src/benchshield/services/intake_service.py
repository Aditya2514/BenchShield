"""Pure parsing and validation helpers for benchmark imports.

Enforces:
- Public/synthetic text-only formats (CSV and JSON)
- Exact short-answer and multiple-choice task types
- Duplicate external ID rejection
- Encoding tolerance (UTF-8 and UTF-8 with BOM) and rejection of invalid encodings
- Strict collection, row, and field length limits
- Choice identifier and gold-answer mapping without silent fallback on malformed JSON
- Metadata isolation: allowlisted PublicItemMetadata only; arbitrary/secret fields are rejected
- Salted immutable gold bindings: answer changes produce new grading identities and benchmark versions
- Atomic rejection: any error rejects the entire import batch
- Privacy boundary: row errors and responses NEVER echo protected gold answer values
"""

import csv
import hashlib
import io
import json
import uuid
from typing import Any

from pydantic import ValidationError

from benchshield.domain.enums import TaskType
from benchshield.domain.models.benchmarks import ChoiceOption, ItemVersion, PublicItemMetadata
from benchshield.domain.models.intake import (
    BenchmarkImportResponse,
    GoldVaultRecord,
    ImportRowError,
    ItemIntake,
)

SUPPORTED_TASK_TYPES = {
    TaskType.EXACT_SHORT_ANSWER.value,
    TaskType.MULTIPLE_CHOICE.value,
}

MAX_BATCH_ROWS = 10_000
MAX_CONTENT_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_EXTERNAL_ID_LENGTH = 256
MAX_QUESTION_LENGTH = 32_768
MAX_CHOICE_TEXT_LENGTH = 4_096
MAX_GOLD_ANSWER_LENGTH = 16_384


def _compute_sha256(text: str) -> str:
    """Deterministic SHA-256 calculation."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def parse_choices_string(raw: str) -> tuple[list[ChoiceOption] | None, str | None]:
    """Parse multiple-choice options from JSON string or delimiter format.

    Returns:
        (options, error_message)
    """
    raw = raw.strip()
    if not raw:
        return [], None

    # If it starts with JSON array syntax, it MUST be valid JSON (no silent fallback!)
    if raw.startswith("["):
        try:
            parsed = json.loads(raw)
        except Exception:
            return None, "Malformed multiple-choice JSON string."

        if not isinstance(parsed, list):
            return None, "Choices JSON must be an array of option objects."

        options: list[ChoiceOption] = []
        for opt in parsed:
            if not isinstance(opt, dict) or "id" not in opt or "text" not in opt:
                return None, "Each option in choices JSON must be an object with 'id' and 'text'."
            opt_id = str(opt["id"]).strip()
            opt_text = str(opt["text"]).strip()
            if not opt_id or not opt_text:
                return None, "Option 'id' and 'text' must not be empty."
            if len(opt_text) > MAX_CHOICE_TEXT_LENGTH:
                return (
                    None,
                    f"Choice text exceeds maximum length of {MAX_CHOICE_TEXT_LENGTH} characters.",
                )
            options.append(ChoiceOption(id=opt_id, text=opt_text))
        return options, None

    # Semicolon or comma-separated "id: text" format
    options = []
    delimiter = ";" if ";" in raw else ","
    chunks = raw.split(delimiter)
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue
        if ":" in chunk:
            opt_id, opt_text = chunk.split(":", 1)
            opt_id = opt_id.strip()
            opt_text = opt_text.strip()
            if not opt_id or not opt_text:
                return None, "Choice ID and text must not be empty."
            if len(opt_text) > MAX_CHOICE_TEXT_LENGTH:
                return (
                    None,
                    f"Choice text exceeds maximum length of {MAX_CHOICE_TEXT_LENGTH} characters.",
                )
            options.append(ChoiceOption(id=opt_id, text=opt_text))
        else:
            return (
                None,
                "Delimiter-formatted choices must follow 'ID: Text' pattern (e.g. 'A: North; B: East').",
            )
    return options, None


class BenchmarkIntakeService:
    """Authoritative parser and validator for benchmark ingestion."""

    @classmethod
    def parse_csv(cls, csv_content: str | bytes) -> list[dict[str, Any]]:
        """Parse raw CSV bytes or string into a list of row dictionaries."""
        if isinstance(csv_content, bytes):
            if len(csv_content) > MAX_CONTENT_BYTES:
                raise ValueError(f"Content exceeds maximum limit of {MAX_CONTENT_BYTES} bytes.")
            try:
                text = csv_content.decode("utf-8-sig")
            except UnicodeDecodeError as err:
                raise ValueError("Invalid character encoding: file must be UTF-8 encoded.") from err
        else:
            if len(csv_content.encode("utf-8")) > MAX_CONTENT_BYTES:
                raise ValueError(f"Content exceeds maximum limit of {MAX_CONTENT_BYTES} bytes.")
            text = csv_content
            if text.startswith("\ufeff"):
                text = text[1:]

        if not text.strip():
            return []

        # Check for duplicate CSV header names
        first_line = text.strip().splitlines()[0]
        header_reader = csv.reader(io.StringIO(first_line))
        headers = [h.strip().lower() for h in next(header_reader, []) if h.strip()]
        if len(headers) != len(set(headers)):
            raise ValueError("Duplicate CSV header column detected.")

        reader = csv.DictReader(io.StringIO(text))
        rows: list[dict[str, Any]] = []
        for row in reader:
            clean_row = {str(k).strip().lower(): v for k, v in row.items() if k is not None}
            rows.append(clean_row)
        return rows

    @classmethod
    def parse_json(cls, json_content: str | bytes) -> list[dict[str, Any]]:
        """Parse raw JSON bytes or string into a list of row dictionaries."""
        if isinstance(json_content, bytes):
            if len(json_content) > MAX_CONTENT_BYTES:
                raise ValueError(f"Content exceeds maximum limit of {MAX_CONTENT_BYTES} bytes.")
            try:
                text = json_content.decode("utf-8-sig")
            except UnicodeDecodeError as err:
                raise ValueError("Invalid character encoding: file must be UTF-8 encoded.") from err
        else:
            if len(json_content.encode("utf-8")) > MAX_CONTENT_BYTES:
                raise ValueError(f"Content exceeds maximum limit of {MAX_CONTENT_BYTES} bytes.")
            text = json_content
            if text.startswith("\ufeff"):
                text = text[1:]

        if not text.strip():
            return []

        try:
            data = json.loads(text)
        except Exception as err:
            raise ValueError(f"Malformed JSON: {err}") from err

        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            if "items" in data and isinstance(data["items"], list):
                return data["items"]
            raise ValueError("JSON object must contain an 'items' list")
        raise ValueError("JSON content must be a list of items or an object with an 'items' list")

    @classmethod
    def validate_and_process(
        cls,
        raw_items: list[Any],
        benchmark_name: str = "Benchmark",
        workspace_id: str = "ws_default",
    ) -> tuple[BenchmarkImportResponse, list[ItemVersion], list[GoldVaultRecord]]:
        """Validate raw items atomically and separate public models from vault records.

        Returns:
            (response, public_item_versions, gold_vault_records)
        """
        errors: list[ImportRowError] = []
        seen_external_ids: dict[str, int] = {}
        # Stores tuples: (intake, resolved_gold_text, resolved_gold_choice_id, gold_binding_version)
        valid_intakes: list[tuple[ItemIntake, str, str | None, str]] = []

        total_rows = len(raw_items)

        if total_rows == 0:
            return (
                BenchmarkImportResponse(
                    benchmark_version_id=None,
                    total_rows=0,
                    valid_rows=0,
                    status="rejected",
                    errors=[
                        ImportRowError(
                            row_number=1,
                            field="items",
                            error_code="empty_import",
                            message="Benchmark import contains no rows.",
                        )
                    ],
                ),
                [],
                [],
            )

        if total_rows > MAX_BATCH_ROWS:
            return (
                BenchmarkImportResponse(
                    benchmark_version_id=None,
                    total_rows=total_rows,
                    valid_rows=0,
                    status="rejected",
                    errors=[
                        ImportRowError(
                            row_number=1,
                            field="items",
                            error_code="batch_size_exceeded",
                            message=f"Import batch size ({total_rows}) exceeds maximum permitted limit of {MAX_BATCH_ROWS} rows.",
                        )
                    ],
                ),
                [],
                [],
            )

        for idx, row in enumerate(raw_items, start=1):
            row_errors: list[ImportRowError] = []

            # Ensure row is a dictionary
            if not isinstance(row, dict):
                row_errors.append(
                    ImportRowError(
                        row_number=idx,
                        field="row",
                        error_code="invalid_row_format",
                        message="Row must be a valid JSON object or dictionary.",
                    )
                )
                errors.extend(row_errors)
                continue

            # 1. External ID
            ext_id = row.get("external_id") or row.get("id")
            if ext_id is None or str(ext_id).strip() == "":
                row_errors.append(
                    ImportRowError(
                        row_number=idx,
                        field="external_id",
                        error_code="missing_required_field",
                        message="External item ID is required and cannot be empty.",
                    )
                )
                ext_id_str = ""
            else:
                ext_id_str = str(ext_id).strip()
                if len(ext_id_str) > MAX_EXTERNAL_ID_LENGTH:
                    row_errors.append(
                        ImportRowError(
                            row_number=idx,
                            field="external_id",
                            error_code="field_too_long",
                            message=f"External item ID exceeds maximum length of {MAX_EXTERNAL_ID_LENGTH} characters.",
                        )
                    )
                elif ext_id_str in seen_external_ids:
                    row_errors.append(
                        ImportRowError(
                            row_number=idx,
                            field="external_id",
                            error_code="duplicate_item_id",
                            message=f"Duplicate external item ID '{ext_id_str}' (first seen at row {seen_external_ids[ext_id_str]}).",
                        )
                    )
                else:
                    seen_external_ids[ext_id_str] = idx

            # 2. Task Type
            raw_task_type = str(row.get("task_type", "")).strip().lower()
            if not raw_task_type:
                row_errors.append(
                    ImportRowError(
                        row_number=idx,
                        field="task_type",
                        error_code="missing_required_field",
                        message="Task type is required.",
                    )
                )
                task_type_enum = None
            elif raw_task_type not in SUPPORTED_TASK_TYPES:
                row_errors.append(
                    ImportRowError(
                        row_number=idx,
                        field="task_type",
                        error_code="unsupported_task_type",
                        message=(
                            f"Task type '{raw_task_type}' is unsupported. "
                            "Supported types are 'exact_short_answer' and 'multiple_choice'."
                        ),
                    )
                )
                task_type_enum = None
            else:
                task_type_enum = TaskType(raw_task_type)

            # 3. Question
            question = row.get("question")
            if question is None or str(question).strip() == "":
                row_errors.append(
                    ImportRowError(
                        row_number=idx,
                        field="question",
                        error_code="missing_required_field",
                        message="Question text is required and cannot be empty.",
                    )
                )
                clean_question = ""
            else:
                clean_question = str(question).strip()
                if len(clean_question) > MAX_QUESTION_LENGTH:
                    row_errors.append(
                        ImportRowError(
                            row_number=idx,
                            field="question",
                            error_code="field_too_long",
                            message=f"Question text exceeds maximum length of {MAX_QUESTION_LENGTH} characters.",
                        )
                    )

            # 4. Gold Answer (Strictly protect - NEVER echo value in error message!)
            gold_answer = row.get("gold_answer") or row.get("answer")
            if gold_answer is None or str(gold_answer).strip() == "":
                row_errors.append(
                    ImportRowError(
                        row_number=idx,
                        field="gold_answer",
                        error_code="missing_required_field",
                        message="Gold answer is required and cannot be empty.",
                    )
                )
                clean_gold_answer = ""
            else:
                clean_gold_answer = str(gold_answer).strip()
                if len(clean_gold_answer) > MAX_GOLD_ANSWER_LENGTH:
                    row_errors.append(
                        ImportRowError(
                            row_number=idx,
                            field="gold_answer",
                            error_code="field_too_long",
                            message=f"Gold answer exceeds maximum length of {MAX_GOLD_ANSWER_LENGTH} characters.",
                        )
                    )

            # 5. Choices parsing and validation
            choices_list: list[ChoiceOption] | None = None
            resolved_gold_text = clean_gold_answer
            resolved_gold_choice_id: str | None = None

            if task_type_enum == TaskType.MULTIPLE_CHOICE:
                raw_choices = row.get("choices")
                if isinstance(raw_choices, list):
                    options = []
                    choices_malformed = False
                    for opt in raw_choices:
                        if isinstance(opt, dict) and "id" in opt and "text" in opt:
                            options.append(
                                ChoiceOption(
                                    id=str(opt["id"]).strip(), text=str(opt["text"]).strip()
                                )
                            )
                        elif isinstance(opt, ChoiceOption):
                            options.append(opt)
                        else:
                            choices_malformed = True
                            break
                    if choices_malformed:
                        row_errors.append(
                            ImportRowError(
                                row_number=idx,
                                field="choices",
                                error_code="invalid_choices",
                                message="Multiple choice options list contains malformed elements.",
                            )
                        )
                    else:
                        choices_list = options
                elif isinstance(raw_choices, str):
                    parsed_opts, parse_err = parse_choices_string(raw_choices)
                    if parse_err:
                        row_errors.append(
                            ImportRowError(
                                row_number=idx,
                                field="choices",
                                error_code="invalid_choices",
                                message=parse_err,
                            )
                        )
                    else:
                        choices_list = parsed_opts
                else:
                    row_errors.append(
                        ImportRowError(
                            row_number=idx,
                            field="choices",
                            error_code="invalid_choices",
                            message="Multiple choice tasks require a list of options or a valid choices string.",
                        )
                    )

                if choices_list is not None:
                    if len(choices_list) < 2:
                        row_errors.append(
                            ImportRowError(
                                row_number=idx,
                                field="choices",
                                error_code="invalid_choices",
                                message="Multiple choice tasks require at least two distinct options.",
                            )
                        )
                    else:
                        # Check unique choice IDs and unique choice texts
                        choice_ids = [c.id.upper() for c in choices_list]
                        choice_texts = [c.text.strip().lower() for c in choices_list]
                        if len(choice_ids) != len(set(choice_ids)):
                            row_errors.append(
                                ImportRowError(
                                    row_number=idx,
                                    field="choices",
                                    error_code="duplicate_choice_id",
                                    message="Choice IDs must be distinct within the multiple choice item.",
                                )
                            )
                        if len(choice_texts) != len(set(choice_texts)):
                            row_errors.append(
                                ImportRowError(
                                    row_number=idx,
                                    field="choices",
                                    error_code="duplicate_choice_text",
                                    message="Choice texts must be distinct within the multiple choice item.",
                                )
                            )

                        # Gold answer mapping: check if gold answer matches choice ID or choice text
                        if clean_gold_answer:
                            id_matches = [
                                opt
                                for opt in choices_list
                                if opt.id.upper() == clean_gold_answer.strip().upper()
                            ]
                            text_matches = [
                                opt
                                for opt in choices_list
                                if opt.text.strip().lower() == clean_gold_answer.strip().lower()
                            ]

                            if id_matches:
                                resolved_gold_choice_id = id_matches[0].id
                                resolved_gold_text = id_matches[0].text
                            elif text_matches:
                                resolved_gold_choice_id = text_matches[0].id
                                resolved_gold_text = text_matches[0].text
                            else:
                                row_errors.append(
                                    ImportRowError(
                                        row_number=idx,
                                        field="gold_answer",
                                        error_code="invalid_gold_answer_mapping",
                                        message="Gold answer does not correspond to any valid choice identifier or text.",
                                    )
                                )

            elif task_type_enum == TaskType.EXACT_SHORT_ANSWER:
                choices_list = None
                resolved_gold_choice_id = None
                resolved_gold_text = clean_gold_answer

            # 6. Metadata validation (Strictly allowlisted PublicItemMetadata, reject unexpected fields)
            raw_meta = row.get("metadata")
            validated_meta = PublicItemMetadata()
            if raw_meta is not None:
                if not isinstance(raw_meta, dict):
                    row_errors.append(
                        ImportRowError(
                            row_number=idx,
                            field="metadata",
                            error_code="invalid_metadata_type",
                            message="Item metadata must be a JSON object or dictionary.",
                        )
                    )
                else:
                    try:
                        validated_meta = PublicItemMetadata.model_validate(raw_meta)
                    except ValidationError:
                        # Extract error code without echoing secret values
                        row_errors.append(
                            ImportRowError(
                                row_number=idx,
                                field="metadata",
                                error_code="disallowed_metadata_field",
                                message="Metadata contains disallowed or non-allowlisted fields.",
                            )
                        )

            if row_errors:
                errors.extend(row_errors)
            else:
                # Opaque random answer revision ID: NEVER derived from answer text
                answer_revision_id = f"anr_{uuid.uuid4().hex[:16]}"

                intake = ItemIntake(
                    external_id=ext_id_str,
                    task_type=task_type_enum,
                    question=clean_question,
                    choices=choices_list,
                    gold_answer=clean_gold_answer,
                    metadata=validated_meta,
                )
                valid_intakes.append(
                    (intake, resolved_gold_text, resolved_gold_choice_id, answer_revision_id)
                )

        # Atomic Rejection: if any error exists, reject entire import batch
        if errors:
            return (
                BenchmarkImportResponse(
                    benchmark_id=None,
                    benchmark_version_id=None,
                    total_rows=total_rows,
                    valid_rows=len(valid_intakes),
                    status="rejected",
                    errors=errors,
                ),
                [],
                [],
            )

        # Generate opaque random benchmark version ID
        benchmark_version_id = f"bmv_{uuid.uuid4().hex[:16]}"

        public_items: list[ItemVersion] = []
        gold_vault_records: list[GoldVaultRecord] = []

        for intake, res_gold_text, res_choice_id, answer_revision_id in valid_intakes:
            # Opaque random item version ID
            item_version_id = f"itv_{uuid.uuid4().hex[:16]}"

            # Public item version (STRICTLY NO GOLD ANSWER, allowlisted metadata only, opaque answer_revision_id)
            public_items.append(
                ItemVersion(
                    item_version_id=item_version_id,
                    benchmark_version_id=benchmark_version_id,
                    external_id=intake.external_id,
                    task_type=intake.task_type,
                    question=intake.question,
                    choices=intake.choices,
                    answer_revision_id=answer_revision_id,
                    metadata=intake.metadata,
                )
            )

            # Vault record (Stored in isolated gold boundary)
            vault_item_id = f"gld_{uuid.uuid4().hex[:16]}"
            gold_vault_records.append(
                GoldVaultRecord(
                    vault_item_id=vault_item_id,
                    benchmark_version_id=benchmark_version_id,
                    item_version_id=item_version_id,
                    external_id=intake.external_id,
                    answer_revision_id=answer_revision_id,
                    gold_answer_text=res_gold_text,
                    gold_choice_id=res_choice_id,
                    content_hash=_compute_sha256(res_gold_text),
                )
            )

        response = BenchmarkImportResponse(
            benchmark_id=f"bmk_{uuid.uuid4().hex[:16]}",
            benchmark_version_id=benchmark_version_id,
            total_rows=total_rows,
            valid_rows=total_rows,
            status="accepted",
            errors=[],
        )
        return response, public_items, gold_vault_records
