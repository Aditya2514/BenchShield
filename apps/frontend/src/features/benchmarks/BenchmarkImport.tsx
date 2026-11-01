import React, { useState } from 'react';
import { Upload, AlertOctagon, CheckCircle2, FileText, ArrowRight } from 'lucide-react';
import type { RowError } from '@benchshield/api-client';

export interface StagedBenchmark {
  benchmark_version_id: string;
  benchmark_name: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  row_errors: RowError[];
}

interface BenchmarkImportProps {
  onImportSuccess?: (staged: StagedBenchmark) => void;
}

export function BenchmarkImport({ onImportSuccess }: BenchmarkImportProps) {
  const [benchmarkName, setBenchmarkName] = useState('Synthetic Reasoning Suite v1');
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [inputText, setInputText] = useState(
    JSON.stringify(
      [
        {
          item_id: 'SYN-014',
          question: 'Which fictional station has code K7?',
          options: ['North', 'East', 'South', 'West'],
          reference_answer: 'East',
        },
        {
          item_id: 'SYN-015',
          question: '',
          options: ['Alpha', 'Beta'],
          reference_answer: 'Alpha',
        },
      ],
      null,
      2
    )
  );

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<StagedBenchmark | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleValidateAndStage = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSubmitError(null);

    try {
      let parsedItems: any[] = [];
      if (format === 'json') {
        parsedItems = JSON.parse(inputText);
        if (!Array.isArray(parsedItems)) {
          throw new Error('JSON input must be an array of benchmark item objects.');
        }
      } else {
        // Lean CSV parser
        const lines = inputText.trim().split('\n');
        if (lines.length < 2) {
          throw new Error('CSV must contain a header and at least one item row.');
        }
        const headers = lines[0].split(',').map((h) => h.trim());
        parsedItems = lines.slice(1).map((line) => {
          const cols = line.split(',').map((c) => c.trim());
          const item: Record<string, string> = {};
          headers.forEach((h, i) => {
            item[h] = cols[i] || '';
          });
          return item;
        });
      }

      // Hard Rule Check: Verify reference answers are never stored in localStorage / sessionStorage
      // We pass the items directly in the fetch body to /api/v1/benchmarks
      const response = await fetch('/api/v1/benchmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benchmark_name: benchmarkName,
          format,
          items: parsedItems,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details?.row_errors) {
          const stagedErr: StagedBenchmark = {
            benchmark_version_id: 'pending',
            benchmark_name: benchmarkName,
            total_rows: parsedItems.length,
            valid_rows: parsedItems.length - data.details.row_errors.length,
            invalid_rows: data.details.row_errors.length,
            row_errors: data.details.row_errors,
          };
          setResult(stagedErr);
          setSubmitError(data.message || 'Row validation errors detected.');
        } else {
          setSubmitError(data.message || 'Failed to import benchmark.');
        }
        return;
      }

      const staged: StagedBenchmark = {
        benchmark_version_id: data.benchmark_version_id,
        benchmark_name: data.benchmark_name,
        total_rows: data.total_rows,
        valid_rows: data.valid_rows,
        invalid_rows: data.invalid_rows,
        row_errors: data.row_errors || [],
      };

      setResult(staged);
      onImportSuccess?.(staged);
    } catch (err: any) {
      setSubmitError(err.message || 'Invalid file format or network error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="p-2 bg-indigo-950 text-indigo-400 border border-indigo-700/50 rounded-lg">
            <Upload className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Import Benchmark Items</h2>
            <p className="text-xs text-slate-400">
              Upload evaluation items in CSV or versioned JSON. Gold reference answers are vaulted securely and never persisted in browser storage.
            </p>
          </div>
        </div>

        <form onSubmit={handleValidateAndStage} className="mt-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="benchmark-name" className="block text-xs font-medium text-slate-300">
                Benchmark Name
              </label>
              <input
                id="benchmark-name"
                type="text"
                value={benchmarkName}
                onChange={(e) => setBenchmarkName(e.target.value)}
                required
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <fieldset>
                <legend className="block text-xs font-medium text-slate-300">Format</legend>
                <div className="mt-2 flex gap-4 text-xs text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="json"
                      checked={format === 'json'}
                      onChange={() => setFormat('json')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    JSON Array
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="csv"
                      checked={format === 'csv'}
                      onChange={() => setFormat('csv')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    CSV Format
                  </label>
                </div>
              </fieldset>
            </div>
          </div>

          <div>
            <label htmlFor="benchmark-data" className="block text-xs font-medium text-slate-300">
              Item Data Payload (JSON or CSV lines)
            </label>
            <textarea
              id="benchmark-data"
              rows={8}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="mt-1 w-full font-mono text-xs bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-400" aria-hidden="true" />
              Supported grading: exact short-answer and multiple-choice.
            </span>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Validating...' : 'Validate & Stage Items'}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </form>

        {submitError && (
          <div role="alert" className="mt-4 p-4 rounded-lg bg-red-950/70 border border-red-700/60 flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-red-200">Validation Notice</h3>
              <p className="text-xs text-red-300/90 mt-0.5">{submitError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Validation Results & Row Error Table */}
      {result && (
        <section aria-labelledby="intake-summary-title" className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 id="intake-summary-title" className="text-sm font-semibold text-white">
              Intake Preflight Summary
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Version: {result.benchmark_version_id}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400 block">Total Rows</span>
              <span className="text-xl font-bold text-white">{result.total_rows}</span>
            </div>
            <div className="p-3 bg-emerald-950/50 rounded-lg border border-emerald-800/40">
              <span className="text-xs text-emerald-400 block flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Valid Rows
              </span>
              <span className="text-xl font-bold text-emerald-200">{result.valid_rows}</span>
            </div>
            <div className="p-3 bg-red-950/50 rounded-lg border border-red-800/40">
              <span className="text-xs text-red-400 block flex items-center gap-1">
                <AlertOctagon className="w-3.5 h-3.5" aria-hidden="true" /> Row Errors
              </span>
              <span className="text-xl font-bold text-red-200">{result.invalid_rows}</span>
            </div>
          </div>

          {result.row_errors.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-medium text-slate-300">Actionable Row Errors:</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-800 rounded-lg overflow-hidden">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th scope="col" className="py-2 px-3 font-medium">Row #</th>
                      <th scope="col" className="py-2 px-3 font-medium">Item ID</th>
                      <th scope="col" className="py-2 px-3 font-medium">Error Code</th>
                      <th scope="col" className="py-2 px-3 font-medium">Explanation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                    {result.row_errors.map((err, i) => (
                      <tr key={i} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-mono text-slate-400">{err.row_number}</td>
                        <td className="py-2 px-3 font-mono text-slate-200">{err.item_id}</td>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-300 font-mono text-[11px] border border-red-800/60">
                            {err.error_code}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-red-200/90">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

