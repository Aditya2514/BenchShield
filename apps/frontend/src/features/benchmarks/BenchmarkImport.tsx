import React, { useState } from 'react';
import {
  Upload,
  AlertOctagon,
  CheckCircle2,
  FileText,
  ArrowRight,
  FileCode,
} from 'lucide-react';
import type { RowError } from '@benchshield/api-client';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Alert,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '../../components/ui';

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
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg shrink-0">
              <Upload className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Import Benchmark Items</CardTitle>
              <CardDescription>
                Upload evaluation items in CSV or versioned JSON. Gold reference answers are vaulted securely and never persisted in browser storage.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Obvious Pre-Upload Drop Zone / Format Guide */}
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-5 bg-slate-50/60 hover:bg-slate-100/60 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <FileCode className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-900">Supported Ingestion Formats &amp; Schemas</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    JSON Array or CSV with standard headers: <code className="text-slate-700 font-semibold">item_id</code>, <code className="text-slate-700 font-semibold">question</code>, <code className="text-slate-700 font-semibold">options</code>, <code className="text-slate-700 font-semibold">reference_answer</code>.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <Badge variant="info">JSON</Badge>
                <Badge variant="info">CSV</Badge>
                <Badge variant="success">Short-Answer</Badge>
                <Badge variant="success">Multiple-Choice</Badge>
              </div>
            </div>
          </div>

          <form onSubmit={handleValidateAndStage} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="benchmark-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Benchmark Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="benchmark-name"
                  type="text"
                  value={benchmarkName}
                  onChange={(e) => setBenchmarkName(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                />
              </div>

              <div>
                <fieldset>
                  <legend className="block text-xs font-semibold text-slate-700 mb-1">Format <span className="text-red-600">*</span></legend>
                  <div className="flex gap-4 pt-1 text-xs text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="format"
                        value="json"
                        checked={format === 'json'}
                        onChange={() => setFormat('json')}
                        className="text-indigo-600 focus:ring-indigo-600"
                      />
                      JSON Array
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="format"
                        value="csv"
                        checked={format === 'csv'}
                        onChange={() => setFormat('csv')}
                        className="text-indigo-600 focus:ring-indigo-600"
                      />
                      CSV Format
                    </label>
                  </div>
                </fieldset>
              </div>
            </div>

            <div>
              <label htmlFor="benchmark-data" className="block text-xs font-semibold text-slate-700 mb-1">
                Item Data Payload (JSON or CSV lines) <span className="text-red-600">*</span>
              </label>
              <textarea
                id="benchmark-data"
                rows={8}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                required
                className="w-full font-mono text-xs bg-white border border-slate-300 rounded-lg p-3 text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" aria-hidden="true" />
                Supported grading: exact short-answer and multiple-choice.
              </span>
              <Button
                type="submit"
                disabled={isLoading}
                variant="primary"
                icon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
              >
                {isLoading ? 'Validating...' : 'Validate & Stage Items'}
              </Button>
            </div>
          </form>

          {submitError && (
            <Alert variant="danger" title="Validation Notice">
              {submitError}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Validation Results & Row Error Table */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <CardTitle id="intake-summary-title">Intake Preflight Summary</CardTitle>
              <Badge variant="neutral" className="font-mono">
                Version: {result.benchmark_version_id}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-600 font-medium block">Total Rows</span>
                <span className="text-2xl font-bold text-slate-900 mt-0.5 block">{result.total_rows}</span>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 shadow-2xs">
                <span className="text-xs text-emerald-800 font-medium block flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Valid Rows
                </span>
                <span className="text-2xl font-bold text-emerald-900 mt-0.5 block">{result.valid_rows}</span>
              </div>
              <div className="p-4 bg-red-50 rounded-xl border border-red-200 shadow-2xs">
                <span className="text-xs text-red-800 font-medium block flex items-center gap-1.5">
                  <AlertOctagon className="w-3.5 h-3.5" aria-hidden="true" /> Row Errors
                </span>
                <span className="text-2xl font-bold text-red-900 mt-0.5 block">{result.invalid_rows}</span>
              </div>
            </div>

            {result.row_errors.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-semibold text-slate-800">Actionable Row Errors:</h4>
                <Table>
                  <TableHeader>
                    <tr>
                      <TableHead>Row #</TableHead>
                      <TableHead>Item ID</TableHead>
                      <TableHead>Error Code</TableHead>
                      <TableHead>Explanation</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {result.row_errors.map((err, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-slate-600">{err.row_number}</TableCell>
                        <TableCell className="font-mono font-semibold text-slate-900">{err.item_id}</TableCell>
                        <TableCell>
                          <Badge variant="danger" className="font-mono">
                            {err.error_code}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-red-900 font-medium">{err.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
