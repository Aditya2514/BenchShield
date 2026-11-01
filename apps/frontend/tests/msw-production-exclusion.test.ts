import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

describe('MSW Production Exclusion Check', () => {
  it('executes check:no-msw script to assert zero MSW leakage in production dist', () => {
    // Run npm run check:no-msw from repo root
    const output = execSync('node scripts/check-no-msw.js', {
      cwd: rootDir,
      encoding: 'utf-8',
    });

    expect(output).toContain('PASS: Production build contains zero MSW runtime or worker assets.');
  }, 30000);
});

