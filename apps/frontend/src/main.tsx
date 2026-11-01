import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './index.css';

async function enableMocking() {
  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_MSW === 'true') {
    const [{ worker }, { mockKit }, { registerMockKit }] = await Promise.all([
      import('./mocks/browser.js'),
      import('./mocks/scenarios.js'),
      import('./mocks/kit.js'),
    ]);
    registerMockKit(mockKit);
    await worker.start({ quiet: true });
  }
}

enableMocking().then(() => {
  const rootEl = document.getElementById('root');
  if (rootEl) {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
});
