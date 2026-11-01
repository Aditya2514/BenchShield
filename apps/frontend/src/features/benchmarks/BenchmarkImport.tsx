import React, { useRef, useState } from 'react';
import {
  Upload,
  AlertOctagon,
  CheckCircle2,
  FileText,
  ArrowRight,
  FileCode,
  FileUp,
  X,
} from 'lucide-react';
import type { ImportRowError } from '@benchshield/api-client';
import { uploadBenchmark } from '../../api/endpoints.js';
import { errorMessage } from '../../api/http.js';
import type { StagedBenchmark } from '../../workflow.js';
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

export type { StagedBenchmark };

// Same items as the backend's offline demo (benchshield.devtools.demo_scenario),
// so a live run against scripts/dev_server.py produces real findings.
const VALID_JSON = JSON.stringify(
  [
    {
      external_id: 'SYN-001',
      task_type: 'exact_short_answer',
      question: 'What is the primary power generation mechanism of fictional Station K-9?',
      gold_answer: 'Sub-surface thorium reactor',
      metadata: { domain: 'sci_fi_engineering', difficulty: 'medium' },
    },
    {
      external_id: 'SYN-002',
      task_type: 'multiple_choice',
      question: 'Which fictional station holds registration code K7?',
      choices: [
        { id: 'A', text: 'North Station' },
        { id: 'B', text: 'East Station' },
        { id: 'C', text: 'South Station' },
        { id: 'D', text: 'West Station' },
      ],
      gold_answer: 'B',
      metadata: { domain: 'sci_fi_registry', difficulty: 'easy' },
    },
    {
      external_id: 'SYN-003',
      task_type: 'exact_short_answer',
      question: 'What is the atomic number of carbon?',
      gold_answer: '6',
      metadata: { domain: 'chemistry', difficulty: 'easy' },
    },
    {
      external_id: 'SYN-004',
      task_type: 'exact_short_answer',
      question: 'Which fictional river feeds the orbital desalination ring of Meridia?',
      gold_answer: 'Vellan Stream',
      metadata: { domain: 'sci_fi_geography', difficulty: 'hard' },
    },
  ],
  null,
  2
);

const INVALID_JSON = JSON.stringify(
  [
    {
      external_id: 'SYN-014',
      task_type: 'multiple_choice',
      question: 'Which fictional station has code K7?',
      choices: [
        { id: 'A', text: 'North' },
        { id: 'B', text: 'East' },
      ],
      gold_answer: 'B',
    },
    { external_id: 'SYN-015', task_type: 'exact_short_answer', question: '', gold_answer: 'Alpha' },
    { external_id: 'SYN-016', task_type: 'code_execution', question: 'Write a sort.', gold_answer: 'n/a' },
  ],
  null,
  2
);

const VALID_CSV = [
  'external_id,task_type,question,choices,gold_answer',
  'SYN-001,exact_short_answer,What is the primary power generation mechanism of fictional Station K-9?,,Sub-surface thorium reactor',
  'SYN-002,multiple_choice,Which fictional station holds registration code K7?,A: North Station; B: East Station; C: South Station; D: West Station,B',
  'SYN-003,exact_short_answer,What is the atomic number of carbon?,,6',
].join('\n');

interface BenchmarkImportProps {
  staged?: StagedBenchmark | null;
  onImportSuccess?: (staged: StagedBenchmark) => void;
  onContinue?: () => void;
}

interface ImportResult {
  status: 'accepted' | 'rejected';
  benchmark_version_id: string | null;
  total_rows: number;
  valid_rows: number;
  errors: ImportRowError[];
}

