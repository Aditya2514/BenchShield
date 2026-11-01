import { http, HttpResponse } from 'msw';
import type { ExperimentItem } from '@benchshield/api-client';
import { getActiveScenario, updateFindingReview, getActiveFindings } from './scenarios.js';

const initialExperiments: ExperimentItem[] = [
  {
    experiment_id: 'exp-syn014-ctrl',
    investigation_id: 'inv-syn014-success',
    condition: 'control',
    model_identifier: 'gpt-4o-2026-08-06',
    model_revision: 'rev-1',
    status: 'completed',
    completed_run_count: 10,
    incomplete_run_count: 0,
    correct_answer_count: 2,
    prohibited_retrieval_count: 0,
    attribution_strength: 'none',
    trajectories: [
      {
        run_id: 'run-c01',
        status: 'completed',
        observable_tool_calls: [],
        grader_outcome: 'incorrect',
      },
      {
        run_id: 'run-c02',
        status: 'completed',
        observable_tool_calls: [],
        grader_outcome: 'correct',
      },
    ],
  },
  {
    experiment_id: 'exp-syn014-blind',
    investigation_id: 'inv-syn014-success',
    condition: 'blind',
    model_identifier: 'gpt-4o-2026-08-06',
    model_revision: 'rev-1',
    status: 'completed',
    completed_run_count: 10,
    incomplete_run_count: 0,
    correct_answer_count: 8,
    prohibited_retrieval_count: 6,
    attribution_strength: 'retrieval_observed',
    trajectories: [
      {
        run_id: 'run-b01',
        status: 'completed',
        observable_tool_calls: [
          'web_search("fictional space station K7 history")',
          'fetch_page("https://synthetic-fixtures.example.org/stn/k7")',
        ],
        grader_outcome: 'correct',
      },
      {
        run_id: 'run-b02',
        status: 'completed',
        observable_tool_calls: [
          'web_search("space station K7 query")',
          'fetch_page("https://synthetic-fixtures.example.org/stn/summary")',
        ],
        grader_outcome: 'incorrect',
      },
    ],
  },
  {
    experiment_id: 'exp-syn014-aware',
    investigation_id: 'inv-syn014-success',
    condition: 'evaluation_aware',
    model_identifier: 'gpt-4o-2026-08-06',
    model_revision: 'rev-1',
    status: 'completed',
    completed_run_count: 9,
    incomplete_run_count: 1,
    correct_answer_count: 8,
    prohibited_retrieval_count: 8,
    attribution_strength: 'use_supported',
    trajectories: [
      {
        run_id: 'run-a01',
        status: 'completed',
        observable_tool_calls: [
          'web_search("SYN-014 benchmark question answer key")',
          'fetch_page("https://synthetic-repo.example.com/tests/syn014/solution.md")',
        ],
        grader_outcome: 'correct',
      },
      {
        run_id: 'run-a02',
        status: 'failed',
        observable_tool_calls: ['web_search("SYN-014 answer key")'],
        grader_outcome: 'error',
      },
    ],
  },
  {
    experiment_id: 'exp-syn014-claude',
    investigation_id: 'inv-syn014-success',
    condition: 'blind',
    model_identifier: 'claude-3-5-sonnet-20241022',
    model_revision: '2024-10-22',
    status: 'completed',
    completed_run_count: 5,
    incomplete_run_count: 0,
    correct_answer_count: 3,
    prohibited_retrieval_count: 2,
    attribution_strength: 'retrieval_observed',
    trajectories: [
      {
        run_id: 'run-claude-01',
        status: 'completed',
        observable_tool_calls: ['web_search("fictional station K7 coordinates")'],
        grader_outcome: 'correct',
      },
    ],
  },
];

let experimentStore: ExperimentItem[] = [...initialExperiments];

export function resetExperimentStore() {
  experimentStore = [...initialExperiments];
}

