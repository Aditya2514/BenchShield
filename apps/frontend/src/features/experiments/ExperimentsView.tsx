import React, { useEffect, useState } from 'react';
import { Cpu, Play, RotateCw } from 'lucide-react';
import type { AdversarialRun, ExperimentCondition, ExperimentConfig, ExperimentResultsResponse } from '@benchshield/api-client';
import { getExperiment, launchExperiment } from '../../api/endpoints.js';
import { errorMessage } from '../../api/http.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Alert, Button, Badge, Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/ui';

const CONDITIONS: { id: ExperimentCondition; label: string }[] = [
  { id: 'control', label: 'Control (no tools)' },
  { id: 'blind', label: 'Blind (tools, no hint)' },
  { id: 'evaluation_aware', label: 'Evaluation-aware' },
];
const DONE = new Set(['completed', 'failed', 'cancelled', 'policy_blocked', 'budget_exhausted', 'incomplete']);

/**
 * Optional controlled attacker experiments (backend phase B4). Results are
 * shown per condition; they are never pooled into a single score, and they
 * are reported separately from exposure findings.
 */
export function ExperimentsView({ investigationId }: { investigationId: string | null }) {
  const [conditions, setConditions] = useState<ExperimentCondition[]>(['control', 'blind', 'evaluation_aware']);
  const [providerId, setProviderId] = useState('fake');
  const [modelId, setModelId] = useState('fake-model-v1');
  const [modelRev, setModelRev] = useState('');
  const [config, setConfig] = useState<ExperimentConfig | null>(null);
  const [results, setResults] = useState<ExperimentResultsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async (id: string) => {
    try {
      setResults(await getExperiment(id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  // Poll until every run has reached a final state.
  useEffect(() => {
    if (!config) return;
    const runs = results?.runs ?? [];
    if (results && runs.length > 0 && runs.every((r) => DONE.has(r.run_status))) return;
    const t = setTimeout(() => void refresh(config.experiment_id), results ? 1500 : 0);
    return () => clearTimeout(t);
  }, [config, results]);

  if (!investigationId) {
    return (
      <Alert variant="info" title="No investigation selected">
        Experiments run against an investigation whose discovery has finished. Launch one first.
      </Alert>
    );
  }

  const launch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      setConfig(
        await launchExperiment(investigationId, {
          investigation_id: investigationId,
          conditions,
          provider_id: providerId.trim(),
          model_identifier: modelId.trim(),
          model_revision: modelRev.trim() || null,
          prompt_version: 'prompt_v1.0',
          reasoning_budget: 1000,
        })
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const runs = results?.runs ?? [];
  const byCondition = CONDITIONS.map((c) => {
    const rs = runs.filter((r) => r.condition === c.id);
    return {
      ...c,
      total: rs.length,
      completed: rs.filter((r) => r.run_status === 'completed').length,
      correct: rs.filter((r) => r.grader_outcome === 'correct').length,
      prohibited: rs.filter((r) => r.policy_compliance === 'violated').length,
    };
  }).filter((c) => c.total > 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-indigo-700" aria-hidden="true" />
            <div>
              <CardTitle>Controlled Attacker Experiments</CardTitle>
              <CardDescription>
                Optional. Tests whether a pinned model can find and use exposed answers. Reported separately from exposure findings.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && <Alert variant="danger" title="Experiment request failed" className="mb-4">{error}</Alert>}
          <form onSubmit={launch} className="space-y-4 text-xs">
            <fieldset>
              <legend className="font-semibold text-slate-700 mb-2">Conditions</legend>
              <div className="flex flex-wrap gap-4">
                {CONDITIONS.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={conditions.includes(c.id)}
                      onChange={() => setConditions((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block font-semibold text-slate-700">Provider ID
                <input value={providerId} onChange={(e) => setProviderId(e.target.value)} required className="mt-1 w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono" />
              </label>
              <label className="block font-semibold text-slate-700">Pinned model identifier
                <input value={modelId} onChange={(e) => setModelId(e.target.value)} required className="mt-1 w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono" />
              </label>
              <label className="block font-semibold text-slate-700">Model revision (optional)
                <input value={modelRev} onChange={(e) => setModelRev(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono" />
              </label>
            </div>
            <Button type="submit" disabled={busy || conditions.length === 0} icon={<Play className="w-4 h-4" aria-hidden="true" />}>
              {busy ? 'Launching...' : 'Launch Experiment'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {config && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3 w-full">
              <div>
                <CardTitle>Experiment {config.experiment_id}</CardTitle>
                <CardDescription>
                  {config.provider_id} / {config.model_identifier}
                  {config.model_revision ? ` (rev ${config.model_revision})` : ''} · prompt {config.prompt_version} · grader {config.grader_version}
                </CardDescription>
              </div>
              <Button variant="secondary" size="sm" onClick={() => void refresh(config.experiment_id)} icon={<RotateCw className="w-3.5 h-3.5" aria-hidden="true" />}>
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {!results ? (
              <p className="text-slate-500">Loading results...</p>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 border rounded-xl"><b className="block">Completed runs</b>{results.completed_runs_count}</div>
                  <div className="p-3 bg-slate-50 border rounded-xl"><b className="block">Incomplete runs</b>{results.incomplete_runs_count}</div>
                  <div className="p-3 bg-slate-50 border rounded-xl"><b className="block">Correct answers</b>{results.correct_answer_count}</div>
                  <div className="p-3 bg-slate-50 border rounded-xl"><b className="block">Prohibited retrievals</b>{results.prohibited_retrieval_count}</div>
                </div>
                {results.incomplete_runs_count > 0 && (
                  <Alert variant="warning" title="Incomplete runs">Incomplete runs are excluded from counts and are not evidence either way.</Alert>
                )}
                {byCondition.length > 0 && (
                  <Table>
                    <TableHeader><tr><TableHead>Condition</TableHead><TableHead>Runs</TableHead><TableHead>Completed</TableHead><TableHead>Correct</TableHead><TableHead>Policy violations</TableHead></tr></TableHeader>
                    <TableBody>
                      {byCondition.map((c) => (
                        <TableRow key={c.id}><TableCell className="font-mono">{c.id}</TableCell><TableCell>{c.total}</TableCell><TableCell>{c.completed}</TableCell><TableCell>{c.correct}</TableCell><TableCell>{c.prohibited}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <RunsTable runs={runs} />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RunsTable({ runs }: { runs: AdversarialRun[] }) {
  if (runs.length === 0) return <p className="text-slate-500">No runs recorded yet.</p>;
  return (
    <Table>
      <TableHeader><tr><TableHead>Run</TableHead><TableHead>Condition</TableHead><TableHead>Status</TableHead><TableHead>Outcome</TableHead><TableHead>Attribution</TableHead><TableHead>Policy</TableHead><TableHead>Tool calls</TableHead></tr></TableHeader>
      <TableBody>
        {runs.map((r) => (
          <TableRow key={r.run_id}>
            <TableCell className="font-mono">{r.run_id}</TableCell>
            <TableCell className="font-mono">{r.condition}</TableCell>
            <TableCell><Badge variant={r.run_status === 'completed' ? 'success' : DONE.has(r.run_status) ? 'warning' : 'info'}>{r.run_status}</Badge></TableCell>
            <TableCell>{r.grader_outcome ?? '—'}</TableCell>
            <TableCell>{r.attribution ?? '—'}</TableCell>
            <TableCell>{r.policy_compliance ?? '—'}</TableCell>
            <TableCell className="font-mono whitespace-pre-wrap">{(r.observable_tool_calls ?? []).map(String).join('\n') || '—'}{r.failure_reason ? `\n${r.failure_reason}` : ''}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