export function BenchmarkImport({ staged, onImportSuccess, onContinue }: BenchmarkImportProps) {
  const [benchmarkName, setBenchmarkName] = useState('Synthetic Exposure Audit Demo');
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [inputText, setInputText] = useState(VALID_JSON);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reads a dropped or picked file into the editor; the backend does the parsing.
  const handleFile = async (file: File) => {
    const lower = file.name.toLowerCase();
    const isCsv = lower.endsWith('.csv') || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel';
    const isJson = lower.endsWith('.json') || file.type === 'application/json';
    if (!isCsv && !isJson) {
      setSubmitError(`Unsupported file format "${file.name}". Please upload a .csv or .json file.`);
      return;
    }
    try {
      setInputText(await file.text());
      setFormat(isCsv ? 'csv' : 'json');
      setUploadedFile({ name: file.name, size: file.size });
      setResult(null);
      setSubmitError(null);
      const clean = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
      if (clean) setBenchmarkName(clean.charAt(0).toUpperCase() + clean.slice(1));
    } catch (err) {
      setSubmitError(`Failed to read file: ${errorMessage(err)}`);
    }
  };

  const chooseFormat = (f: 'json' | 'csv') => {
    setUploadedFile(null);
    setFormat(f);
    setInputText(f === 'csv' ? VALID_CSV : VALID_JSON);
    setResult(null);
    setSubmitError(null);
  };

  const handleValidateAndStage = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSubmitError(null);
    setResult(null);

    try {
      // Content goes straight to the backend, which vaults gold answers and
      // never echoes them. Nothing is written to browser storage.
      const data = await uploadBenchmark(benchmarkName, format, inputText);
      const res: ImportResult = {
        status: data.status,
        benchmark_version_id: data.benchmark_version_id ?? null,
        total_rows: data.total_rows,
        valid_rows: data.valid_rows,
        errors: data.errors ?? [],
      };
      setResult(res);
      if (data.status === 'accepted' && data.benchmark_version_id) {
        onImportSuccess?.({
          benchmark_id: data.benchmark_id ?? null,
          benchmark_version_id: data.benchmark_version_id,
          name: benchmarkName,
          total_rows: data.total_rows,
          valid_rows: data.valid_rows,
        });
      } else {
        setSubmitError('Row validation errors detected. Nothing was imported; fix the rows below and retry.');
      }
    } catch (err) {
      setSubmitError(errorMessage(err));
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
                    JSON array (or {'{'}"items": [...]{'}'}) or CSV with columns: <code className="text-slate-700 font-semibold">external_id</code>, <code className="text-slate-700 font-semibold">task_type</code>, <code className="text-slate-700 font-semibold">question</code>, <code className="text-slate-700 font-semibold">choices</code>, <code className="text-slate-700 font-semibold">gold_answer</code>.
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

          {/* Drag-and-drop / file picker */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFile(f);
            }}
            className={`border-2 border-dashed rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white'}`}
          >
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <FileUp className="w-5 h-5 text-indigo-600" aria-hidden="true" />
              {uploadedFile ? (
                <span>
                  Loaded <strong className="text-slate-900">{uploadedFile.name}</strong> ({(uploadedFile.size / 1024).toFixed(1)} KB, {format.toUpperCase()})
                  <button type="button" onClick={() => setUploadedFile(null)} aria-label="Clear uploaded file" className="ml-2 align-middle cursor-pointer">
                    <X className="w-3.5 h-3.5 inline" aria-hidden="true" />
                  </button>
                </span>
              ) : (
                <span>Drop a .csv or .json file here, or choose one. Format is detected automatically.</span>
              )}
            </div>
            <input
              ref={fileInputRef}
              id="benchmark-file"
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="sr-only"
              aria-label="Choose benchmark file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = '';
              }}
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              Choose file
            </Button>
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
                        onChange={() => chooseFormat('json')}
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
                        onChange={() => chooseFormat('csv')}
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
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-400" aria-hidden="true" />
                  Supported task types: exact_short_answer, multiple_choice.
                </span>
                {format === 'json' && (
                  <span className="flex gap-2 text-xs">
                    <button type="button" className="underline text-indigo-700 cursor-pointer" onClick={() => setInputText(VALID_JSON)}>
                      Load valid sample
                    </button>
                    <button type="button" className="underline text-indigo-700 cursor-pointer" onClick={() => setInputText(INVALID_JSON)}>
                      Load sample with errors
                    </button>
                  </span>
                )}
              </div>
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

      {staged && !result && (
        <Alert variant="success" title="Benchmark staged for this audit">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {staged.name}: version <code className="font-semibold">{staged.benchmark_version_id}</code> ({staged.valid_rows} items)
            </span>
            {onContinue && (
              <Button size="sm" variant="secondary" onClick={onContinue} icon={<ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />}>
                Next: policy
              </Button>
            )}
          </div>
        </Alert>
      )}

      {/* Validation Results & Row Error Table */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <CardTitle id="intake-summary-title">Intake Preflight Summary</CardTitle>
              <Badge variant="neutral" className="font-mono">
                {result.status === 'accepted' ? `Version: ${result.benchmark_version_id}` : 'Rejected: not imported'}
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
                <span className="text-2xl font-bold text-red-900 mt-0.5 block">{result.errors.length}</span>
              </div>
            </div>

            {result.status === 'accepted' && onContinue && (
              <div className="flex justify-end">
                <Button onClick={onContinue} icon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}>
                  Next: configure policy
                </Button>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-semibold text-slate-800">Actionable Row Errors:</h4>
                <Table>
                  <TableHeader>
                    <tr>
                      <TableHead>Row #</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>Error Code</TableHead>
                      <TableHead>Explanation</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {result.errors.map((err, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-slate-600">{err.row_number}</TableCell>
                        <TableCell className="font-mono font-semibold text-slate-900">{err.field}</TableCell>
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