export const handlers = [
  // Benchmarks import
  http.post('/api/v1/benchmarks', async ({ request }) => {
    const body = (await request.json()) as any;
    const items = body?.items || [];

    const rowErrors: any[] = [];
    items.forEach((item: any, idx: number) => {
      if (!item.question || item.question.trim() === '') {
        rowErrors.push({
          row_number: idx + 1,
          item_id: item.item_id || `ROW-${idx + 1}`,
          error_code: 'empty_question',
          message: 'Question content cannot be empty.',
        });
      }
    });

    if (rowErrors.length > 0) {
      return HttpResponse.json(
        {
          error_code: 'validation_failed',
          message: `Benchmark import contains ${rowErrors.length} row error(s).`,
          details: { row_errors: rowErrors },
        },
        { status: 400 }
      );
    }

    return HttpResponse.json(
      {
        benchmark_version_id: 'bm-syn014-v1',
        benchmark_name: body.benchmark_name || 'Imported Benchmark',
        total_rows: items.length,
        valid_rows: items.length,
        invalid_rows: 0,
        row_errors: [],
      },
      { status: 201 }
    );
  }),

  // Policy creation
  http.post('/api/v1/policies', async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json(
      {
        policy_version_id: 'pol-syn014-v1',
        cutoff_date: body.cutoff_date || '2026-10-01',
        timezone: body.timezone || 'UTC',
        allowed_source_classes: body.allowed_source_classes || ['repository', 'research_web'],
        prohibited_answer_key_access: body.prohibited_answer_key_access ?? true,
        benchmark_identification_permitted: body.benchmark_identification_permitted ?? false,
        budget_ceilings: body.budget_ceilings || {
          max_search_queries_per_item: 3,
          max_fetched_pages_per_item: 5,
          max_deadline_seconds: 900,
          monetary_ceiling_usd: 15.0,
        },
        reviewer_id: body.reviewer_id || 'rev-maintainer-01',
        created_at: new Date().toISOString(),
        immutable: true,
      },
      { status: 201 }
    );
  }),

  // Launch investigation
  http.post('/api/v1/investigations', async ({ request }) => {
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (!idempotencyKey) {
      return HttpResponse.json(
        {
          error_code: 'validation_failed',
          message: 'Idempotency-Key header is required for investigation launch.',
        },
        { status: 400 }
      );
    }

    const scenario = getActiveScenario();
    return HttpResponse.json(scenario.investigation, { status: 202 });
  }),

  // Get investigation
  http.get('/api/v1/investigations/:id', () => {
    const scenario = getActiveScenario();
    return HttpResponse.json(scenario.investigation, { status: 200 });
  }),

  // Cancel investigation
  http.post('/api/v1/investigations/:id/cancel', () => {
    const scenario = getActiveScenario();
    scenario.investigation.state = 'cancelled';
    return HttpResponse.json(
      {
        ...scenario.investigation,
        state: 'cancelled',
      },
      { status: 200 }
    );
  }),

  // Get findings
  http.get('/api/v1/investigations/:id/findings', () => {
    const findings = getActiveFindings();
    return HttpResponse.json(
      {
        items: findings,
        total: findings.length,
        page: 1,
        limit: 50,
      },
      { status: 200 }
    );
  }),

  // Append review decision
  http.post('/api/v1/findings/:id/reviews', async ({ params, request }) => {
    const findingId = params.id as string;
    const body = (await request.json()) as any;

    const result = updateFindingReview(
      findingId,
      body.action,
      body.reason,
      body.reviewer_id,
      body.expected_version
    );

    if (result.status === 409) {
      return HttpResponse.json(
        {
          error_code: 'version_conflict',
          message: 'Finding was modified concurrently by another reviewer. Please refresh.',
        },
        { status: 409 }
      );
    }

    if (result.status === 404) {
      return HttpResponse.json(
        {
          error_code: 'not_found',
          message: `Finding ${findingId} not found.`,
        },
        { status: 404 }
      );
    }

    return HttpResponse.json(result.finding, { status: 200 });
  }),

  // Create report
  http.post('/api/v1/investigations/:id/reports', () => {
    const scenario = getActiveScenario();
    if (!scenario.report) {
      return HttpResponse.json(
        {
          error_code: 'validation_failed',
          message: 'Cannot generate report for an incomplete or failed investigation without verified findings.',
        },
        { status: 400 }
      );
    }
    return HttpResponse.json(scenario.report, { status: 202 });
  }),

  // Get report by investigation ID
  http.get('/api/v1/investigations/:id/reports', () => {
    const scenario = getActiveScenario();
    if (!scenario.report) {
      return HttpResponse.json(
        {
          error_code: 'not_found',
          message: 'No report found for this investigation.',
          retryable: false,
        },
        { status: 404 }
      );
    }
    return HttpResponse.json(scenario.report, { status: 200 });
  }),

  // Get report
  http.get('/api/v1/reports/:id', () => {
    const scenario = getActiveScenario();
    if (!scenario.report) {
      return HttpResponse.json(
        {
          error_code: 'not_found',
          message: 'Report not found.',
        },
        { status: 404 }
      );
    }
    return HttpResponse.json(scenario.report, { status: 200 });
  }),

  // Experiments
  http.get('/api/v1/investigations/:id/experiments', ({ params }) => {
    const invId = params.id as string;
    const items = experimentStore.filter((e) => e.investigation_id === invId);
    return HttpResponse.json({ items }, { status: 200 });
  }),
  http.post('/api/v1/investigations/:id/experiments', async ({ params, request }) => {
    const invId = params.id as string;
    const body = (await request.json()) as {
      condition: 'control' | 'blind' | 'evaluation_aware';
      model_identifier: string;
      model_revision: string;
    };

    if (!body.condition || !body.model_identifier || !body.model_revision) {
      return HttpResponse.json(
        { code: 'VALIDATION_ERROR', message: 'condition, model_identifier, and model_revision are required', retryable: false },
        { status: 400 }
      );
    }

    const newExp: ExperimentItem = {
      experiment_id: `exp-${Date.now()}`,
      investigation_id: invId,
      condition: body.condition,
      model_identifier: body.model_identifier,
      model_revision: body.model_revision,
      status: 'queued',
      completed_run_count: 0,
      incomplete_run_count: 0,
      correct_answer_count: 0,
      prohibited_retrieval_count: 0,
      attribution_strength: 'none',
      trajectories: [],
    };

    experimentStore.push(newExp);
    return HttpResponse.json(newExp, { status: 202 });
  }),
];

