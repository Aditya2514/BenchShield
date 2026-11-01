import React, { useState, useRef, useEffect } from 'react';
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
  ChevronDown,
  Check,
  LogOut,
  Wifi,
} from 'lucide-react';
import type { AppMode } from '../api/mode.js';
import type { Session } from '../api/http.js';
import type { Workflow } from '../workflow.js';

export type NavTab = 'benchmarks' | 'policies' | 'investigations' | 'findings' | 'experiments' | 'reports';

interface ShellProps {
  mode: AppMode;
  session: Session | null;
  workflow: Workflow;
  onDisconnect?: () => void;
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
  mode,
  session,
  workflow,
  onDisconnect,
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
  const [isScenarioOpen, setIsScenarioOpen] = useState(false);
  const scenarioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (scenarioRef.current && !scenarioRef.current.contains(event.target as Node)) {
        setIsScenarioOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsScenarioOpen(false);
      }
    };
    if (isScenarioOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isScenarioOpen]);

  const selectedScenarioName =
    scenarioList.find((s) => s.id === selectedScenario)?.name || selectedScenario;

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
                v0.3
              </span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                  mode === 'mock'
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                }`}
              >
                {mode === 'mock' ? 'Demo data (mock API)' : 'Live API'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Workspace:{' '}
              <strong className="text-slate-800 font-semibold font-mono">{session?.workspaceId ?? 'not connected'}</strong>
              {session?.label && <span className="text-slate-500"> · {session.label}</span>}
            </p>
          </div>
        </div>

        {/* Right Header Actions: live connection, or mock scenario switcher & 401 simulation */}
        <div className="flex items-center gap-3">
          {mode === 'live' && session && onDisconnect && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800 font-medium">
                <Wifi className="w-3.5 h-3.5" aria-hidden="true" /> Connected
              </span>
              <button
                type="button"
                onClick={onDisconnect}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" /> Disconnect
              </button>
            </div>
          )}
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

          {mode === 'mock' && (
          <div className="flex items-center gap-2">
            <label htmlFor="scenario-selector" className="text-xs font-semibold text-slate-600">
              Active Mock Scenario:
            </label>
            <div className="relative inline-flex items-center" ref={scenarioRef}>
              {/* Native select retained for accessibility and test change events */}
              <select
                id="scenario-selector"
                aria-label="Active Mock Scenario:"
                value={selectedScenario}
                onChange={(e) => onScenarioChange(e.target.value)}
                className="sr-only"
              >
                {scenarioList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* Polished custom select button */}
              <button
                type="button"
                onClick={() => setIsScenarioOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={isScenarioOpen}
                aria-controls="scenario-dropdown-menu"
                className="flex items-center justify-between gap-3 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-lg pl-3 pr-2.5 py-1.5 text-xs font-semibold text-slate-900 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 transition-all cursor-pointer min-w-[240px] max-w-[340px]"
              >
                <span className="truncate text-left text-slate-800">{selectedScenarioName}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 ${
                    isScenarioOpen ? 'rotate-180 text-indigo-700' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {/* Styled dropdown menu popup */}
              {isScenarioOpen && (
                <div
                  role="listbox"
                  id="scenario-dropdown-menu"
                  aria-label="Mock Scenarios"
                  className="absolute right-0 top-full mt-1.5 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-1.5 space-y-1"
                >
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                    Select Mock Scenario
                  </div>
                  {scenarioList.map((s) => {
                    const isSelected = s.id === selectedScenario;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onScenarioChange(s.id);
                          setIsScenarioOpen(false);
                        }}
                        className={`w-full text-left flex items-start justify-between gap-2.5 p-2.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/90 text-indigo-950 font-semibold ring-1 ring-indigo-200'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-slate-900 font-semibold">{s.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                            ID: {s.id}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          )}
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
                The API rejected your token (expired or invalid). Re-authenticate to resume secure investigation operations.
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

      {/* Current audit context: what the next step will use */}
      {session && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 sm:px-6">
          <dl className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-5 gap-y-1 py-2 text-[11px] text-slate-600">
            <div className="flex gap-1.5">
              <dt className="font-semibold">Benchmark:</dt>
              <dd className="font-mono text-slate-800">{workflow.benchmark?.benchmark_version_id ?? '—'}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="font-semibold">Policy:</dt>
              <dd className="font-mono text-slate-800">{workflow.policy?.policy_version_id ?? '—'}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="font-semibold">Investigation:</dt>
              <dd className="font-mono text-slate-800">{workflow.investigationId ?? '—'}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="font-semibold">Report:</dt>
              <dd className="font-mono text-slate-800">{workflow.report?.report_version ?? '—'}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {children}
      </main>
    </div>
  );
}
