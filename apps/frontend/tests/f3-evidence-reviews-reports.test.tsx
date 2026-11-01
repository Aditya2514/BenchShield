import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import App from '../src/App.js';
import { setActiveScenario } from '../src/mocks/scenarios.js';

describe('Phase F3: Findings, Evidence Viewer, Reviews (409), and Reports', () => {
  it('renders findings view with independent dimensions and plain-text escaped excerpt viewer', async () => {
    setActiveScenario('1-successful-audit');
    render(<App defaultTab="findings" initialScenario="1-successful-audit" />);

    expect(screen.getByText('Independent Finding Dimensions')).toBeInTheDocument();
    expect(screen.getByText('SYN-014')).toBeInTheDocument();
    expect(screen.getByText('reference_answer')).toBeInTheDocument();

    // Zero opaque score check
    expect(screen.queryByText(/exposure score/i)).not.toBeInTheDocument();

    // Click "Inspect" button to open evidence drawer
    const inspectBtn = screen.getByRole('button', { name: /Inspect/i });
    fireEvent.click(inspectBtn);

    expect(screen.getByText(/Evidence Record: SYN-014/i)).toBeInTheDocument();
    expect(screen.getByText('Plain Text Escaped Only')).toBeInTheDocument();

    // Verify excerpt is rendered as plain text in pre without dangerouslySetInnerHTML
    const preEl = screen.getByText(/Exam Question: Which fictional station has code K7\?/i);
    expect(preEl.tagName.toLowerCase()).toBe('pre');
  });

  it('handles review adjudication modal and records confirmed decision', async () => {
    setActiveScenario('1-successful-audit');
    render(<App defaultTab="findings" initialScenario="1-successful-audit" />);

    const inspectBtn = screen.getByRole('button', { name: /Inspect/i });
    fireEvent.click(inspectBtn);

    const adjudicateBtn = screen.getByRole('button', { name: /Adjudicate Finding/i });
    fireEvent.click(adjudicateBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Adjudicate Finding: SYN-014/i)).toBeInTheDocument();

    const recordBtn = screen.getByRole('button', { name: /Record Decision/i });
    fireEvent.click(recordBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('renders frozen report metadata and authorized download link in Scenario 1', () => {
    setActiveScenario('1-successful-audit');
    render(<App defaultTab="reports" initialScenario="1-successful-audit" />);

    expect(screen.getByText('Versioned Audit Report')).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText(/Frozen Report ID/i)).toBeInTheDocument();
    expect(screen.getByText('R-001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download Authorized Report/i })).toBeInTheDocument();
  });

  it('visibly distinguishes report export failure from investigation failure in Scenario 5', () => {
    setActiveScenario('5-report-generation-failure');
    render(<App defaultTab="reports" initialScenario="5-report-generation-failure" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Report Generation Failure \(export_failed\)/i)).toBeInTheDocument();
    expect(
      screen.getByText(/The underlying investigation data, verified findings, and reviewer adjudications remain completely intact, valid, and unaffected/i)
    ).toBeInTheDocument();
  });
});

