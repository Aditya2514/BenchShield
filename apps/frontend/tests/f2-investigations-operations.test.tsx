import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import App from '../src/App.js';
import { setActiveScenario } from '../src/mocks/scenarios.js';

describe('Phase F2: Investigation Operations & SSE Timeline', () => {
  it('renders investigation operations with progress timeline and budget usage', async () => {
    setActiveScenario('1-successful-audit');
    render(<App defaultTab="investigations" />);

    expect(screen.getByText('Investigation Operations')).toBeInTheDocument();
    expect(screen.getByText(/inv-syn014-success/i)).toBeInTheDocument();
    expect(screen.getByText('Investigation Progress Timeline (SSE Stream)')).toBeInTheDocument();

    // Verify budget counters
    expect(screen.getByText(/Search Queries/i)).toBeInTheDocument();
    expect(screen.getByText(/Spend Reconciled/i)).toBeInTheDocument();

    // Verify events replay
    await waitFor(() => {
      expect(screen.getByText('investigation.queued')).toBeInTheDocument();
      expect(screen.getByText('investigation.discovering')).toBeInTheDocument();
    });
  });

  it('dispatches launch with generated Idempotency-Key header', async () => {
    setActiveScenario('1-successful-audit');
    render(<App defaultTab="investigations" />);

    const launchBtn = screen.getByRole('button', { name: /Launch with Idempotency/i });
    expect(launchBtn).toBeInTheDocument();

    fireEvent.click(launchBtn);

    await waitFor(() => {
      expect(screen.getByText(/Last Dispatched Idempotency-Key:/i)).toBeInTheDocument();
    });
  });

  it('visibly displays partial coverage banner and explicit limitations in Scenario 2', async () => {
    setActiveScenario('2-partial-coverage-outage');
    render(<App defaultTab="investigations" initialScenario="2-partial-coverage-outage" />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Partial Coverage Audit Warning')).toBeInTheDocument();
      expect(screen.getByText(/Provider outage during external web search/i)).toBeInTheDocument();
    });

    // Verify never display "no exposure detected"
    expect(screen.queryByText(/no exposure detected/i)).not.toBeInTheDocument();
  });

  it('cancels an active investigation via idempotent POST /cancel', async () => {
    setActiveScenario('1-successful-audit');
    render(<App defaultTab="investigations" />);

    const cancelBtn = screen.getByRole('button', { name: /Cancel Run/i });
    expect(cancelBtn).toBeInTheDocument();

    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
    });
  });
});

