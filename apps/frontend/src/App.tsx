import { useState } from 'react';
import { Shell, NavTab } from './components/Shell.js';
import { BenchmarkImport, StagedBenchmark } from './features/benchmarks/BenchmarkImport.js';
import { PolicyForm } from './features/policies/PolicyForm.js';
import { InvestigationView } from './features/investigations/InvestigationView.js';
import { FindingsView } from './features/findings/FindingsView.js';
import { ExperimentsView } from './features/experiments/ExperimentsView.js';
import { ReportsView } from './features/reports/ReportsView.js';
import { SCENARIOS, getActiveScenario, setActiveScenario } from './mocks/scenarios.js';
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

      {activeTab === 'experiments' && (
        <ExperimentsView
          key={selectedScenario}
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
    </Shell>
  );
}
