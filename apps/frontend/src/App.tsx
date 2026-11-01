import { useState } from 'react';
import { Shell, NavTab } from './components/Shell.js';
import { BenchmarkImport, StagedBenchmark } from './features/benchmarks/BenchmarkImport.js';
import { PolicyForm } from './features/policies/PolicyForm.js';
import { InvestigationView } from './features/investigations/InvestigationView.js';
import { FindingsView } from './features/findings/FindingsView.js';
import { ReportsView } from './features/reports/ReportsView.js';
import { SCENARIOS, getActiveScenario, setActiveScenario } from './mocks/scenarios.js';
import { getTemporalStatusMeta, getClaimStatusMeta } from './types/status.js';
import { AlertTriangle } from 'lucide-react';
import type { PolicyResponse } from '@benchshield/api-client';

export default function App({
  defaultTab = 'benchmarks',
  initialScenario,
}: {
  defaultTab?: NavTab;
  initialScenario?: string;
} = {}) {
  const [activeTab, setActiveTab] = useState<NavTab>(defaultTab);
  const [selectedScenario, setSelectedScenario] = useState<string>(
    initialScenario || getActiveScenario().scenario_id
  );
  const [_stagedBenchmark, setStagedBenchmark] = useState<StagedBenchmark | null>(null);
  const [_activePolicy, setActivePolicy] = useState<PolicyResponse | null>(null);

  const scenario = getActiveScenario();

  const handleScenarioChange = (id: string) => {
    setSelectedScenario(id);
    setActiveScenario(id);
  };

  const scenarioList = Object.keys(SCENARIOS).map((k) => ({
    id: k,
    name: SCENARIOS[k].name,
  }));

  return (
    <Shell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      selectedScenario={selectedScenario}
      onScenarioChange={handleScenarioChange}
      scenarioList={scenarioList}
    >
      {activeTab === 'benchmarks' && (
        <BenchmarkImport onImportSuccess={setStagedBenchmark} />
      )}

      {activeTab === 'policies' && (
        <PolicyForm onPolicyCreated={setActivePolicy} />
      )}

      {activeTab === 'investigations' && (
        <InvestigationView
          key={selectedScenario}
          initialInvestigation={scenario.investigation}
          eventsSequence={scenario.events}
        />
      )}

      {activeTab === 'findings' && (
        <FindingsView
          key={selectedScenario}
          initialFindings={scenario.findings}
          investigation={scenario.investigation}
        />
      )}

      {activeTab === 'reports' && (
        <ReportsView
          key={selectedScenario}
          initialReport={scenario.report}
          investigationId={scenario.investigation.id}
        />
      )}

      {activeTab === 'experiments' && (
        <div className="space-y-6">
          {/* Active Scenario Overview Card */}
          <section aria-labelledby="scenario-title" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono text-indigo-400 uppercase tracking-wider">
                  Scenario Contract Verification
                </span>
                <h2 id="scenario-title" className="text-xl font-semibold text-white mt-1">
                  {scenario.name}
                </h2>
                <p className="text-sm text-slate-400 mt-1">{scenario.description}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Investigation ID</span>
                <span className="text-xs font-mono text-slate-300">{scenario.investigation.id}</span>
              </div>
            </div>

            {/* Partial Coverage Warning Banner */}
            {scenario.investigation.partial_coverage && (
              <div
                role="alert"
                className="mt-4 p-4 rounded-lg bg-amber-950/60 border border-amber-700/60 flex items-start gap-3"
              >
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-amber-200">
                    Partial Coverage Audit Warning
                  </h3>
                  <p className="text-xs text-amber-300/90 mt-0.5">
                    This audit did not cover all planned sources due to provider limitations or outages. Never interpret this partial coverage as an unexposed or clean certification.
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-amber-400 list-disc list-inside">
                    {scenario.investigation.coverage_limitations.map((lim: string, idx: number) => (
                      <li key={idx}>{lim}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Policy Blocked Banner */}
            {scenario.investigation.state === 'policy_blocked' && (
              <div
                role="alert"
                className="mt-4 p-4 rounded-lg bg-rose-950/60 border border-rose-700/60 flex items-start gap-3"
              >
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-rose-200">
                    Audit Execution Halted (policy_blocked)
                  </h3>
                  <p className="text-xs text-rose-300/90 mt-0.5">
                    {scenario.investigation.failure_reason}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Independent Dimensions Findings Table */}
          <section aria-labelledby="findings-title" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 id="findings-title" className="text-base font-semibold text-white">
                  Independent Finding Dimensions
                </h2>
                <p className="text-xs text-slate-400">
                  Independent assessment dimensions per docs/blueprint.md (zero opaque score).
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300">
                Total Findings: {scenario.findings.length}
              </span>
            </div>

            {scenario.findings.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                No exposure findings in this scenario state.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th scope="col" className="py-2.5 px-3 font-medium">Item ID</th>
                      <th scope="col" className="py-2.5 px-3 font-medium">Claim Status</th>
                      <th scope="col" className="py-2.5 px-3 font-medium">Exposure Type</th>
                      <th scope="col" className="py-2.5 px-3 font-medium">Task Identity</th>
                      <th scope="col" className="py-2.5 px-3 font-medium">Answer Match</th>
                      <th scope="col" className="py-2.5 px-3 font-medium">Temporal Status</th>
                      <th scope="col" className="py-2.5 px-3 font-medium">Policy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {scenario.findings.map((finding: any) => {
                      const tempMeta = getTemporalStatusMeta(finding.temporal_status);
                      const claimMeta = getClaimStatusMeta(finding.claim_status);

                      return (
                        <tr key={finding.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-3 font-mono text-slate-200 font-semibold">
                            {finding.item_id}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${claimMeta.badgeClass}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
                              {claimMeta.label}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-300 font-mono">
                            {finding.exposure_dimension}
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            {finding.task_identity}
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            {finding.answer_match}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${tempMeta.badgeClass}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
                              {tempMeta.label}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                finding.policy_compliance === 'violated'
                                  ? 'bg-red-950 text-red-300 border border-red-800/50'
                                  : finding.policy_compliance === 'permitted'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {finding.policy_compliance}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </Shell>
  );
}
