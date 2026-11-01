import { useState } from 'react';
import {
  FileCheck,
  Download,
  Lock,
  Clock,
  ShieldAlert,
  RefreshCw,
  FileText,
} from 'lucide-react';
import type { ReportResponse } from '@benchshield/api-client';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  Alert,
  EmptyState,
} from '../../components/ui';

interface ExtendedReportResponse extends ReportResponse {
  download_expires_at?: string;
}

interface ReportsViewProps {
  initialReport: ReportResponse | null;
  investigationId: string;
}

export function ReportsView({
  initialReport,
  investigationId,
}: ReportsViewProps) {
  const [report, setReport] = useState<ExtendedReportResponse | null>(() => {
    if (!initialReport) return null;
    return {
      ...initialReport,
      // Default expiration 1 hour from now for mock data if not set
      download_expires_at: (initialReport as ExtendedReportResponse).download_expires_at ||
        new Date(Date.now() + 3600 * 1000).toISOString(),
    };
  });

  const [isFreezing, setIsFreezing] = useState(false);
  const [isRefreshingDownload, setIsRefreshingDownload] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [forceExpired, setForceExpired] = useState<boolean>(false);

  const isDownloadExpired = forceExpired || (
    report?.download_expires_at
      ? new Date(report.download_expires_at).getTime() <= Date.now()
      : false
  );

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
      setReport({
        ...data,
        download_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error creating report export job.');
    } finally {
      setIsFreezing(false);
    }
  };

  const handleDownload = async () => {
    if (!report?.download_url) return;

    // Expired Download Flow
    // If the pre-signed download URL is expired, request a fresh pre-signed link
    if (isDownloadExpired) {
      setIsRefreshingDownload(true);
      setRefreshNotice('Secure download link has expired. Fetching fresh pre-signed link...');
      setActionError(null);

      try {
        const res = await fetch(`/api/v1/investigations/${investigationId}/reports`);
        if (!res.ok) {
          throw new Error('Failed to refresh expired download link');
        }
        const freshData = await res.json();
        const freshExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

        setReport({
          ...freshData,
          download_url: freshData.download_url || report.download_url,
          download_expires_at: freshExpiresAt,
        });
        setForceExpired(false);
        setRefreshNotice('Download link successfully refreshed.');

        // Trigger download with fresh URL
        if (freshData.download_url || report.download_url) {
          window.open(freshData.download_url || report.download_url, '_blank');
        }
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : 'Failed to refresh download link.');
      } finally {
        setIsRefreshingDownload(false);
      }
      return;
    }

    // Direct download when active
    window.open(report.download_url, '_blank');
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success' as const;
      case 'failed':
        return 'danger' as const;
      default:
        return 'info' as const;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg shrink-0">
                <FileCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    Versioned Audit Report
                  </h2>
                  {report && (
                    <Badge variant={getStatusBadgeVariant(report.status)} className="font-mono">
                      {report.status.toUpperCase()}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Investigation: <code className="text-slate-700 font-semibold">{investigationId}</code> | Freezes benchmark, item, snapshot, verifier and reviewer action versions.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {!report && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleFreezeReport}
                  disabled={isFreezing}
                  icon={<Lock className="w-3.5 h-3.5" aria-hidden="true" />}
                >
                  {isFreezing ? 'Freezing Report...' : 'Freeze & Generate Report'}
                </Button>
              )}

              {report?.status === 'completed' && report.download_url && (
                <div className="flex items-center gap-2">
                  {isDownloadExpired && (
                    <Badge variant="warning" className="font-mono">
                      URL Expired
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isRefreshingDownload}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                      isDownloadExpired
                        ? 'bg-amber-600 hover:bg-amber-700 text-white focus-visible:ring-amber-500'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white focus-visible:ring-emerald-500'
                    }`}
                    aria-label={isDownloadExpired ? 'Download Expired: Click to Refresh & Download' : 'Download Authorized Report'}
                  >
                    {isRefreshingDownload ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    {isRefreshingDownload
                      ? 'Refreshing URL...'
                      : isDownloadExpired
                      ? 'Refresh & Download Report'
                      : 'Download Authorized Report'}
                  </button>

                  {/* Simulation toggle for test / verification */}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setForceExpired(!forceExpired)}
                    title="Simulate expired pre-signed link"
                  >
                    {forceExpired ? 'Reset Expiry' : 'Simulate Expired Link'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {refreshNotice && (
            <Alert role="status" variant="info" title="Download Notice">
              {refreshNotice}
            </Alert>
          )}

          {actionError && (
            <Alert variant="danger" title="Report Export Error">
              {actionError}
            </Alert>
          )}

          {/* Empty State when no report has been generated */}
          {!report && (
            <EmptyState
              icon={<FileText className="w-6 h-6 text-slate-500" aria-hidden="true" />}
              title="No Frozen Report Generated"
              description="Report freezing creates an immutable, cryptographically verifiable record of the current audit state. All verified findings, temporal evidence, and reviewer adjudications will be permanently version-locked."
              action={
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleFreezeReport}
                  disabled={isFreezing}
                  icon={<Lock className="w-3.5 h-3.5" aria-hidden="true" />}
                >
                  {isFreezing ? 'Freezing Report...' : 'Freeze & Generate Report'}
                </Button>
              }
            />
          )}

          {/* Distinct Failure Notice: Report Export Failure is strictly distinct from investigation failure */}
          {report?.status === 'failed' && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-red-50 border border-red-300 flex items-start gap-3 text-xs"
            >
              <ShieldAlert className="w-5 h-5 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-bold text-red-950">
                  Report Generation Failure (export_failed)
                </h3>
                <p className="text-red-900 mt-1">
                  The report artifact freeze failed downstream. <strong>The underlying investigation data, verified findings, and reviewer adjudications remain completely intact, valid, and unaffected.</strong>
                </p>
                <p className="text-red-700 font-mono mt-1 font-semibold">
                  Error Code: {report.error_code || 'export_failed'}
                </p>
              </div>
            </div>
          )}

          {/* Frozen Report Metadata Card */}
          {report && report.status === 'completed' && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-slate-500 font-semibold block mb-1">Frozen Report ID</span>
                  <span className="text-sm font-mono font-bold text-slate-900">
                    {report.report_version_id || report.report_id}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-slate-500 font-semibold block mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" /> Frozen Timestamp
                  </span>
                  <span className="text-sm font-mono text-slate-800 font-semibold">
                    {report.frozen_at ? new Date(report.frozen_at).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-slate-500 font-semibold block mb-1">Reviewer Decisions</span>
                  <span className="text-sm font-bold text-emerald-800">
                    {report.reviewer_decisions_count} recorded
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-slate-500 font-semibold block mb-1">Unresolved Claims</span>
                  <span className="text-sm font-bold text-slate-800">
                    {report.unresolved_claims_count}
                  </span>
                </div>
              </div>

              {report.limitations && report.limitations.length > 0 && (
                <Alert variant="warning" title="Explicit Scope Limitations:">
                  <ul className="list-disc list-inside space-y-1 text-amber-900 font-medium pl-1 mt-1">
                    {report.limitations.map((lim, i) => (
                      <li key={i}>{lim}</li>
                    ))}
                  </ul>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
