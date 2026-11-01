import React, { useState, useRef } from 'react';
import {
  Upload,
  AlertOctagon,
  CheckCircle2,
  FileText,
  ArrowRight,
  FileCode,
  FileSpreadsheet,
  X,
  FileUp,
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

  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: number;
    type: 'json' | 'csv';
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<StagedBenchmark | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleFileProcess = async (file: File) => {
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isCsv = lowerName.endsWith('.csv') || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel';
    const isJson = lowerName.endsWith('.json') || file.type === 'application/json';

    if (!isCsv && !isJson) {
      setSubmitError(`Unsupported file format "${file.name}". Please upload a valid .csv or .json file.`);
      return;
    }

    try {
      const text = await file.text();
      const detectedFormat: 'json' | 'csv' = isCsv ? 'csv' : 'json';
      setInputText(text);
      setFormat(detectedFormat);
      setUploadedFile({
        name: file.name,
        size: file.size,
        type: detectedFormat,
      });
      setSubmitError(null);

      // If benchmark name is untouched default, derive from file name
      if (benchmarkName === 'Synthetic Reasoning Suite v1') {
        const cleanName = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]/g, ' ')
          .trim();
        if (cleanName) {
          setBenchmarkName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
        }
      }
    } catch (err: any) {
      setSubmitError(`Failed to read file: ${err.message || 'Unknown file error'}`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFileProcess(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleClearUploadedFile = () => {
    setUploadedFile(null);
  };

  const handleFormatChange = (newFormat: 'json' | 'csv') => {
    if (newFormat === format) return;
    setFormat(newFormat);
    // If the input text is the default sample, convert to the selected format's sample
    if (newFormat === 'csv' && inputText.includes('Which fictional station has code K7?')) {
      setInputText(
`item_id,question,options,reference_answer
SYN-014,"Which fictional station has code K7?","North, East, South, West",East
SYN-015,"","Alpha, Beta",Alpha`
      );
    } else if (newFormat === 'json' && inputText.includes('Which fictional station has code K7?')) {
      setInputText(
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
    }
  };

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
        // Robust CSV parser supporting quotes and standard headers
        const lines = inputText
          .trim()
          .split(/\r?\n/)
          .filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          throw new Error('CSV must contain a header and at least one item row.');
        }

        const parseCsvLine = (line: string): string[] => {
          const cols: string[] = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              cols.push(cur.trim());
              cur = '';
            } else {
              cur += char;
            }
          }
          cols.push(cur.trim());
          return cols;
        };

        const headers = parseCsvLine(lines[0]);
        parsedItems = lines.slice(1).map((line) => {
          const cols = parseCsvLine(line);
          const item: Record<string, any> = {};
          headers.forEach((h, i) => {
            let val = cols[i] !== undefined ? cols[i] : '';
            if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
              val = val.slice(1, -1).replace(/""/g, '"');
            }
            if (h === 'options') {
              if (val.startsWith('[') && val.endsWith(']')) {
                try {
                  item[h] = JSON.parse(val);
                } catch {
                  item[h] = val
                    .slice(1, -1)
                    .split(/[;,]/)
                    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
                }
              } else if (val.includes(';') || val.includes('|')) {
                item[h] = val.split(/[;|]/).map((s) => s.trim());
              } else if (val) {
                item[h] = val.split(',').map((s) => s.trim());
              } else {
                item[h] = [];
              }
            } else {
              item[h] = val;
            }
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
          {/* Interactive Pre-Upload Drop Zone & File Selector */}
          <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-5 transition-all ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/80 ring-2 ring-indigo-500/20'
                : 'border-slate-300 bg-slate-50/60 hover:bg-slate-100/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={handleFileInputChange}
              className="hidden"
              id="benchmark-file-input"
              data-testid="benchmark-file-input"
              aria-label="Upload CSV or JSON Benchmark File"
            />

            {uploadedFile ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-lg">
                    {uploadedFile.type === 'csv' ? (
                      <FileSpreadsheet className="w-5 h-5" aria-hidden="true" />
                    ) : (
                      <FileCode className="w-5 h-5" aria-hidden="true" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{uploadedFile.name}</span>
                      <Badge variant="info">{(uploadedFile.size / 1024).toFixed(1)} KB</Badge>
                      <Badge variant="neutral">{uploadedFile.type.toUpperCase()}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      File loaded into staging editor. Click &quot;Validate &amp; Stage Items&quot; below to ingest.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    icon={<FileUp className="w-3.5 h-3.5" aria-hidden="true" />}
                  >
                    Replace File
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearUploadedFile}
                    icon={<X className="w-3.5 h-3.5" aria-hidden="true" />}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg shrink-0">
                    <FileUp className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-900">
                      Drag &amp; drop your CSV or JSON benchmark file
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Or browse your local machine. Standard CSV headers:{' '}
                      <code className="text-slate-700 font-semibold">item_id</code>,{' '}
                      <code className="text-slate-700 font-semibold">question</code>,{' '}
                      <code className="text-slate-700 font-semibold">options</code>,{' '}
                      <code className="text-slate-700 font-semibold">reference_answer</code>.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    icon={<Upload className="w-3.5 h-3.5" aria-hidden="true" />}
                  >
                    Browse File
                  </Button>
                  <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-200">
                    <Badge variant="info">CSV</Badge>
                    <Badge variant="info">JSON</Badge>
                  </div>
                </div>
              </div>
            )}
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
                        onChange={() => handleFormatChange('json')}
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
                        onChange={() => handleFormatChange('csv')}
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
