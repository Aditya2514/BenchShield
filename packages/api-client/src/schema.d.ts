/* DO NOT EDIT - AUTOMATICALLY GENERATED FROM docs/contracts/openapi.yaml */

export interface paths {
    "/benchmarks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Import benchmark items
         * @description Validates benchmark CSV/JSON and stores immutable benchmark and item versions. Never returns gold answers.
         */
        post: operations["importBenchmark"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/policies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create immutable evaluation policy
         * @description Defines allowed sources, cutoff date/timezone, and privacy constraints.
         */
        post: operations["createPolicy"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/investigations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Launch an exposure investigation
         * @description Dispatches investigation orchestrator. Requires Idempotency-Key.
         */
        post: operations["launchInvestigation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/investigations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get investigation status and summary */
        get: operations["getInvestigation"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/investigations/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancel an investigation */
        post: operations["cancelInvestigation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/investigations/{id}/findings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get independent exposure findings */
        get: operations["getFindings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/findings/{id}/reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Append review decision with optimistic concurrency */
        post: operations["appendReviewDecision"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/investigations/{id}/experiments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List optional controlled experiments */
        get: operations["listExperiments"];
        put?: never;
        /** Create pinned optional attacker experiment */
        post: operations["createExperiment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/investigations/{id}/reports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Freeze report inputs and trigger report generation */
        post: operations["createReport"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/reports/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get report export status and download link */
        get: operations["getReport"];
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
        BenchmarkImportRequest: {
            benchmark_name: string;
            /**
             * @default json
             * @enum {string}
             */
            format: "csv" | "json";
            items: {
                item_id: string;
                question: string;
                options?: string[];
                /** @description Protected gold answer uploaded in memory for vault ingestion; never returned in responses. */
                reference_answer?: string;
            }[];
        };
        BenchmarkImportResponse: {
            benchmark_version_id: string;
            benchmark_name: string;
            total_rows: number;
            valid_rows: number;
            invalid_rows: number;
            row_errors: components["schemas"]["RowError"][];
        };
        RowError: {
            row_number: number;
            item_id: string;
            error_code: string;
            message: string;
        };
        PolicyCreateRequest: {
            /** Format: date */
            cutoff_date: string;
            /** @example UTC */
            timezone: string;
            allowed_source_classes: ("repository" | "research_web" | "conditional_mirror")[];
            prohibited_answer_key_access: boolean;
            benchmark_identification_permitted: boolean;
            budget_ceilings: components["schemas"]["BudgetCeilings"];
            reviewer_id: string;
        };
        PolicyResponse: {
            policy_version_id: string;
            cutoff_date: string;
            timezone: string;
            allowed_source_classes: string[];
            prohibited_answer_key_access: boolean;
            benchmark_identification_permitted: boolean;
            budget_ceilings: components["schemas"]["BudgetCeilings"];
            reviewer_id: string;
            /** Format: date-time */
            created_at: string;
            immutable: boolean;
        };
        BudgetCeilings: {
            max_search_queries_per_item: number;
            max_fetched_pages_per_item: number;
            max_deadline_seconds: number;
            monetary_ceiling_usd: number;
        };
        InvestigationLaunchRequest: {
            benchmark_version_id: string;
            policy_version_id: string;
        };
        InvestigationResponse: {
            id: string;
            benchmark_version_id: string;
            policy_version_id: string;
            /** @enum {string} */
            state: "queued" | "validating" | "discovering" | "verifying" | "awaiting_review" | "completed" | "failed" | "cancelled" | "policy_blocked" | "budget_exhausted";
            partial_coverage: boolean;
            coverage_limitations: string[];
            counts: {
                total_items: number;
                processed_items: number;
                candidate_findings: number;
                verified_findings: number;
            };
            budget_usage: {
                queries_executed: number;
                pages_fetched: number;
                spend_usd: number;
            };
            failure_reason?: string;
        };
        FindingItem: {
            id: string;
            investigation_id: string;
            item_id: string;
            item_version_id: string;
            /** @enum {string} */
            claim_status: "candidate" | "verified" | "rejected" | "needs_review";
            /** @enum {string} */
            exposure_dimension: "metadata" | "question_context" | "worked_solution" | "reference_answer";
            /** @enum {string} */
            task_identity: "exact" | "equivalent" | "ambiguous" | "different";
            /** @enum {string} */
            answer_match: "exact" | "normalized" | "task_specific" | "mismatch" | "not_applicable";
            /** @enum {string} */
            temporal_status: "verified_pre_cutoff" | "observed_post_cutoff" | "verified_introduced_post_cutoff" | "unknown";
            /** @enum {string} */
            attribution: "none" | "retrieval_observed" | "use_supported" | "intervention_supported";
            /** @enum {string} */
            policy_compliance: "permitted" | "violated" | "unknown";
            evidence: components["schemas"]["EvidenceSnapshot"];
            review_decision?: {
                /** @enum {string} */
                action?: "confirmed" | "rejected" | "needs_more_evidence";
                reason?: string;
                /** Format: date-time */
                reviewed_at?: string;
                reviewer_id?: string;
            };
            version: number;
        };
        EvidenceSnapshot: {
            snapshot_id: string;
            source_url: string;
            /** Format: date-time */
            retrieval_time: string;
            content_hash: string;
            /** @description Untrusted raw text excerpt. Must be rendered as escaped plain text only. */
            excerpt_text: string;
        };
        FindingsListResponse: {
            items: components["schemas"]["FindingItem"][];
            total: number;
            page: number;
            limit: number;
        };
        ReviewDecisionRequest: {
            expected_version: number;
            /** @enum {string} */
            action: "confirmed" | "rejected" | "needs_more_evidence";
            reason: string;
            reviewer_id: string;
        };
        ExperimentItem: {
            experiment_id: string;
            investigation_id: string;
            /** @enum {string} */
            condition: "control" | "blind" | "evaluation_aware";
            model_identifier: string;
            model_revision: string;
            /** @enum {string} */
            status: "queued" | "running" | "completed" | "failed" | "cancelled" | "policy_blocked" | "budget_exhausted";
            completed_run_count: number;
            incomplete_run_count: number;
            correct_answer_count: number;
            prohibited_retrieval_count: number;
            /** @enum {string} */
            attribution_strength: "none" | "retrieval_observed" | "use_supported" | "intervention_supported";
            trajectories: {
                run_id: string;
                status: string;
                observable_tool_calls: string[];
                /** @enum {string} */
                grader_outcome: "correct" | "incorrect" | "unsupported" | "error";
            }[];
        };
        ExperimentListResponse: {
            items: components["schemas"]["ExperimentItem"][];
        };
        ExperimentCreateRequest: {
            /** @enum {string} */
            condition: "control" | "blind" | "evaluation_aware";
            model_identifier: string;
            model_revision: string;
        };
        ReportResponse: {
            report_id: string;
            investigation_id: string;
            /** @enum {string} */
            status: "queued" | "generating" | "completed" | "failed";
            report_version_id?: string;
            /** Format: date-time */
            frozen_at?: string;
            download_url?: string;
            /** Format: date-time */
            download_expires_at?: string;
            reviewer_decisions_count?: number;
            unresolved_claims_count?: number;
            limitations?: string[];
            error_code?: string;
        };
        ErrorResponse: {
            /** @enum {string} */
            error_code: "validation_failed" | "policy_blocked" | "budget_exhausted" | "provider_unavailable" | "unsupported_grader" | "not_found" | "version_conflict" | "export_failed";
            message: string;
            details?: {
                [key: string]: unknown;
            };
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
    importBenchmark: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BenchmarkImportRequest"];
            };
        };
        responses: {
            /** @description Benchmark import processed */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BenchmarkImportResponse"];
                };
            };
            /** @description Validation failed with row errors */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    createPolicy: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PolicyCreateRequest"];
            };
        };
        responses: {
            /** @description Policy created successfully */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PolicyResponse"];
                };
            };
            /** @description Invalid policy configuration */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    launchInvestigation: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InvestigationLaunchRequest"];
            };
        };
        responses: {
            /** @description Investigation accepted */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvestigationResponse"];
                };
            };
            /** @description Launch validation failure */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Policy blocked */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getInvestigation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Investigation status details */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvestigationResponse"];
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
        };
    };
    cancelInvestigation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Cancellation processed */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvestigationResponse"];
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
        };
    };
    getFindings: {
        parameters: {
            query?: {
                page?: number;
                limit?: number;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Paginated findings list */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FindingsListResponse"];
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
        };
    };
    appendReviewDecision: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReviewDecisionRequest"];
            };
        };
        responses: {
            /** @description Review decision recorded */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FindingItem"];
                };
            };
            /** @description Version conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    listExperiments: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description List of experiments */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExperimentListResponse"];
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
        };
    };
    createExperiment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExperimentCreateRequest"];
            };
        };
        responses: {
            /** @description Experiment queued */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExperimentItem"];
                };
            };
            /** @description Invalid experiment configuration */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    createReport: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Report generation started */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportResponse"];
                };
            };
            /** @description Report generation precondition failed */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getReport: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Report status and reference */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReportResponse"];
                };
            };
            /** @description Report not found */
            404: {
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
