import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './index.css';

async function enableMocking() {
  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_MSW === 'true') {
    const { worker } = await import('./mocks/browser.js');
    return worker.start();
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
