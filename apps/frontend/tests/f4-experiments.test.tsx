import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExperimentsView } from '../src/features/experiments/ExperimentsView.js';
import { resetExperimentStore } from '../src/mocks/handlers.js';

describe('Phase F4: Controlled Attacker Experiments & Trajectory Viewer', () => {
  const mockInvestigation = {
    id: 'inv-syn014-success',
    state: 'completed',
    partial_coverage: false,
    coverage_limitations: [],
  };

  beforeEach(() => {
    resetExperimentStore();
  });

  it('renders pinned model configuration summary and stratified comparison groups without pooling', async () => {
    render(<ExperimentsView investigation={mockInvestigation} />);

    // Wait for experiments to load by finding the stratified group test ID
    const gptGroup = await screen.findByTestId('config-group-gpt-4o-2026-08-06');
    expect(gptGroup).toBeInTheDocument();
    expect(gptGroup).toHaveTextContent(/gpt-4o-2026-08-06/i);
    expect(gptGroup).toHaveTextContent(/rev-1/i);

    // Pinned Model Configuration Card
    expect(screen.getByText(/ADR-001 Optional Comparative Evaluation/i)).toBeInTheDocument();
    expect(screen.getByText(/Stratified Configuration Invariant/i)).toBeInTheDocument();

    // Verify stratification: gpt-4o-2026-08-06 group and claude-3-5-sonnet-20241022 group are separated
    const claudeGroup = await screen.findByTestId('config-group-claude-3-5-sonnet-20241022');
    expect(claudeGroup).toBeInTheDocument();
    expect(claudeGroup).toHaveTextContent(/claude-3-5-sonnet-20241022/i);
    expect(claudeGroup).toHaveTextContent(/2024-10-22/i);
  });

  it('enforces explicit denominators: incomplete runs are excluded from accuracy denominator', async () => {
    render(<ExperimentsView investigation={mockInvestigation} />);

    await screen.findByTestId('config-group-gpt-4o-2026-08-06');

    // In Evaluation-Aware condition: completed = 9, incomplete = 1 (Timeout), correct = 8
    // Denominator must be 9 completed runs, NOT 10 total runs
    // 8 / 9 = 88.9%
    expect(screen.getByText('1 (Excluded)')).toBeInTheDocument();
    const ratioElements = screen.getAllByText('8 / 9');
    expect(ratioElements.length).toBeGreaterThanOrEqual(1);

    const pctElements = screen.getAllByText('(88.9%)');
    expect(pctElements.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText(/Denominator excludes 1 incomplete/i)).toBeInTheDocument();

    // In Control condition: completed = 10, incomplete = 0, correct = 2 (20.0%)
    expect(screen.getByText('2 / 10')).toBeInTheDocument();
    expect(screen.getByText('(20.0%)')).toBeInTheDocument();

    // Denominators Invariant footnote
    expect(screen.getAllByText(/Incomplete runs \(e\.g\. timeout, provider rate limit\) are strictly excluded/i).length).toBeGreaterThanOrEqual(1);
  });

  it('displays independent attribution strengths per blueprint vocabulary', async () => {
    render(<ExperimentsView investigation={mockInvestigation} />);

    await screen.findByTestId('config-group-gpt-4o-2026-08-06');

    expect(screen.getByText('[–] None')).toBeInTheDocument();
    const retrievalBadges = screen.getAllByText('[~] Retrieval Observed');
    expect(retrievalBadges.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('[!] Use Supported')).toBeInTheDocument();
  });

  it('opens observable trajectory viewer, escapes untrusted tool calls, and preserves privacy invariant', async () => {
    render(<ExperimentsView investigation={mockInvestigation} />);

    await screen.findByTestId('config-group-gpt-4o-2026-08-06');

    // Click "Inspect" button for Blind Browsing
    const inspectButtons = screen.getAllByRole('button', { name: /view trajectories for blind browsing/i });
    fireEvent.click(inspectButtons[0]);

    // Modal opens
    const modal = await screen.findByRole('dialog');
    expect(modal).toBeInTheDocument();

    // Verify privacy invariant banner: no private CoT
    expect(screen.getByText(/Private model reasoning \(chain-of-thought\) is never recorded or displayed/i)).toBeInTheDocument();

    // Verify observable tool calls rendered
    expect(screen.getByText(/web_search\("fictional space station K7 history"\)/i)).toBeInTheDocument();
    expect(screen.getByText(/fetch_page\("https:\/\/synthetic-fixtures\.example\.org\/stn\/k7"\)/i)).toBeInTheDocument();

    // Close modal
    const closeBtns = screen.getAllByRole('button', { name: /close trajectory viewer/i });
    fireEvent.click(closeBtns[0]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('allows queueing a new controlled experiment and updating the list', async () => {
    const user = userEvent.setup();
    render(<ExperimentsView investigation={mockInvestigation} />);

    await screen.findByTestId('config-group-gpt-4o-2026-08-06');

    // Open queue modal
    await user.click(screen.getByRole('button', { name: /queue controlled experiment/i }));

    const modal = await screen.findByRole('dialog');
    expect(modal).toBeInTheDocument();

    // Fill form
    const conditionSelect = screen.getByLabelText(/experimental condition/i);
    await user.selectOptions(conditionSelect, 'evaluation_aware');

    const modelInput = screen.getByLabelText(/pinned model identifier/i);
    await user.clear(modelInput);
    await user.type(modelInput, 'meta-llama-3-70b-instruct');

    const revInput = screen.getByLabelText(/pinned model revision/i);
    await user.clear(revInput);
    await user.type(revInput, 'rev-2026-v1');

    // Submit
    const submitBtn = screen.getByRole('button', { name: /dispatch experiment/i });
    await user.click(submitBtn);

    // Modal closes
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // New stratified group is displayed
    const newGroup = await screen.findByTestId('config-group-meta-llama-3-70b-instruct');
    expect(newGroup).toBeInTheDocument();
    expect(newGroup).toHaveTextContent(/meta-llama-3-70b-instruct/i);
    expect(newGroup).toHaveTextContent(/rev-2026-v1/i);
    expect(newGroup).toHaveTextContent(/queued/i);
  });
});
