import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from '../src/mocks/server.js';
import { mockKit, resetMockDb } from '../src/mocks/scenarios.js';
import { registerMockKit } from '../src/mocks/kit.js';

registerMockKit(mockKit);
beforeAll(() => server.listen());
beforeEach(() => {
  resetMockDb();
  sessionStorage.clear();
});
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
