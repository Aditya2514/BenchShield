import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import App from '../src/App.js';

describe('Phase F1: Shell, Benchmark Intake, and Policy Setup', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders application shell with navigation tabs and workspace context', () => {
    render(<App />);

    expect(screen.getByText('BenchShield')).toBeInTheDocument();
    expect(screen.getByText(/Acme AI Evaluation Lab/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Benchmarks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Policies/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Investigations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Findings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reports/i })).toBeInTheDocument();
  });

  it('validates benchmark import and displays actionable row error table for empty questions', async () => {
    render(<App />);

    // In Benchmarks tab by default
    const validateBtn = screen.getByRole('button', { name: /Validate & Stage Items/i });
    expect(validateBtn).toBeInTheDocument();

    // Default input contains SYN-015 with empty question which triggers row error
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(screen.getByText('Validation Notice')).toBeInTheDocument();
      expect(screen.getByText('Actionable Row Errors:')).toBeInTheDocument();
      expect(screen.getByText('empty_question')).toBeInTheDocument();
      expect(screen.getByText('SYN-015')).toBeInTheDocument();
    });

    // Hard rule check: Assert reference answers were NEVER stored in localStorage or sessionStorage
    expect(localStorage.getItem('reference_answer')).toBeNull();
    expect(localStorage.getItem('gold_answer')).toBeNull();
    expect(sessionStorage.getItem('reference_answer')).toBeNull();
    expect(sessionStorage.getItem('gold_answer')).toBeNull();
  });

  it('switches to Policies tab and configures immutable evaluation policy with review summary', async () => {
    render(<App />);

    const policiesTab = screen.getByRole('button', { name: /Policies/i });
    fireEvent.click(policiesTab);

    expect(screen.getByText('Evaluation Policy & Privacy Scope')).toBeInTheDocument();
    expect(screen.getByLabelText(/Evaluation Cutoff Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cutoff Timezone/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Create Immutable Policy Version/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Pre-Launch Policy & Privacy Review Summary')).toBeInTheDocument();
      expect(screen.getByText(/Version: pol-syn014-v1/i)).toBeInTheDocument();
    });
  });
});

