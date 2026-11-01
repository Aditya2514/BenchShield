/**
 * "mock": requests are answered by MSW using fixtures/scenarios (captured from
 * the real backend). Enabled with VITE_ENABLE_MSW=true in dev, and in tests.
 * "live": requests go to the backend (proxied by Vite to 127.0.0.1:8000 in dev).
 */
export type AppMode = 'live' | 'mock';

export function getAppMode(): AppMode {
  return import.meta.env.VITE_ENABLE_MSW === 'true' ? 'mock' : 'live';
}
