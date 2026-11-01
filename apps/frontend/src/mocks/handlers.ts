import { http, HttpResponse } from 'msw';
import { getActiveScenario, updateFindingReview, getActiveFindings } from './scenarios.js';

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
  http.get('/api/v1/investigations/:id/experiments', () => {
    return HttpResponse.json({ items: [] }, { status: 200 });
  }),
  http.post('/api/v1/investigations/:id/experiments', async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json(
      {
        experiment_id: 'exp-syn014-01',
        investigation_id: 'inv-syn014-success',
        condition: body.condition || 'blind',
        model_identifier: body.model_identifier || 'synthetic-evaluator-v1',
        model_revision: body.model_revision || '2026-10-01-rev1',
        status: 'completed',
        completed_run_count: 5,
        incomplete_run_count: 0,
        correct_answer_count: 4,
        prohibited_retrieval_count: 3,
        attribution_strength: 'use_supported',
        trajectories: [
          {
            run_id: 'run-01',
            status: 'completed',
            observable_tool_calls: ['web_search("fictional station K7")', 'fetch_page("https://synthetic-repo.example.com")'],
            grader_outcome: 'correct',
          },
        ],
      },
      { status: 202 }
    );
  }),
];

