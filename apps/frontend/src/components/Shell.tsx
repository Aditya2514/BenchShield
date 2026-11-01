import React from 'react';
import {
  Shield,
  Database,
  Sliders,
  Activity,
  ListFilter,
  Cpu,
  FileCheck,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';

export type NavTab = 'benchmarks' | 'policies' | 'investigations' | 'findings' | 'experiments' | 'reports';

interface ShellProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  selectedScenario: string;
  onScenarioChange: (scenarioId: string) => void;
  scenarioList: { id: string; name: string }[];
  isSessionExpired?: boolean;
  onReauthenticate?: () => void;
  onSimulateExpiry?: () => void;
  children: React.ReactNode;
}

export function Shell({
  activeTab,
  onTabChange,
  selectedScenario,
  onScenarioChange,
  scenarioList,
  isSessionExpired = false,
  onReauthenticate,
  onSimulateExpiry,
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Workspace & Product Header */}
      <header className="border-b border-slate-200 bg-white/95 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20 backdrop-blur shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700">
            <Shield className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-slate-900">BenchShield</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono border border-slate-200">
                v0.2
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Workspace: <strong className="text-slate-800 font-semibold">Acme AI Evaluation Lab</strong>
            </p>
          </div>
        </div>

        {/* Right Header Actions: Mock Switcher & 401 Simulation */}
        <div className="flex items-center gap-3">
          {onSimulateExpiry && (
            <button
              type="button"
              onClick={onSimulateExpiry}
              className="px-2.5 py-1 rounded-md text-xs font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              title="Simulate HTTP 401 Session Expiry"
            >
              Simulate 401
            </button>
          )}

          <div className="flex items-center gap-2">
            <label htmlFor="scenario-selector" className="text-xs font-medium text-slate-600">
              Active Mock Scenario:
            </label>
            <select
              id="scenario-selector"
              aria-label="Active Mock Scenario:"
              value={selectedScenario}
              onChange={(e) => onScenarioChange(e.target.value)}
              className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
            >
              {scenarioList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Accessible Session Expiry Banner (HTTP 401 Interception) */}
      {isSessionExpired && (
        <aside
          role="alert"
          aria-live="assertive"
          className="bg-amber-50 border-b border-amber-300 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 text-amber-950"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" aria-hidden="true" />
            <div>
              <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Session Expired (HTTP 401 Unauthorized)
              </h3>
              <p className="text-xs text-amber-900 mt-0.5">
                Your authentication token has expired. Re-authenticate to resume secure investigation operations and view confidential benchmark audit records.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onReauthenticate}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 shadow-xs cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
            Re-authenticate Session
          </button>
        </aside>
      )}

      {/* Navigation Sub-header */}
      <nav aria-label="Main Navigation" className="border-b border-slate-200 bg-white px-4 sm:px-6 shadow-2xs">
        <div className="max-w-6xl mx-auto flex items-center gap-1.5 overflow-x-auto py-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-700' : 'text-slate-500'}`} aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {children}
      </main>
    </div>
  );
}
