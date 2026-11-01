import { useState } from 'react';
import {
  FileCheck,
  Download,
  AlertTriangle,
  Lock,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import type { ReportResponse } from '@benchshield/api-client';

interface ReportsViewProps {
  initialReport: ReportResponse | null;
  investigationId: string;
}

export function ReportsView({
  initialReport,
  investigationId,
}: ReportsViewProps) {
  const [report, setReport] = useState<ReportResponse | null>(initialReport);
  const [isFreezing, setIsFreezing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleFreezeReport = async () => {
    setIsFreezing(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/v1/investigations/${investigationId}/reports`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to trigger report freeze.');
      }
      setReport(data);
    } catch (err: any) {
      setActionError(err.message || 'Error creating report export job.');
    } finally {
      setIsFreezing(false);
    }
  };

  const handleDownload = () => {
    if (report?.download_url) {
      window.open(report.download_url, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-950 text-indigo-400 border border-indigo-700/50 rounded-lg">
              <FileCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white">Versioned Audit Report</h2>
                {report && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold ${
                    report.status === 'completed'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                      : report.status === 'failed'
                      ? 'bg-red-950 text-red-300 border border-red-800/60'
                      : 'bg-indigo-950 text-indigo-300 border border-indigo-700/60'
                  }`}>
                    {report.status.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Investigation: <code className="text-slate-300">{investigationId}</code> | Freezes benchmark, item, snapshot, verifier and reviewer action versions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!report && (
              <button
                onClick={handleFreezeReport}
                disabled={isFreezing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                {isFreezing ? 'Freezing Report...' : 'Freeze & Generate Report'}
              </button>
            )}

            {report?.status === 'completed' && report.download_url && (
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                Download Authorized Report
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <div role="alert" className="p-3 bg-red-950/70 border border-red-700/60 rounded-lg text-xs text-red-200">
            {actionError}
          </div>
        )}

        {/* Distinct Failure Notice: Report Export Failure is strictly distinct from investigation failure */}
        {report?.status === 'failed' && (
          <div
            role="alert"
            className="p-4 rounded-lg bg-red-950/80 border border-red-700/80 flex items-start gap-3 text-xs"
          >
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-bold text-red-200">
                Report Generation Failure (export_failed)
              </h3>
              <p className="text-red-300/90 mt-1">
                The report artifact freeze failed downstream. <strong>The underlying investigation data, verified findings, and reviewer adjudications remain completely intact, valid, and unaffected.</strong>
              </p>
              <p className="text-red-400 font-mono mt-1">
                Error Code: {report.error_code || 'export_failed'}
              </p>
            </div>
          </div>
        )}

        {/* Frozen Report Metadata Card */}
        {report && report.status === 'completed' && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Frozen Report ID</span>
                <span className="text-sm font-mono font-bold text-white">
                  {report.report_version_id || report.report_id}
                </span>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" /> Frozen Timestamp
                </span>
                <span className="text-sm font-mono text-slate-200">
                  {report.frozen_at ? new Date(report.frozen_at).toLocaleTimeString() : 'N/A'}
                </span>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Reviewer Decisions</span>
                <span className="text-sm font-bold text-emerald-300">
                  {report.reviewer_decisions_count} recorded
                </span>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Unresolved Claims</span>
                <span className="text-sm font-bold text-slate-300">
                  {report.unresolved_claims_count}
                </span>
              </div>
            </div>

            {report.limitations && report.limitations.length > 0 && (
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5 text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" aria-hidden="true" /> Explicit Scope Limitations:
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
                  {report.limitations.map((lim, i) => (
                    <li key={i}>{lim}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

