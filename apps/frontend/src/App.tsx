import { useCallback, useEffect, useState } from 'react';
import { Shell, NavTab } from './components/Shell.js';
import { BenchmarkImport } from './features/benchmarks/BenchmarkImport.js';
import { PolicyForm } from './features/policies/PolicyForm.js';
import { InvestigationView } from './features/investigations/InvestigationView.js';
import { FindingsView } from './features/findings/FindingsView.js';
import { ExperimentsView } from './features/experiments/ExperimentsView.js';
import { ReportsView } from './features/reports/ReportsView.js';
import { ConnectPanel } from './features/session/ConnectPanel.js';
import { getAppMode, type AppMode } from './api/mode.js';
import { getSession, onUnauthorized, setSession, type Session } from './api/http.js';
import { EMPTY_WORKFLOW, loadWorkflow, saveWorkflow, type Workflow } from './workflow.js';
import { getMockKit } from './mocks/kit.js';

const MOCK_SESSION: Session = { token: 'mock-token', workspaceId: 'ws_demo', label: 'demo@benchshield.local' };

function workflowFromScenario(id: string | undefined): Workflow {
  const kit = getMockKit();
  if (!kit) return EMPTY_WORKFLOW;
  const s = kit.scenarios[id ?? kit.defaultScenarioId] ?? kit.scenarios[kit.defaultScenarioId];
  return {
    benchmark: s.benchmark_import.benchmark_version_id
      ? {
          benchmark_id: s.benchmark_import.benchmark_id ?? null,
          benchmark_version_id: s.benchmark_import.benchmark_version_id,
          name: 'Synthetic Exposure Audit Demo',
          total_rows: s.benchmark_import.total_rows,
          valid_rows: s.benchmark_import.valid_rows,
        }
      : null,
    policy: s.policy,
    investigationId: s.investigation.investigation_id,
    report: s.report,
  };
}

export default function App({
  defaultTab = 'benchmarks',
  initialScenario,
  mode = getAppMode(),
}: {
  defaultTab?: NavTab;
  initialScenario?: string;
  mode?: AppMode;
} = {}) {
  const kit = getMockKit();
  const isMock = mode === 'mock' && kit !== null;
  const [activeTab, setActiveTab] = useState<NavTab>(defaultTab);
  const [scenarioId, setScenarioId] = useState(initialScenario ?? kit?.defaultScenarioId ?? '');
  const [session, setSessionState] = useState<Session | null>(() => {
    if (isMock) {
      setSession(MOCK_SESSION);
      return MOCK_SESSION;
    }
    return getSession();
  });
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [workflow, setWorkflow] = useState<Workflow>(() =>
    isMock ? workflowFromScenario(initialScenario) : loadWorkflow()
  );

  useEffect(() => onUnauthorized(() => setIsSessionExpired(true)), []);
  useEffect(() => {
    if (!isMock) saveWorkflow(workflow);
  }, [workflow, isMock]);

  const updateWorkflow = useCallback((patch: Partial<Workflow>) => {
    setWorkflow((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleScenarioChange = (id: string) => {
    setScenarioId(id);
    setWorkflow(workflowFromScenario(id));
  };

  const handleReauthenticate = () => {
    setIsSessionExpired(false);
    if (!isMock) {
      setSession(null);
      setSessionState(null);
    }
  };

  const handleDisconnect = () => {
    setSession(null);
    setSessionState(null);
    setWorkflow(EMPTY_WORKFLOW);
  };

  const scenarioList = kit ? Object.values(kit.scenarios).map((s) => ({ id: s.scenario_id, name: s.name })) : [];

  return (
    <Shell
      mode={isMock ? 'mock' : 'live'}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      session={session}
      workflow={workflow}
      selectedScenario={scenarioId}
      onScenarioChange={handleScenarioChange}
      scenarioList={scenarioList}
      isSessionExpired={isSessionExpired}
      onReauthenticate={handleReauthenticate}
      onSimulateExpiry={isMock ? kit?.simulateExpiry : undefined}
      onDisconnect={isMock ? undefined : handleDisconnect}
    >
      {!session ? (
        <ConnectPanel
          onConnected={(s) => {
            setSessionState(s);
            setIsSessionExpired(false);
          }}
        />
      ) : (
        <>
          {activeTab === 'benchmarks' && (
            <BenchmarkImport
              staged={workflow.benchmark}
              onImportSuccess={(benchmark) => updateWorkflow({ benchmark, investigationId: null, report: null })}
              onContinue={() => setActiveTab('policies')}
            />
          )}

          {activeTab === 'policies' && (
            <PolicyForm
              activePolicy={workflow.policy}
              onPolicyCreated={(policy) => updateWorkflow({ policy, investigationId: null, report: null })}
              onContinue={() => setActiveTab('investigations')}
            />
          )}

          {activeTab === 'investigations' && (
            <InvestigationView
              key={`${scenarioId}:${workflow.investigationId ?? 'none'}`}
              workflow={workflow}
              onInvestigationChange={(investigationId) => updateWorkflow({ investigationId, report: null })}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'findings' && (
            <FindingsView
              key={`${scenarioId}:${workflow.investigationId ?? 'none'}`}
              investigationId={workflow.investigationId}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'experiments' && <ExperimentsView investigationId={workflow.investigationId} />}

          {activeTab === 'reports' && (
            <ReportsView
              key={`${scenarioId}:${workflow.investigationId ?? 'none'}`}
              investigationId={workflow.investigationId}
              report={workflow.report}
              onReportChange={(report) => updateWorkflow({ report })}
              onNavigate={setActiveTab}
            />
          )}
        </>
      )}
    </Shell>
  );
}
