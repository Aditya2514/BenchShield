import type { ScenarioData } from './scenarios.js';

/**
 * Mock-mode hooks for the UI (scenario picker, simulated 401). Registered by
 * main.tsx in mock mode and by tests/setup.ts, so production builds never
 * import the fixtures or MSW.
 */
export interface MockKit {
  scenarios: Record<string, ScenarioData>;
  defaultScenarioId: string;
  simulateExpiry: () => void;
}

let kit: MockKit | null = null;

export function registerMockKit(k: MockKit): void {
  kit = k;
}

export function getMockKit(): MockKit | null {
  return kit;
}
