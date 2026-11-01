import React, { useEffect, useState } from 'react';
import { KeyRound, LogIn, Server } from 'lucide-react';
import { ApiError, errorMessage, rawRequest, setSession, type Session } from '../../api/http.js';
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui';

interface DevUser {
  label: string;
  role: string;
  workspace_id: string;
  token: string;
}

/**
 * Confirms a token works without side effects: an unknown policy version
 * returns 404 when authenticated, 401 for a bad token and 403 for a
 * non-member of the workspace.
 */
async function checkSession(): Promise<void> {
  try {
    await rawRequest('/api/v1/policies/versions/connection-check');
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return;
    throw err;
  }
}

export function ConnectPanel({ onConnected }: { onConnected: (s: Session) => void }) {
  const [devUsers, setDevUsers] = useState<DevUser[] | null>(null);
  const [token, setToken] = useState('');
  const [workspaceId, setWorkspaceId] = useState('ws_alpha');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only scripts/dev_server.py serves this; production backends return 404.
    fetch('/dev/session')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { users?: DevUser[] } | null) => setDevUsers(d?.users ?? null))
      .catch(() => setDevUsers(null));
  }, []);

  const connect = async (s: Session) => {
    setBusy(true);
    setError(null);
    setSession(s);
    try {
      await checkSession();
      onConnected(s);
    } catch (err) {
      setSession(null);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void connect({ token: token.trim().replace(/^Bearer\s+/i, ''), workspaceId: workspaceId.trim() });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg shrink-0">
            <KeyRound className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle>Connect to the BenchShield API</CardTitle>
            <CardDescription>
              The backend checks a signed token and your workspace membership on every request.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="danger" title="Could not connect">
            {error}
          </Alert>
        )}

        {devUsers && devUsers.length > 0 && (
          <section aria-labelledby="dev-login-title" className="space-y-2">
            <h3 id="dev-login-title" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-indigo-600" aria-hidden="true" /> Local dev server users
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {devUsers.map((u) => (
                <Button
                  key={u.label}
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => connect({ token: u.token, workspaceId: u.workspace_id, label: u.label })}
                  icon={<LogIn className="w-3.5 h-3.5" aria-hidden="true" />}
                >
                  {u.label} ({u.role})
                </Button>
              ))}
            </div>
          </section>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" aria-label="Connect with a token">
          <div>
            <label htmlFor="api-token" className="block text-xs font-semibold text-slate-700 mb-1">
              Bearer token <span className="text-red-600">*</span>
            </label>
            <textarea
              id="api-token"
              rows={3}
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJhbGciOi..."
              className="w-full font-mono text-xs bg-white border border-slate-300 rounded-lg p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
          <div>
            <label htmlFor="workspace-id" className="block text-xs font-semibold text-slate-700 mb-1">
              Workspace ID <span className="text-red-600">*</span>
            </label>
            <input
              id="workspace-id"
              required
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="w-full max-w-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
          <Button type="submit" disabled={busy} icon={<LogIn className="w-4 h-4" aria-hidden="true" />}>
            {busy ? 'Connecting...' : 'Connect'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
