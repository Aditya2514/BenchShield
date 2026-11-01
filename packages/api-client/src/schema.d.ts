/* DO NOT EDIT - AUTOMATICALLY GENERATED FROM docs/contracts/openapi.json */

export interface paths {
    "/api/v1/benchmarks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Import and validate benchmark
         * @description Validate benchmark CSV/JSON items. Returns immutable version ID or row errors without echoing protected answers.
         */
        post: operations["import_benchmark_api_v1_benchmarks_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/benchmarks/upload": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Upload benchmark file (CSV or JSON)
         * @description Upload and validate a benchmark CSV or JSON file. Returns immutable version ID or row errors without retaining files or echoing protected answers.
         */
        post: operations["upload_benchmark_file_api_v1_benchmarks_upload_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/benchmarks/versions/{version_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get benchmark version
         * @description Retrieve immutable benchmark version metadata.
         */
        get: operations["get_benchmark_version_api_v1_benchmarks_versions__version_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/benchmarks/versions/{version_id}/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List benchmark items
         * @description Paginated retrieval of public item versions (gold answers strictly excluded).
         */
        get: operations["list_benchmark_items_api_v1_benchmarks_versions__version_id__items_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/benchmarks/{benchmark_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get benchmark metadata
         * @description Retrieve parent benchmark entity and version counts.
         */
        get: operations["get_benchmark_api_v1_benchmarks__benchmark_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/experiments/{experiment_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get experiment results
         * @description Retrieve aggregated results and raw observable execution runs for an attacker experiment.
         */
        get: operations["get_experiment_api_v1_experiments__experiment_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/findings/{finding_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get finding */
        get: operations["get_finding_api_v1_findings__finding_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/findings/{finding_id}/reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get review history
         * @description Append-only reviewer decision history in version order.
         */
        get: operations["get_review_history_api_v1_findings__finding_id__reviews_get"];
        put?: never;
        /**
         * Submit reviewer decision
         * @description Append human review decision with expected finding version; returns 409 on version conflict.
         */
        post: operations["submit_review_api_v1_findings__finding_id__reviews_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/investigations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Launch investigation
         * @description Validate policy and budget, and launch an exposure audit investigation. Requires Idempotency-Key.
         */
        post: operations["launch_investigation_api_v1_investigations_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/investigations/{investigation_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get investigation status
         * @description Retrieve investigation state, item counts, partial coverage, budget consumption, and limitations.
         */
        get: operations["get_investigation_api_v1_investigations__investigation_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/investigations/{investigation_id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel investigation
         * @description Idempotent cancellation request to signal running workers and halt new task dispatch.
         */
        post: operations["cancel_investigation_api_v1_investigations__investigation_id__cancel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/investigations/{investigation_id}/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Stream investigation events
         * @description Authenticated text/event-stream SSE stream emitting monotonic public progress events. Event framing: 'id: <id>\nevent: <type>\ndata: <json>\n\n'. Reconnect using Last-Event-ID header.
         */
        get: operations["get_investigation_events_api_v1_investigations__investigation_id__events_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/investigations/{investigation_id}/experiments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Launch optional controlled experiment
         * @description Create pinned optional attacker experiment after frozen discovery verification.
         */
        post: operations["launch_experiment_api_v1_investigations__investigation_id__experiments_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/investigations/{investigation_id}/findings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List investigation findings
         * @description Paginated list of findings with independent exposure, task identity, answer match, and temporal dimensions. Rejected and unresolved claims are included.
         */
        get: operations["list_findings_api_v1_investigations__investigation_id__findings_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/investigations/{investigation_id}/reports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create frozen report export
         * @description Freeze findings, reviewer decisions, policy and scope into an immutable versioned report.
         */
        post: operations["create_report_api_v1_investigations__investigation_id__reports_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/investigations/{investigation_id}/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Verify discovered candidates
         * @description Run the trusted grader over every not-yet-verified candidate source: task identity first, then answer agreement, then temporal assessment. Idempotent.
         */
        post: operations["verify_investigation_api_v1_investigations__investigation_id__verify_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/policies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create evaluation policy
         * @description Store an immutable evaluation policy version containing source and privacy boundaries.
         */
        post: operations["create_policy_api_v1_policies_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/policies/versions/{version_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get policy version
         * @description Retrieve immutable evaluation policy version details.
         */
        get: operations["get_policy_version_api_v1_policies_versions__version_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/policies/{policy_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get policy entity
         * @description Retrieve parent evaluation policy entity and latest version.
         */
        get: operations["get_policy_api_v1_policies__policy_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reports/{report_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get report export status
         * @description Check export generation status and retrieve authorized download reference.
         */
        get: operations["get_report_api_v1_reports__report_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reports/{report_id}/download": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Download frozen report
         * @description Return the frozen report JSON. Authorization is re-checked on every download.
         */
        get: operations["download_report_api_v1_reports__report_id__download_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/retention/cleanup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Trigger retention cleanup
         * @description Trigger asynchronous retention cleanup and evidence deletion (B5).
         */
        post: operations["cleanup_retention_api_v1_retention_cleanup_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Liveness probe */
        get: operations["health_live_health_live_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Readiness probe */
        get: operations["health_ready_health_ready_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * AdversarialRun
         * @description Detailed execution record for an item in a specific experimental condition.
         */
        AdversarialRun: {
            /**
             * Answer Bearing Content Retrieved
             * @description Whether answer-bearing text was pulled into model context
             * @default unknown
             * @enum {string}
             */
            answer_bearing_content_retrieved: "yes" | "no" | "unknown";
            /**
             * @description Level of causal or observable attribution
             * @default none
             */
            attribution: components["schemas"]["AttributionLevel"];
            /** @description Control, blind, or evaluation-aware */
            condition: components["schemas"]["ExperimentCondition"];
            /**
             * Experiment Id
             * @description Parent experiment ID
             */
            experiment_id: string;
            /**
             * Failure Reason
             * @description Reason if failed or incomplete
             */
            failure_reason?: string | null;
            /**
             * Generated Output
             * @description Attacker model's generated answer text
             */
            generated_output?: string | null;
            /**
             * @description Grading outcome from trusted grading service
             * @default unsupported
             */
            grader_outcome: components["schemas"]["GraderOutcome"];
            /**
             * Item Version Id
             * @description Target item version ID
             */
            item_version_id: string;
            /**
             * Observable Tool Calls
             * @description Observable tool actions
             */
            observable_tool_calls?: components["schemas"]["ObservableToolCall"][];
            /**
             * @description Whether evaluation policy rules were violated
             * @default unknown
             */
            policy_compliance: components["schemas"]["PolicyCompliance"];
            /**
             * Run Id
             * @description Unique run identifier
             */
            run_id: string;
            /** @description Status of the run */
            run_status: components["schemas"]["ExperimentRunStatus"];
            /**
             * Source Discovered
             * @description Whether an external source containing task answers was discovered
             * @default unknown
             * @enum {string}
             */
            source_discovered: "yes" | "no" | "unknown";
        };
        /**
         * AnswerMatch
         * @description Assessment of answer agreement between discovered content and reference.
         * @enum {string}
         */
        AnswerMatch: "exact" | "normalized" | "task_specific" | "mismatch" | "not_applicable";
        /**
         * AttributionLevel
         * @description Degree of attribution observed between retrieval and model output.
         * @enum {string}
         */
        AttributionLevel: "none" | "retrieval_observed" | "use_supported" | "intervention_supported";
        /**
         * BenchmarkImportRequest
         * @description Benchmark creation payload containing items and metadata.
         */
        BenchmarkImportRequest: {
            /**
             * Items
             * @description List of benchmark items to validate and import
             */
            items: components["schemas"]["ItemIntake"][];
            /**
             * Name
             * @description User-friendly name of the benchmark
             */
            name: string;
            /**
             * Workspace Id
             * @description Optional tenant workspace ID; authenticated actor workspace takes precedence
             */
            workspace_id?: string | null;
        };
        /**
         * BenchmarkImportResponse
         * @description Result of benchmark intake validation.
         *
         *     If validation fails for ANY row, status is 'rejected', benchmark_version_id is None,
         *     and row-level errors are provided. The import is strictly atomic.
         */
        BenchmarkImportResponse: {
            /**
             * Benchmark Id
             * @description Parent benchmark ID if accepted
             */
            benchmark_id?: string | null;
            /**
             * Benchmark Version Id
             * @description Created benchmark version ID if accepted, None if rejected
             */
            benchmark_version_id?: string | null;
            /**
             * Errors
             * @description List of validation errors if rejected
             */
            errors?: components["schemas"]["ImportRowError"][];
            /**
             * Status
             * @description Atomic import outcome
             * @enum {string}
             */
            status: "accepted" | "rejected";
            /**
             * Total Rows
             * @description Total rows submitted in the import batch
             */
            total_rows: number;
            /**
             * Valid Rows
             * @description Number of valid rows identified
             */
            valid_rows: number;
        };
        /**
         * BenchmarkRecord
         * @description Parent benchmark entity containing metadata and latest version.
         */
        BenchmarkRecord: {
            /**
             * Benchmark Id
             * @description Benchmark entity ID
             */
            benchmark_id: string;
            /**
             * Created At
             * Format: date-time
             * @description Creation timestamp
             */
            created_at?: string;
            /**
             * Description
             * @description Optional description
             */
            description?: string | null;
            /**
             * Latest Version Id
             * @description Latest benchmark version ID
             */
            latest_version_id?: string | null;
            /**
             * Name
             * @description Benchmark name
             */
            name: string;
            /**
             * Updated At
             * Format: date-time
             * @description Update timestamp
             */
            updated_at?: string;
            /**
             * Version Count
             * @description Number of versions created
             * @default 1
             */
            version_count: number;
            /**
             * Workspace Id
             * @description Tenant workspace ID
             */
            workspace_id: string;
        };
        /**
         * BenchmarkVersion
         * @description Immutable benchmark version representation.
         */
        BenchmarkVersion: {
            /**
             * Benchmark Id
             * @description Parent benchmark entity ID
             * @default
             */
            benchmark_id: string;
            /**
             * Benchmark Version Id
             * @description Unique immutable benchmark version ID
             */
            benchmark_version_id: string;
            /**
             * Created At
             * Format: date-time
             * @description Timestamp of version creation
             */
            created_at?: string;
            /**
             * Item Count
             * @description Total number of items in this version
             */
            item_count: number;
            /**
             * Name
             * @description Benchmark name
             */
            name: string;
            /**
             * Task Types
             * @description Task types in version
             */
            task_types?: components["schemas"]["TaskType"][];
            /**
             * Version Number
             * @description Monotonic version sequence number
             * @default 1
             */
            version_number: number;
            /**
             * Workspace Id
             * @description Tenant workspace ID
             */
            workspace_id: string;
        };
        /** Body_upload_benchmark_file_api_v1_benchmarks_upload_post */
        Body_upload_benchmark_file_api_v1_benchmarks_upload_post: {
            /**
             * File
             * @description CSV or JSON benchmark file
             */
            file: string;
            /**
             * Name
             * @description Benchmark name
             */
            name: string;
        };
        /**
         * ChoiceOption
         * @description Multiple choice option key and text.
         */
        ChoiceOption: {
            /**
             * Id
             * @description Option identifier (e.g., 'A', 'B', '1')
             */
            id: string;
            /**
             * Text
             * @description Text content of the choice option
             */
            text: string;
        };
        /**
         * ClaimStatus
         * @description Status of an individual exposure claim.
         * @enum {string}
         */
        ClaimStatus: "candidate" | "verified" | "rejected" | "needs_review";
        /**
         * DataClassification
         * @description Data classification level for policy and egress control.
         * @enum {string}
         */
        DataClassification: "public" | "synthetic" | "confidential";
        /**
         * ErrorCode
         * @description Standard machine-readable error codes.
         * @enum {string}
         */
        ErrorCode: "validation_failed" | "policy_blocked" | "budget_exhausted" | "provider_unavailable" | "unsupported_grader" | "not_found" | "version_conflict" | "unsupported_task_type" | "forbidden" | "internal_error" | "not_implemented";
        /**
         * ErrorDetail
         * @description Specific detail regarding an error location and reason.
         */
        ErrorDetail: {
            /**
             * Code
             * @description Machine-readable sub-error code
             */
            code: string;
            /**
             * Field
             * @description Field name or parameter causing the error
             */
            field?: string | null;
            /**
             * Message
             * @description Human-readable explanation (never echoing sensitive values)
             */
            message: string;
        };
        /**
         * ErrorResponse
         * @description Standardized API error response body.
         */
        ErrorResponse: {
            /**
             * Details
             * @description List of granular error details
             */
            details?: components["schemas"]["ErrorDetail"][];
            /** @description Machine-readable top-level error code */
            error: components["schemas"]["ErrorCode"];
            /**
             * Message
             * @description Top-level error message
             */
            message: string;
            /**
             * Request Id
             * @description Correlation ID for tracing
             * @default req_default
             */
            request_id: string;
            /**
             * Timestamp
             * Format: date-time
             * @description Timestamp when the error occurred
             */
            timestamp?: string;
        };
        /**
         * EvaluationPolicyCreateRequest
         * @description Payload to create an immutable evaluation policy version.
         */
        EvaluationPolicyCreateRequest: {
            /**
             * Allowed Source Classes
             * @description Permitted source families
             * @default [
             *       "web_search",
             *       "code_repository",
             *       "academic_archive",
             *       "discussion_forum"
             *     ]
             */
            allowed_source_classes: components["schemas"]["SourceFamily"][];
            /**
             * Allowed Tools
             * @description Tools permitted during discovery (e.g. 'search', 'fetch')
             * @default [
             *       "search",
             *       "fetch"
             *     ]
             */
            allowed_tools: string[];
            /**
             * Benchmark Identification Permitted
             * @description Whether investigation prompts may mention the benchmark identity
             * @default false
             */
            benchmark_identification_permitted: boolean;
            /**
             * Cost Ceiling Usd
             * @description Monetary ceiling in USD
             * @default 10
             */
            cost_ceiling_usd: number;
            /**
             * Cutoff Timezone
             * @description Timezone of the evaluation cutoff (e.g. 'UTC', 'America/New_York')
             * @default UTC
             */
            cutoff_timezone: string;
            /**
             * @description Classification of uploaded benchmarks (confidential discovery is policy blocked)
             * @default public
             */
            data_classification: components["schemas"]["DataClassification"];
            /**
             * Deadline Seconds
             * @description Investigation execution deadline
             * @default 900
             */
            deadline_seconds: number;
            /**
             * Evaluation Cutoff
             * Format: date-time
             * @description Evaluation cutoff date and time (ISO-8601)
             */
            evaluation_cutoff: string;
            /**
             * Item Scope
             * @description Specific item IDs in scope, or None for all items in the benchmark
             */
            item_scope?: string[] | null;
            /**
             * Max Concurrent Discovery Tasks
             * @description Max concurrent discovery tasks
             * @default 2
             */
            max_concurrent_discovery_tasks: number;
            /**
             * Max Fetches Per Item
             * @description Max fetched pages per item
             * @default 5
             */
            max_fetches_per_item: number;
            /**
             * Max Queries Per Item
             * @description Max search queries per item
             * @default 3
             */
            max_queries_per_item: number;
            /**
             * Name
             * @description Descriptive policy name
             */
            name: string;
            /**
             * Prohibited Answer Key Access
             * @description Whether accessing published answer keys is strictly prohibited
             * @default true
             */
            prohibited_answer_key_access: boolean;
            /**
             * @description Retention profile for evidence and reports
             * @default pilot_standard_30_90
             */
            retention_profile: components["schemas"]["RetentionProfile"];
            /**
             * Reviewer Identity
             * @description Identity of the auditor/reviewer creating this policy
             */
            reviewer_identity: string;
            /**
             * Workspace Id
             * @description Optional tenant workspace ID; authenticated actor workspace takes precedence
             */
            workspace_id?: string | null;
        };
        /**
         * EvaluationPolicyRecord
         * @description Parent policy entity containing metadata and latest version.
         */
        EvaluationPolicyRecord: {
            /**
             * Created At
             * Format: date-time
             * @description Creation timestamp
             */
            created_at?: string;
            /**
             * Latest Version Id
             * @description Latest policy version ID
             */
            latest_version_id?: string | null;
            /**
             * Name
             * @description Policy name
             */
            name: string;
            /**
             * Policy Id
             * @description Policy entity ID
             */
            policy_id: string;
            /**
             * Updated At
             * Format: date-time
             * @description Update timestamp
             */
            updated_at?: string;
            /**
             * Version Count
             * @description Version count
             * @default 1
             */
            version_count: number;
            /**
             * Workspace Id
             * @description Optional tenant workspace ID; authenticated actor workspace takes precedence
             */
            workspace_id?: string | null;
        };
        /**
         * EvaluationPolicyVersion
         * @description Immutable evaluation policy version record.
         */
        EvaluationPolicyVersion: {
            /**
             * Allowed Source Classes
             * @description Permitted source families
             */
            allowed_source_classes: components["schemas"]["SourceFamily"][];
            /**
             * Allowed Tools
             * @description Permitted tools
             */
            allowed_tools: string[];
            /**
             * Benchmark Identification Permitted
             * @description Permit benchmark identity in search
             */
            benchmark_identification_permitted: boolean;
            /**
             * Cost Ceiling Usd
             * @description Monetary limit in USD
             */
            cost_ceiling_usd: number;
            /**
             * Created At
             * Format: date-time
             * @description Timestamp of policy creation
             */
            created_at?: string;
            /**
             * Cutoff Timezone
             * @description Evaluation cutoff timezone
             * @default UTC
             */
            cutoff_timezone: string;
            /** @description Data classification level */
            data_classification: components["schemas"]["DataClassification"];
            /**
             * Deadline Seconds
             * @description Run deadline in seconds
             */
            deadline_seconds: number;
            /**
             * Evaluation Cutoff
             * Format: date-time
             * @description Evaluation cutoff timestamp
             */
            evaluation_cutoff: string;
            /**
             * Item Scope
             * @description Item scope IDs or None
             */
            item_scope?: string[] | null;
            /**
             * Max Concurrent Discovery Tasks
             * @description Max concurrency
             */
            max_concurrent_discovery_tasks: number;
            /**
             * Max Fetches Per Item
             * @description Max fetches per item
             */
            max_fetches_per_item: number;
            /**
             * Max Queries Per Item
             * @description Max queries per item
             */
            max_queries_per_item: number;
            /**
             * Name
             * @description Policy name
             */
            name: string;
            /**
             * Policy Id
             * @description Parent policy entity ID
             * @default
             */
            policy_id: string;
            /**
             * Policy Version Id
             * @description Unique policy version ID
             */
            policy_version_id: string;
            /**
             * Prohibited Answer Key Access
             * @description Prohibit answer key access
             */
            prohibited_answer_key_access: boolean;
            /** @description Retention schedule profile */
            retention_profile: components["schemas"]["RetentionProfile"];
            /**
             * Reviewer Identity
             * @description Author identity
             */
            reviewer_identity: string;
            /**
             * Version Number
             * @description Version sequence number
             * @default 1
             */
            version_number: number;
            /**
             * Workspace Id
             * @description Optional tenant workspace ID; authenticated actor workspace takes precedence
             */
            workspace_id?: string | null;
        };
        /**
         * EvidenceClaim
         * @description Specific exposure claim asserted for an item.
         */
        EvidenceClaim: {
            /**
             * Claim Id
             * @description Unique claim ID
             */
            claim_id: string;
            /**
             * @description Status of the claim
             * @default candidate
             */
            claim_status: components["schemas"]["ClaimStatus"];
            /** @description Type of exposed benchmark component */
            exposure_type: components["schemas"]["ExposureType"];
            /**
             * Rationale
             * @description Evidence rationale explaining why this claim was generated
             */
            rationale: string;
        };
        /**
         * ExcerptLocator
         * @description Precise location of discovered evidence within a raw snapshot.
         */
        ExcerptLocator: {
            /**
             * Char Offset End
             * @description Character offset end
             */
            char_offset_end?: number | null;
            /**
             * Char Offset Start
             * @description Character offset start
             */
            char_offset_start?: number | null;
            /**
             * Line End
             * @description Ending line number (1-indexed)
             */
            line_end?: number | null;
            /**
             * Line Start
             * @description Starting line number (1-indexed)
             */
            line_start?: number | null;
            /**
             * Selector
             * @description CSS selector or DOM locator if structured document
             */
            selector?: string | null;
        };
        /**
         * ExperimentCondition
         * @description Controlled conditions for attacker experiments.
         * @enum {string}
         */
        ExperimentCondition: "control" | "blind" | "evaluation_aware";
        /**
         * ExperimentConfig
         * @description Immutable pinned configuration for controlled attacker experiments.
         */
        ExperimentConfig: {
            /**
             * Benchmark Version Id
             * @description Target benchmark version ID
             */
            benchmark_version_id: string;
            /**
             * Conditions
             * @description Conditions to execute
             */
            conditions: components["schemas"]["ExperimentCondition"][];
            /**
             * Created At
             * Format: date-time
             * @description Experiment setup timestamp
             */
            created_at?: string;
            /**
             * Experiment Id
             * @description Unique experiment ID
             */
            experiment_id: string;
            /**
             * Generation Settings
             * @description Temperature, max_tokens, etc.
             */
            generation_settings?: {
                [key: string]: unknown;
            };
            /**
             * Grader Version
             * @description Trusted grader version
             * @default grader_v1.0
             */
            grader_version: string;
            /**
             * Investigation Id
             * @description Source investigation ID
             */
            investigation_id: string;
            /**
             * Model Identifier
             * @description Pinned model ID
             */
            model_identifier: string;
            /**
             * Model Revision
             * @description Pinned model snapshot revision
             */
            model_revision?: string | null;
            /**
             * Policy Version Id
             * @description Target policy version ID
             */
            policy_version_id: string;
            /**
             * Prompt Version
             * @description Pinned prompt template version
             * @default prompt_v1.0
             */
            prompt_version: string;
            /**
             * Provider Id
             * @description Pinned provider (e.g. 'anthropic', 'openai')
             */
            provider_id: string;
            /**
             * Reasoning Budget
             * @description Token reasoning budget
             * @default 1000
             */
            reasoning_budget: number;
            /**
             * Repetitions
             * @description Repetitions per item per condition
             * @default 1
             */
            repetitions: number;
            /**
             * Tool Policy
             * @description Allowed tool configuration
             */
            tool_policy?: {
                [key: string]: unknown;
            };
        };
        /**
         * ExperimentCreateRequest
         * @description Payload to configure and launch optional attacker experiments.
         */
        ExperimentCreateRequest: {
            /**
             * Conditions
             * @description Conditions to test
             * @default [
             *       "control",
             *       "blind",
             *       "evaluation_aware"
             *     ]
             */
            conditions: components["schemas"]["ExperimentCondition"][];
            /**
             * Investigation Id
             * @description Investigation ID whose discovery findings are frozen
             */
            investigation_id: string;
            /**
             * Model Identifier
             * @description Pinned model identifier
             */
            model_identifier: string;
            /**
             * Model Revision
             * @description Pinned model revision if available
             */
            model_revision?: string | null;
            /**
             * Prompt Version
             * @description Prompt template version
             * @default prompt_v1.0
             */
            prompt_version: string;
            /**
             * Provider Id
             * @description Pinned LLM provider
             */
            provider_id: string;
            /**
             * Reasoning Budget
             * @description Token budget
             * @default 1000
             */
            reasoning_budget: number;
        };
        /**
         * ExperimentResultsResponse
         * @description Summary and details of completed experiment runs.
         */
        ExperimentResultsResponse: {
            /**
             * Completed Runs Count
             * @description Runs completed cleanly
             */
            completed_runs_count: number;
            /**
             * Correct Answer Count
             * @description Runs graded correct
             */
            correct_answer_count: number;
            /**
             * Experiment Id
             * @description Experiment ID
             */
            experiment_id: string;
            /**
             * Incomplete Runs Count
             * @description Runs interrupted or failed
             */
            incomplete_runs_count: number;
            /**
             * Prohibited Retrieval Count
             * @description Runs with prohibited retrieval observed
             */
            prohibited_retrieval_count: number;
            /**
             * Runs
             * @description Run records
             */
            runs?: components["schemas"]["AdversarialRun"][];
        };
        /**
         * ExperimentRunStatus
         * @description Execution status of an individual experimental run.
         * @enum {string}
         */
        ExperimentRunStatus: "not_requested" | "queued" | "running" | "completed" | "failed" | "cancelled" | "policy_blocked" | "budget_exhausted" | "incomplete";
        /**
         * ExposureType
         * @description Independent exposure claim types.
         * @enum {string}
         */
        ExposureType: "metadata" | "question_context" | "worked_solution" | "reference_answer";
        /**
         * FindingListResponse
         * @description Paginated list of findings.
         */
        FindingListResponse: {
            /**
             * Items
             * @description Findings on current page
             */
            items?: components["schemas"]["FindingView"][];
            /**
             * Page
             * @description 1-indexed current page
             * @default 1
             */
            page: number;
            /**
             * Size
             * @description Items per page
             * @default 20
             */
            size: number;
            /**
             * Total
             * @description Total findings matching query
             */
            total: number;
        };
        /**
         * FindingView
         * @description Public read model for an audited finding with independent dimensions.
         */
        FindingView: {
            /** @description Exposure claim */
            claim: components["schemas"]["EvidenceClaim"];
            /**
             * Created At
             * Format: date-time
             * @description Finding creation timestamp
             */
            created_at?: string;
            /**
             * Current Reviewer Decision
             * @description Latest human decision: confirm, reject, or request_more_evidence
             */
            current_reviewer_decision?: string | null;
            /**
             * External Id
             * @description External item identifier
             */
            external_id: string;
            /**
             * Finding Id
             * @description Finding identifier
             */
            finding_id: string;
            /**
             * Investigation Id
             * @description Parent investigation ID
             */
            investigation_id: string;
            /**
             * Item Version Id
             * @description Item version ID
             */
            item_version_id: string;
            /** @description Supporting source evidence snapshot */
            snapshot: components["schemas"]["SourceSnapshot"];
            /** @description Temporal assessment */
            temporal: components["schemas"]["TemporalAssessment"];
            /**
             * Updated At
             * Format: date-time
             * @description Last update timestamp
             */
            updated_at?: string;
            /** @description Task identity and answer agreement */
            verification: components["schemas"]["VerificationResult"];
            /**
             * Version
             * @description Optimistic concurrency version for reviewer updates
             * @default 1
             */
            version: number;
        };
        /**
         * GraderOutcome
         * @description Outcome of grading an attacker experiment model output.
         * @enum {string}
         */
        GraderOutcome: "correct" | "incorrect" | "unsupported" | "error";
        /**
         * ImportRowError
         * @description Detailed validation error for a single row in an import batch.
         *
         *     CRITICAL: Error messages and details MUST NEVER echo or format the protected gold answer.
         */
        ImportRowError: {
            /**
             * Error Code
             * @description Machine-readable error identifier
             */
            error_code: string;
            /**
             * Field
             * @description Field name containing the error (e.g. 'gold_answer', 'choices')
             */
            field: string;
            /**
             * Message
             * @description Human-readable description without sensitive answer data
             */
            message: string;
            /**
             * Row Number
             * @description 1-indexed row number where the error occurred
             */
            row_number: number;
        };
        /**
         * InvestigationBudgets
         * @description Resource budget tracking for an investigation.
         */
        InvestigationBudgets: {
            /**
             * Cost Ceiling Usd
             * @description Monetary spending limit in USD
             */
            cost_ceiling_usd: number;
            /**
             * Deadline Seconds
             * @description Investigation run timeout in seconds
             */
            deadline_seconds: number;
            /**
             * Max Fetches
             * @description Maximum page fetches permitted across all items
             */
            max_fetches: number;
            /**
             * Max Queries
             * @description Maximum search queries permitted across all items
             */
            max_queries: number;
            /**
             * Used Cost Usd
             * @description Total provider spend incurred in USD
             * @default 0
             */
            used_cost_usd: number;
            /**
             * Used Fetches
             * @description Page fetches executed to date
             * @default 0
             */
            used_fetches: number;
            /**
             * Used Queries
             * @description Search queries executed to date
             * @default 0
             */
            used_queries: number;
        };
        /**
         * InvestigationCancelRequest
         * @description Payload to request idempotent investigation cancellation.
         */
        InvestigationCancelRequest: {
            /**
             * Reason
             * @description Explanation for cancellation
             */
            reason: string;
        };
        /**
         * InvestigationCancelResponse
         * @description Response confirming investigation cancellation request.
         */
        InvestigationCancelResponse: {
            /**
             * Cancelled At
             * Format: date-time
             * @description Cancellation timestamp
             */
            cancelled_at?: string;
            /**
             * Investigation Id
             * @description Investigation identifier
             */
            investigation_id: string;
            /**
             * Message
             * @description Cancellation confirmation message
             */
            message: string;
            /** @description Updated investigation status */
            status: components["schemas"]["InvestigationStatus"];
        };
        /**
         * InvestigationCreateRequest
         * @description Payload to launch a new benchmark exposure investigation.
         */
        InvestigationCreateRequest: {
            /**
             * Benchmark Version Id
             * @description Immutable benchmark version to audit
             */
            benchmark_version_id: string;
            /**
             * Policy Version Id
             * @description Immutable evaluation policy version to apply
             */
            policy_version_id: string;
            /**
             * Workspace Id
             * @description Tenant workspace ID
             */
            workspace_id: string;
        };
        /**
         * InvestigationLimitations
         * @description Operational and coverage limitations encountered during discovery.
         */
        InvestigationLimitations: {
            /**
             * Inaccessible Sources
             * @description URLs that returned 403/404/timeout
             */
            inaccessible_sources?: string[];
            /**
             * Provider Outages
             * @description Provider errors encountered
             */
            provider_outages?: string[];
            /**
             * Scope Limitations
             * @description Coverage caveat notes
             */
            scope_limitations?: string[];
        };
        /**
         * InvestigationStatus
         * @description Lifecycle states of an investigation orchestrator.
         * @enum {string}
         */
        InvestigationStatus: "queued" | "validating" | "discovering" | "verifying" | "awaiting_review" | "completed" | "failed" | "cancelled" | "policy_blocked" | "budget_exhausted";
        /**
         * InvestigationStatusResponse
         * @description Public read model for investigation status.
         */
        InvestigationStatusResponse: {
            /** @description Budget snapshot */
            budgets: components["schemas"]["InvestigationBudgets"];
            /**
             * Created At
             * Format: date-time
             * @description Investigation start time
             */
            created_at: string;
            /**
             * Findings Count
             * @description Number of findings discovered so far
             * @default 0
             */
            findings_count: number;
            /**
             * Investigated Items
             * @description Items completed so far
             */
            investigated_items: number;
            /**
             * Investigation Id
             * @description Investigation identifier
             */
            investigation_id: string;
            /**
             * Is Partial
             * @description Whether investigation is marked as partial coverage
             */
            is_partial: boolean;
            /** @description Limitations encountered */
            limitations: components["schemas"]["InvestigationLimitations"];
            /** @description Current status */
            status: components["schemas"]["InvestigationStatus"];
            /**
             * Total Items
             * @description Total items in scope
             */
            total_items: number;
            /**
             * Updated At
             * Format: date-time
             * @description Last updated time
             */
            updated_at: string;
        };
        /**
         * ItemIntake
         * @description Raw item ingestion schema containing protected answers.
         *
         *     This model is restricted to the trusted intake and gold-vault storage boundary.
         *     It MUST NEVER be returned directly in public API response endpoints.
         *     Extra fields are forbidden to prevent untyped data injection.
         */
        ItemIntake: {
            /**
             * Choices
             * @description Ordered options for multiple-choice tasks
             */
            choices?: components["schemas"]["ChoiceOption"][] | null;
            /**
             * External Id
             * @description External item identifier
             */
            external_id: string;
            /**
             * Gold Answer
             * @description Protected reference answer text or choice ID
             */
            gold_answer: string;
            /** @description Allowlisted public metadata only; arbitrary or protected metadata is forbidden */
            metadata?: components["schemas"]["PublicItemMetadata"];
            /**
             * Question
             * @description Question prompt text
             */
            question: string;
            /** @description Supported benchmark task type */
            task_type: components["schemas"]["TaskType"];
        };
        /**
         * ItemVersion
         * @description Immutable benchmark item representation for public/releasable operations.
         *
         *     Protected gold answers and grading rubrics are strictly excluded.
         *     Binds to an exact immutable gold reference via gold_binding_version.
         */
        ItemVersion: {
            /**
             * Answer Revision Id
             * @description Opaque random answer revision identifier allocated by persistence layer
             */
            answer_revision_id: string;
            /**
             * Benchmark Version Id
             * @description Parent benchmark version ID
             */
            benchmark_version_id: string;
            /**
             * Choices
             * @description Ordered options for multiple-choice tasks
             */
            choices?: components["schemas"]["ChoiceOption"][] | null;
            /**
             * External Id
             * @description User-supplied external item ID
             */
            external_id: string;
            /**
             * Item Version Id
             * @description Unique immutable item version ID
             */
            item_version_id: string;
            /** @description Allowlisted, typed public metadata */
            metadata?: components["schemas"]["PublicItemMetadata"];
            /**
             * Question
             * @description Question prompt text
             */
            question: string;
            /** @description Task type of the benchmark item */
            task_type: components["schemas"]["TaskType"];
        };
        /**
         * ItemVersionListResponse
         * @description Paginated list of item versions for an authorized benchmark version.
         */
        ItemVersionListResponse: {
            /**
             * Has More
             * @description Whether subsequent pages exist
             */
            has_more: boolean;
            /**
             * Items
             * @description Page of public item versions
             */
            items: components["schemas"]["ItemVersion"][];
            /**
             * Page
             * @description 1-indexed current page
             * @default 1
             */
            page: number;
            /**
             * Page Size
             * @description Items per page
             * @default 50
             */
            page_size: number;
            /**
             * Total Count
             * @description Total item count in version
             */
            total_count: number;
        };
        /**
         * ObservableToolCall
         * @description Observable tool action recorded during an experimental run.
         *
         *     BenchShield records observable external tool actions rather than speculative internal reasoning.
         */
        ObservableToolCall: {
            /**
             * Observed At
             * Format: date-time
             * @description Observation timestamp
             */
            observed_at?: string;
            /**
             * Query Or Action
             * @description Action parameters (e.g. search keywords or URL)
             */
            query_or_action: string;
            /**
             * Response Summary
             * @description Sanitized summary of tool response
             */
            response_summary: string;
            /**
             * Tool Name
             * @description Name of the invoked tool (e.g. 'web_search', 'fetch_page')
             */
            tool_name: string;
        };
        /**
         * PolicyCompliance
         * @description Policy compliance result for an experiment run.
         * @enum {string}
         */
        PolicyCompliance: "permitted" | "violated" | "unknown";
        /**
         * PublicItemMetadata
         * @description Allowlisted, strictly typed public item metadata.
         *
         *     CRITICAL BOUNDARY: Extra/arbitrary fields are strictly forbidden to prevent
         *     accidental leaking of protected answers, vault keys, or internal annotations.
         */
        PublicItemMetadata: {
            /**
             * Difficulty
             * @description Nominal difficulty rating
             */
            difficulty?: string | null;
            /**
             * Domain
             * @description Subject domain of the item (e.g. 'chemistry', 'navigation')
             */
            domain?: string | null;
            /**
             * License
             * @description Content license identifier
             */
            license?: string | null;
            /**
             * Source Reference
             * @description Non-confidential source origin citation
             */
            source_reference?: string | null;
            /**
             * Tags
             * @description Allowlisted categorization tags
             */
            tags?: string[];
        };
        /**
         * ReportCreateRequest
         * @description Payload to trigger asynchronous frozen report generation.
         */
        ReportCreateRequest: {
            /**
             * Investigation Id
             * @description Target completed investigation ID
             */
            investigation_id: string;
        };
        /**
         * ReportStatus
         * @description Status of an asynchronous report generation job.
         * @enum {string}
         */
        ReportStatus: "queued" | "generating" | "completed" | "failed";
        /**
         * ReportStatusResponse
         * @description Status check response for an asynchronous report export job.
         */
        ReportStatusResponse: {
            /**
             * Authorized Until
             * @description Download expiration timestamp if completed
             */
            authorized_until?: string | null;
            /**
             * Download Url
             * @description Signed download URL if completed
             */
            download_url?: string | null;
            /**
             * Report Id
             * @description Report job identifier
             */
            report_id: string;
            /**
             * Report Version
             * @description Report version label
             */
            report_version: string;
            /** @description Current export status */
            status: components["schemas"]["ReportStatus"];
        };
        /**
         * RetentionProfile
         * @description Retention schedule profiles.
         * @enum {string}
         */
        RetentionProfile: "pilot_standard_30_90" | "custom" | "immediate_deletion";
        /**
         * ReviewAction
         * @description Action taken by a human reviewer on a finding.
         * @enum {string}
         */
        ReviewAction: "confirm" | "reject" | "request_more_evidence";
        /**
         * ReviewCreateRequest
         * @description Payload to record a human reviewer adjudication decision.
         *
         *     Includes expected_version for optimistic concurrency conflict detection.
         */
        ReviewCreateRequest: {
            /** @description Adjudication decision: confirm, reject, or request_more_evidence */
            action: components["schemas"]["ReviewAction"];
            /**
             * Expected Version
             * @description Expected current finding version
             */
            expected_version: number;
            /**
             * Reason
             * @description Explanation for decision (required for auditability)
             */
            reason: string;
        };
        /**
         * ReviewDecision
         * @description Immutable audit record of a reviewer decision.
         */
        ReviewDecision: {
            /** @description Adjudication decision */
            action: components["schemas"]["ReviewAction"];
            /**
             * Decision Id
             * @description Unique decision ID
             */
            decision_id: string;
            /**
             * Expected Version
             * @description Finding version before this decision
             */
            expected_version: number;
            /**
             * Finding Id
             * @description Target finding ID
             */
            finding_id: string;
            /**
             * New Version
             * @description Finding version after this decision
             */
            new_version: number;
            /**
             * Reason
             * @description Auditable rationale for the decision
             */
            reason: string;
            /**
             * Reviewed At
             * Format: date-time
             * @description Timestamp of review
             */
            reviewed_at?: string;
            /**
             * Reviewer Id
             * @description Identity of the human reviewer
             */
            reviewer_id: string;
        };
        /**
         * ReviewHistoryResponse
         * @description Append-only audit trail of human reviewer decisions for a finding.
         */
        ReviewHistoryResponse: {
            /**
             * Decisions
             * @description Historical decisions in chronological order
             */
            decisions?: components["schemas"]["ReviewDecision"][];
            /**
             * Finding Id
             * @description Finding identifier
             */
            finding_id: string;
        };
        /**
         * SnapshotAvailability
         * @description Current availability status of an evidence snapshot.
         * @enum {string}
         */
        SnapshotAvailability: "available" | "inaccessible" | "restricted" | "expired";
        /**
         * SourceFamily
         * @description Category of the source where evidence was discovered.
         * @enum {string}
         */
        SourceFamily: "web_search" | "code_repository" | "academic_archive" | "discussion_forum" | "other";
        /**
         * SourceSnapshot
         * @description Immutable evidence snapshot reference.
         */
        SourceSnapshot: {
            /**
             * Access Limitations
             * @description Access restrictions or limitations
             */
            access_limitations?: string[];
            /**
             * @description Current availability status of the snapshot
             * @default available
             */
            availability: components["schemas"]["SnapshotAvailability"];
            /**
             * Content Hash
             * @description SHA-256 hash of the raw captured content
             */
            content_hash: string;
            /** @description Precise excerpt locator */
            excerpt_locator?: components["schemas"]["ExcerptLocator"] | null;
            /**
             * Extraction Version
             * @description Version of the text extraction pipeline
             * @default extract_v1.0
             */
            extraction_version: string;
            /**
             * Final Url
             * @description Final landing URL retrieved
             */
            final_url: string;
            /**
             * Media Type
             * @description MIME media type
             * @default text/html
             */
            media_type: string;
            /**
             * Raw Content Preview
             * @description Bounded excerpt of the permitted raw content
             */
            raw_content_preview?: string | null;
            /**
             * Redirect Chain
             * @description Ordered list of intermediate redirect URLs
             */
            redirect_chain?: string[];
            /**
             * Retrieved At
             * Format: date-time
             * @description Timestamp when content was retrieved
             */
            retrieved_at?: string;
            /**
             * Snapshot Id
             * @description Unique evidence snapshot ID
             */
            snapshot_id: string;
            /** @description Family of the source */
            source_family: components["schemas"]["SourceFamily"];
            /**
             * Source Url
             * @description Initial candidate URL requested
             */
            source_url: string;
        };
        /**
         * TaskIdentity
         * @description Assessment of whether discovered content represents the same evaluation task.
         * @enum {string}
         */
        TaskIdentity: "exact" | "equivalent" | "ambiguous" | "different";
        /**
         * TaskType
         * @description Task types supported by BenchShield.
         * @enum {string}
         */
        TaskType: "exact_short_answer" | "multiple_choice" | "code_execution" | "open_ended" | "rubric_evaluation" | "image_multimodal";
        /**
         * TemporalAssessment
         * @description Independent temporal classification and supporting timestamps.
         *
         *     A post-cutoff observation does not prove pre-cutoff absence, and missing dates stay unknown.
         */
        TemporalAssessment: {
            /**
             * Archive Capture Time
             * @description Wayback Machine / Web Archive snapshot timestamp
             */
            archive_capture_time?: string | null;
            /**
             * Asserted Publication Time
             * @description Unverified publication timestamp displayed by page
             */
            asserted_publication_time?: string | null;
            /**
             * Assessment Id
             * @description Assessment record ID
             */
            assessment_id: string;
            /**
             * Commit Time
             * @description Git commit timestamp if source is a repository
             */
            commit_time?: string | null;
            /**
             * Retrieval Time
             * Format: date-time
             * @description Timestamp when the source was fetched
             */
            retrieval_time?: string;
            /**
             * Supporting Evidence Note
             * @description Provenance of temporal verification
             */
            supporting_evidence_note?: string | null;
            /**
             * @description Temporal relationship to benchmark cutoff
             * @default unknown
             */
            temporal_status: components["schemas"]["TemporalStatus"];
            /**
             * Verified Introduction Time
             * @description Proven earliest public introduction time
             */
            verified_introduction_time?: string | null;
        };
        /**
         * TemporalStatus
         * @description Temporal relationship of discovered evidence to the benchmark cutoff.
         * @enum {string}
         */
        TemporalStatus: "verified_pre_cutoff" | "observed_post_cutoff" | "verified_introduced_post_cutoff" | "unknown";
        /**
         * VerificationResult
         * @description Assessment of task identity and answer agreement.
         *
         *     Task identity must be established before answer agreement.
         */
        VerificationResult: {
            /** @description Correspondence of answer agreement */
            answer_match: components["schemas"]["AnswerMatch"];
            /**
             * Explanation
             * @description Granular explanation of verification determination
             */
            explanation: string;
            /**
             * Grader Version
             * @description Version of trusted verification grader
             * @default grader_v1.0
             */
            grader_version: string;
            /**
             * Normalization Version
             * @description Version of normalization algorithm
             * @default norm_v1.0
             */
            normalization_version: string;
            /** @description Correspondence of task/question identity */
            task_identity: components["schemas"]["TaskIdentity"];
            /**
             * Verification Id
             * @description Verification record ID
             */
            verification_id: string;
        };
        /**
         * VerificationRunResponse
         * @description Result of running the trusted grader over an investigation's candidates.
         */
        VerificationRunResponse: {
            /**
             * Claim Status Counts
             * @description Total findings per claim status after this run
             */
            claim_status_counts?: {
                [key: string]: number;
            };
            /**
             * Findings Created
             * @description New findings created in this run
             */
            findings_created: number;
            /**
             * Grader Version
             * @description Grader version applied
             */
            grader_version: string;
            /**
             * Investigation Id
             * @description Investigation ID
             */
            investigation_id: string;
            /**
             * Normalization Version
             * @description Normalization version applied
             */
            normalization_version: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    import_benchmark_api_v1_benchmarks_post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional client idempotency key */
                "Idempotency-Key"?: string | null;
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BenchmarkImportRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BenchmarkImportResponse"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    upload_benchmark_file_api_v1_benchmarks_upload_post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional client idempotency key */
                "Idempotency-Key"?: string | null;
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_upload_benchmark_file_api_v1_benchmarks_upload_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BenchmarkImportResponse"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_benchmark_version_api_v1_benchmarks_versions__version_id__get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path: {
                version_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BenchmarkVersion"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    list_benchmark_items_api_v1_benchmarks_versions__version_id__items_get: {
        parameters: {
            query?: {
                /** @description Page number */
                page?: number;
                /** @description Items per page */
                page_size?: number;
            };
            header?: {
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path: {
                version_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ItemVersionListResponse"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_benchmark_api_v1_benchmarks__benchmark_id__get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path: {
                benchmark_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BenchmarkRecord"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_experiment_api_v1_experiments__experiment_id__get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path: {
                experiment_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExperimentResultsResponse"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_finding_api_v1_findings__finding_id__get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path: {
                finding_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FindingView"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_review_history_api_v1_findings__finding_id__reviews_get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path: {
                finding_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReviewHistoryResponse"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    submit_review_api_v1_findings__finding_id__reviews_post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path: {
                finding_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReviewCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReviewDecision"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    launch_investigation_api_v1_investigations_post: {
        parameters: {
            query?: never;
            header: {
                /** @description Unique client idempotency key */
                "Idempotency-Key": string;
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InvestigationCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvestigationStatusResponse"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_investigation_api_v1_investigations__investigation_id__get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path: {
                investigation_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvestigationStatusResponse"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    cancel_investigation_api_v1_investigations__investigation_id__cancel_post: {
        parameters: {
            query?: never;
            header?: {
                "Idempotency-Key"?: string | null;
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path: {
                investigation_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InvestigationCancelRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvestigationCancelResponse"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_investigation_events_api_v1_investigations__investigation_id__events_get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Reconnect cursor ID */
                "Last-Event-ID"?: string | null;
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path: {
                investigation_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Authenticated Server-Sent Events stream emitting real-time progress events. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                    "text/event-stream": string;
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Investigation not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Cursor expired (snapshot refresh required) */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    launch_experiment_api_v1_investigations__investigation_id__experiments_post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path: {
                investigation_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExperimentCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExperimentConfig"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    list_findings_api_v1_investigations__investigation_id__findings_get: {
        parameters: {
            query?: {
                /** @description Page number */
                page?: number;
                /** @description Items per page */
                size?: number;
                /** @description Filter by exposure type */
                exposure_type?: components["schemas"]["ExposureType"] | null;
                /** @description Filter by temporal status */
                temporal_status?: components["schemas"]["TemporalStatus"] | null;
                /** @description Filter by claim status */
                claim_status?: components["schemas"]["ClaimStatus"] | null;
            };
            header?: {
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path: {
                investigation_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FindingListResponse"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    create_report_api_v1_investigations__investigation_id__reports_post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path: {
                investigation_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReportCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportStatusResponse"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    verify_investigation_api_v1_investigations__investigation_id__verify_post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path: {
                investigation_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VerificationRunResponse"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    create_policy_api_v1_policies_post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EvaluationPolicyCreateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EvaluationPolicyVersion"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_policy_version_api_v1_policies_versions__version_id__get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path: {
                version_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EvaluationPolicyVersion"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_policy_api_v1_policies__policy_id__get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path: {
                policy_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EvaluationPolicyRecord"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_report_api_v1_reports__report_id__get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path: {
                report_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportStatusResponse"];
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    download_report_api_v1_reports__report_id__download_get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Active workspace ID */
                "X-Workspace-ID"?: string | null;
                /** @description Bearer <JWT> */
                authorization?: string | null;
            };
            path: {
                report_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    cleanup_retention_api_v1_retention_cleanup_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    health_live_health_live_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    health_ready_health_ready_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation error */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Forbidden or policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Version or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unprocessable entity validation error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Operation deferred to subsequent implementation phase */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
}
