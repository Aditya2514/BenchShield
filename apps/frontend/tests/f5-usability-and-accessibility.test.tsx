import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import App from '../src/App.js';
import { ReportsView } from '../src/features/reports/ReportsView.js';
import { BenchmarkImport } from '../src/features/benchmarks/BenchmarkImport.js';
import { PolicyForm } from '../src/features/policies/PolicyForm.js';
import { SCENARIOS } from '../src/mocks/scenarios.js';

describe('Phase F5: Usability, Resilience, Expired Flows, and Accessibility (Axe)', () => {
  beforeEach(() => {
    // Reset any state if necessary
  });

  it('runs axe accessibility audit on application shell and benchmark intake with zero critical/serious violations', async () => {
    const { container } = render(<App defaultTab="benchmarks" />);

    // Wait for initial render
    expect(screen.getByText(/Acme AI Evaluation Lab/i)).toBeInTheDocument();

    const results = await axe.run(container, {
      rules: {
        // In JSDOM, color-contrast can have limitations due to lack of real browser layout engine
        'color-contrast': { enabled: false },
      },
    });

    const criticalOrSerious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalOrSerious).toEqual([]);
  });

  it('runs axe accessibility audit on policy setup form', async () => {
    const { container } = render(<PolicyForm onPolicyCreated={() => {}} />);

    const results = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });

    const criticalOrSerious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalOrSerious).toEqual([]);
  });

  it('handles session expiry flow (HTTP 401 interception & re-authentication)', async () => {
    const user = userEvent.setup();
    render(<App defaultTab="benchmarks" />);

    // Initially session banner is not present
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Trigger simulation of 401 session expiry
    const simButton = screen.getByRole('button', { name: /simulate 401/i });
    await user.click(simButton);

    // Banner should appear with assertive alert
    const expiryBanner = await screen.findByRole('alert');
    expect(expiryBanner).toBeInTheDocument();
    expect(expiryBanner).toHaveTextContent(/Session Expired \(HTTP 401 Unauthorized\)/i);
    expect(expiryBanner).toHaveTextContent(/Re-authenticate to resume secure investigation operations/i);

    // Click re-authenticate action
    const reauthBtn = screen.getByRole('button', { name: /re-authenticate session/i });
    await user.click(reauthBtn);

    // Banner is dismissed upon re-auth
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('handles expired-download flow in ReportsView by refreshing pre-signed download link', async () => {
    const mockReport = { ...SCENARIOS['1-successful-audit'].report };
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <ReportsView
        initialReport={mockReport}
        investigationId="inv-syn014-success"
      />
    );

    // Verify report is rendered with active download button
    expect(screen.getByRole('button', { name: /download authorized report/i })).toBeInTheDocument();

    // Simulate pre-signed link expiration
    const simExpireBtn = screen.getByRole('button', { name: /simulate expired link/i });
    fireEvent.click(simExpireBtn);

    // Verify UI reflects expired state
    expect(screen.getByText('URL Expired')).toBeInTheDocument();
    const refreshAndDownloadBtn = screen.getByRole('button', {
      name: /download expired: click to refresh & download/i,
    });
    expect(refreshAndDownloadBtn).toBeInTheDocument();
    expect(refreshAndDownloadBtn).toHaveTextContent(/Refresh & Download Report/i);

    // Click refresh & download
    fireEvent.click(refreshAndDownloadBtn);

    // Status notice shows refreshing
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/Secure download link has expired/i);
    });

    // Wait for fresh report fetch and download triggered
    await waitFor(() => {
      expect(windowOpenSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/reports/rep-syn014-01/download'),
        '_blank'
      );
    });

    windowOpenSpy.mockRestore();
  });

  it('renders complete empty states with clear calls-to-action when data is unpopulated', () => {
    // ReportsView without initialReport
    const { rerender } = render(
      <ReportsView initialReport={null} investigationId="inv-test-empty" />
    );
    expect(screen.getByText('No Frozen Report Generated')).toBeInTheDocument();
    const freezeBtns = screen.getAllByRole('button', { name: /freeze & generate report/i });
    expect(freezeBtns.length).toBeGreaterThanOrEqual(1);

    // BenchmarkImport initial empty state
    rerender(<BenchmarkImport onImportSuccess={() => {}} />);
    expect(screen.getByText(/Item Data Payload/i)).toBeInTheDocument();
  });
});
