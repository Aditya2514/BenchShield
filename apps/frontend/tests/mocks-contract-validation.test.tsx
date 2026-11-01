import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import App from '../src/App.js';
import { setActiveScenario } from '../src/mocks/scenarios.js';

describe('Frontend Mock Contract Validation & Vocabulary', () => {
  it('renders application shell and displays verified exposure finding dimensions without an opaque score', () => {
    setActiveScenario('1-successful-audit');
    render(<App />);

    expect(screen.getByText('BenchShield')).toBeInTheDocument();
    expect(screen.getByText('Independent Finding Dimensions')).toBeInTheDocument();
    expect(screen.getByText('SYN-014')).toBeInTheDocument();
    expect(screen.getByText('Verified Claim')).toBeInTheDocument();
    expect(screen.getByText('Timing Unknown')).toBeInTheDocument();
    expect(screen.getByText('reference_answer')).toBeInTheDocument();

    // Verify no opaque score exists in the document
    expect(screen.queryByText(/exposure score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/integrity score/i)).not.toBeInTheDocument();
  });

  it('visibly displays partial coverage warning banner in Scenario 2', () => {
    setActiveScenario('2-partial-coverage-outage');
    render(<App />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Partial Coverage Audit Warning')).toBeInTheDocument();
    expect(screen.getByText(/Provider outage during external web search/)).toBeInTheDocument();
    // Confirms "no exposure detected" is NOT displayed
    expect(screen.queryByText(/no exposure detected/i)).not.toBeInTheDocument();
  });

  it('displays policy_blocked state banner in Scenario 3', () => {
    setActiveScenario('3-policy-blocked');
    render(<App />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Audit Execution Halted \(policy_blocked\)/)).toBeInTheDocument();
  });

  it('allows switching scenarios via the accessible select dropdown', () => {
    render(<App />);

    const select = screen.getByLabelText(/Active Mock Scenario:/i);
    expect(select).toBeInTheDocument();

    fireEvent.change(select, { target: { value: '2-partial-coverage-outage' } });
    expect(screen.getByText('Partial Coverage Audit Warning')).toBeInTheDocument();
  });
});
