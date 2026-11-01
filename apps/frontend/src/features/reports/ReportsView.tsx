import { useEffect, useState } from 'react';
import { FileCheck, Download, Lock, FileText, ShieldAlert } from 'lucide-react';
import type { ReportStatusResponse } from '@benchshield/api-client';
import { createReport, fetchReportContent, getReport, saveBlob, type FrozenReport } from '../../api/endpoints.js';
import { errorMessage } from '../../api/http.js';
import type { NavTab } from '../../components/Shell.js';
import { formatDateTime } from '../../lib/time.js';
import { Card, CardHeader, CardContent, Button, Badge, Alert, EmptyState } from '../../components/ui';

interface Props {
  investigationId: string | null;
  report: ReportStatusResponse | null;
  onReportChange: (r: ReportStatusResponse | null) => void;
  onNavigate?: (t: NavTab) => void;
}

export function ReportsView({ investigationId, report, onReportChange, onNavigate }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<FrozenReport | null>(null);

  useEffect(() => {
    if (report?.status === 'completed' && report.download_url) {
      fetchReportContent(report.download_url).then((r) => setContent(r.data)).catch(() => setContent(null));
    }
  }, [report?.report_id, report?.status, report?.download_url]);

  if (!investigationId) {
    return <EmptyState icon={<FileText className="w-6 h-6" aria-hidden="true" />} title="No investigation selected" description="Reports freeze an investigation's findings and review decisions." action={<Button onClick={() => onNavigate?.('investigations')}>Go to investigations</Button>} />;
  }

  const freeze = async () => {
    setBusy(true); setError(null);
    try { onReportChange(await createReport(investigationId)); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  const download = async () => {
    if (!report) return;
    setBusy(true); setError(null);
    try {
      // Renew the authorization window if it lapsed, then fetch with auth headers.
      let r = report;
      if (!r.authorized_until || new Date(r.authorized_until).getTime() <= Date.now()) {
        r = await getReport(report.report_id);
        onReportChange(r);
      }
      if (!r.download_url) throw new Error('Report has no download URL.');
      const { raw } = await fetchReportContent(r.download_url);
      saveBlob(raw, `benchshield-${r.report_version}.json`);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3">
              <FileCheck className="w-5 h-5 text-indigo-700" aria-hidden="true" />
              <h2 className="text-base sm:text-lg font-bold">Versioned Audit Report</h2>
              {report && <Badge variant={report.status === 'completed' ? 'success' : report.status === 'failed' ? 'danger' : 'info'} className="font-mono">{report.status.toUpperCase()}</Badge>}
            </div>
            <div className="flex gap-2">
              <Button variant={report ? 'secondary' : 'primary'} onClick={freeze} disabled={busy} icon={<Lock className="w-3.5 h-3.5" aria-hidden="true" />}>{busy ? 'Working...' : report ? 'Freeze New Version' : 'Freeze & Generate Report'}</Button>
              {report?.status === 'completed' && <Button onClick={download} disabled={busy} icon={<Download className="w-3.5 h-3.5" aria-hidden="true" />}>Download Authorized Report</Button>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          {error && <Alert variant="danger" title="Report Export Error">{error}</Alert>}
          {!report && <p className="text-slate-500">No frozen report yet. Freezing locks the current findings, reviewer decisions, policy and scope. Later reviews do not change an issued report.</p>}
          {report?.status === 'failed' && (
            <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-300 flex gap-3">
              <ShieldAlert className="w-5 h-5 text-red-700" aria-hidden="true" />
              <div><h3 className="text-sm font-bold text-red-950">Report Generation Failure</h3><p>The report export failed. <strong>The underlying investigation data, verified findings, and reviewer adjudications remain completely intact, valid, and unaffected.</strong></p></div>
            </div>
          )}
          {report?.status === 'completed' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border"><b className="block">Frozen Report ID</b><span className="font-mono text-sm">{report.report_version}</span></div>
              <div className="p-3 bg-slate-50 rounded-xl border"><b className="block">Download authorized until</b>{formatDateTime(report.authorized_until)}</div>
              <div className="p-3 bg-slate-50 rounded-xl border"><b className="block">Verified claims</b>{content?.summary_counts?.verified_claims_count ?? '—'}</div>
              <div className="p-3 bg-slate-50 rounded-xl border"><b className="block">Unresolved claims</b>{content?.summary_counts?.needs_review_count ?? '—'}</div>
            </div>
          )}
          {content && (
            <>
              <p><b>Items with verified exposure:</b> {content.items_with_verified_exposure.join(', ') || 'none'}</p>
              <p className="font-mono break-all"><b>SHA-256:</b> {content.content_sha256}</p>
              {content.limitations.length > 0 && (
                <Alert variant="warning" title="Explicit Scope Limitations:"><ul className="list-disc list-inside">{content.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul></Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
