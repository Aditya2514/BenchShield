import { Shield, Database, Sliders, Activity, ListFilter, Cpu, FileCheck } from 'lucide-react';

export type NavTab = 'benchmarks' | 'policies' | 'investigations' | 'findings' | 'experiments' | 'reports';

interface ShellProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  selectedScenario: string;
  onScenarioChange: (scenarioId: string) => void;
  scenarioList: { id: string; name: string }[];
  children: React.ReactNode;
}

export function Shell({
  activeTab,
  onTabChange,
  selectedScenario,
  onScenarioChange,
  scenarioList,
  children,
}: ShellProps) {
  const tabs = [
    { id: 'benchmarks' as NavTab, label: 'Benchmarks', icon: Database },
    { id: 'policies' as NavTab, label: 'Policies', icon: Sliders },
    { id: 'investigations' as NavTab, label: 'Investigations', icon: Activity },
    { id: 'findings' as NavTab, label: 'Findings', icon: ListFilter },
    { id: 'experiments' as NavTab, label: 'Experiments', icon: Cpu },
    { id: 'reports' as NavTab, label: 'Reports', icon: FileCheck },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Workspace & Product Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-950 border border-indigo-700/50 rounded-lg text-indigo-400">
            <Shield className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white">BenchShield</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                v0.2
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Workspace: <strong className="text-slate-300">Acme AI Evaluation Lab</strong>
            </p>
          </div>
        </div>

        {/* Mock Scenario Switcher */}
        <div className="flex items-center gap-2">
          <label htmlFor="scenario-selector" className="text-xs text-slate-400">
            Active Mock Scenario:
          </label>
          <select
            id="scenario-selector"
            aria-label="Active Mock Scenario:"
            value={selectedScenario}
            onChange={(e) => onScenarioChange(e.target.value)}
            className="text-xs bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:ring-2 focus:ring-indigo-500"
          >
            {scenarioList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Navigation Sub-header */}
      <nav aria-label="Main Navigation" className="border-b border-slate-800/80 bg-slate-900/40 px-6">
        <div className="max-w-6xl mx-auto flex items-center gap-1 overflow-x-auto py-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-950/80 text-indigo-200 border border-indigo-700/60 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6">
        {children}
      </main>
    </div>
  );
}
