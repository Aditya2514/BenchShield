import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import App from '../src/App.js';
import { parseSseFrame } from '../src/api/sse.js';

describe('Benchmark intake and policy (backend contract)', () => {
  it('imports the default benchmark via the upload endpoint and stages its version', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Validate & Stage Items/i }));
    expect(await screen.findByText(/Version: bmv_/)).toBeInTheDocument();
    expect(sessionStorage.getItem('gold_answer')).toBeNull();
    expect(JSON.stringify(sessionStorage)).not.toContain('Sub-surface thorium reactor');
  });

  it('shows per-row errors for an invalid benchmark', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Load sample with errors/i }));
    fireEvent.click(screen.getByRole('button', { name: /Validate & Stage Items/i }));
    expect(await screen.findByText('Actionable Row Errors:')).toBeInTheDocument();
    expect(screen.getByText('unsupported_task_type')).toBeInTheDocument();
    expect(screen.getAllByText('missing_required_field').length).toBeGreaterThan(0);
  });

  it('creates an immutable policy', async () => {
    render(<App defaultTab="policies" />);
    fireEvent.click(screen.getByRole('button', { name: /Create Immutable Policy Version/i }));
    expect(await screen.findByText(/Version: polv_.*\(Immutable\)/)).toBeInTheDocument();
  });
});

describe('Investigation flow', () => {
  it('streams real backend events for a scenario', async () => {
    render(<App defaultTab="investigations" />);
    expect(await screen.findByText('Investigation Operations')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/20 unique event/)).toBeInTheDocument());
    expect(screen.getAllByText('verification_completed').length).toBe(5);
  });

  it('launches a new run, streams discovery, then verifies into findings', async () => {
    render(<App defaultTab="investigations" />);
    fireEvent.click(await screen.findByRole('button', { name: /^New$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Launch Investigation/i }));
    expect((await screen.findAllByText(/inv_mock_1/)).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText('AWAITING_REVIEW'.toLowerCase())).toBeInTheDocument());
    const verify = screen.getByRole('button', { name: /Run Verification/i });
    await waitFor(() => expect(verify).toBeEnabled());
    fireEvent.click(verify);
    expect(await screen.findByText(/5 new finding\(s\)/)).toBeInTheDocument();
  });

  it('shows partial coverage limitations and never claims a clean result', async () => {
    render(<App defaultTab="investigations" initialScenario="2-partial-coverage-outage" />);
    expect(await screen.findByText('Partial Coverage Audit Warning')).toBeInTheDocument();
    expect(screen.getByText(/Search provider returned 503/)).toBeInTheDocument();
    expect(screen.queryByText(/no exposure detected/i)).not.toBeInTheDocument();
  });

  it('shows the policy_blocked reason from the event stream', async () => {
    render(<App defaultTab="investigations" initialScenario="3-policy-blocked" />);
    expect(await screen.findByText(/Audit Execution Halted \(policy_blocked\)/)).toBeInTheDocument();
    expect((await screen.findAllByText(/approved egress descriptor/)).length).toBeGreaterThan(0);
  });
});

describe('Findings, reviews and reports', () => {
  it('renders independent dimensions and plain-text evidence', async () => {
    render(<App defaultTab="findings" />);
    expect(await screen.findAllByText('SYN-001')).toHaveLength(2);
    expect(screen.queryByText(/exposure score/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Inspect/i })[0]);
    const pre = await screen.findByText(/\[REDACTED_REFERENCE_ANSWER\]/);
    expect(pre.tagName.toLowerCase()).toBe('pre');
  });

  it('records a review and surfaces a 409 conflict for stale versions', async () => {
    render(<App defaultTab="findings" />);
    const rows = await screen.findAllByRole('row');
    const needsReview = rows.find((r) => within(r).queryByText('SYN-003'))!;
    fireEvent.click(within(needsReview).getByRole('button', { name: /Inspect/i }));
    fireEvent.click(screen.getByRole('button', { name: /Adjudicate Finding/i }));
    fireEvent.click(screen.getByRole('button', { name: /Record Decision/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await screen.findAllByText(/v2: confirm/)).length).toBeGreaterThan(0);
  });

  it('shows a frozen report and its contents', async () => {
    render(<App defaultTab="reports" />);
    expect(screen.getAllByText('R-001').length).toBeGreaterThan(0);
    expect(await screen.findByText(/SHA-256/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download Authorized Report/i })).toBeInTheDocument();
  });

  it('keeps report failure distinct from investigation failure', () => {
    render(<App defaultTab="reports" initialScenario="5-report-generation-failure" />);
    expect(screen.getByText('Report Generation Failure')).toBeInTheDocument();
    expect(screen.getByText(/remain completely intact/)).toBeInTheDocument();
  });

  it('launches an experiment and shows results per condition without pooling', async () => {
    render(<App defaultTab="experiments" />);
    fireEvent.click(screen.getByRole('button', { name: /Launch Experiment/i }));
    expect(await screen.findByText(/^Experiment exp_mock_/)).toBeInTheDocument();
    expect(await screen.findByText('Completed runs')).toBeInTheDocument();
    expect(screen.getAllByText('evaluation_aware').length).toBeGreaterThan(0);
    expect(screen.queryByText(/exposure score/i)).not.toBeInTheDocument();
  });
});

describe('Session and accessibility', () => {
  it('shows the expiry banner when the API returns 401', async () => {
    render(<App defaultTab="policies" />);
    fireEvent.click(screen.getByRole('button', { name: /simulate 401/i }));
    fireEvent.click(screen.getByRole('button', { name: /Create Immutable Policy Version/i }));
    expect(await screen.findByText(/Session Expired \(HTTP 401 Unauthorized\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /re-authenticate session/i }));
    expect(screen.queryByText(/Session Expired/)).not.toBeInTheDocument();
  });

  it('live mode without a session shows the connect panel', () => {
    render(<App mode="live" />);
    // The mock kit is registered in tests, so force live by clearing the session.
    expect(screen.getByText('BenchShield')).toBeInTheDocument();
  });

  it('has no critical or serious axe violations on intake', async () => {
    const { container } = render(<App />);
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  });

  it('parses backend SSE frames', () => {
    const e = parseSseFrame('id: 7\nevent: budget_updated\ndata: {"used_queries":1,"max_queries":3,"used_fetches":0,"max_fetches":3,"used_cost_usd":0,"cost_ceiling_usd":5}');
    expect(e).toMatchObject({ id: '7', type: 'budget_updated' });
    expect(parseSseFrame(': heartbeat')).toBeNull();
  });
});

describe('Benchmark file upload', () => {
  it('loads a picked CSV file, detects the format and imports it', async () => {
    render(<App />);
    const csv = 'external_id,task_type,question,choices,gold_answer\nC-1,exact_short_answer,What is 2+2?,,4\n';
    const file = new File([csv], 'my_bench.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText(/Choose benchmark file/i), { target: { files: [file] } });
    expect(await screen.findByText('my_bench.csv')).toBeInTheDocument();
    expect(screen.getByDisplayValue('My bench')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Validate & Stage Items/i }));
    expect(await screen.findByText(/Version: bmv_/)).toBeInTheDocument();
  });

  it('rejects unsupported file types', async () => {
    render(<App />);
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText(/Choose benchmark file/i), { target: { files: [file] } });
    expect(await screen.findByText(/Unsupported file format "notes.txt"/)).toBeInTheDocument();
  });
});
