import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, '../apps/frontend/dist');
const workerInDist = path.join(distDir, 'mockServiceWorker.js');

console.log('Running production build for apps/frontend...');
execSync('npm run build --workspace=apps/frontend', { stdio: 'inherit' });

if (fs.existsSync(workerInDist)) {
  console.error('FAIL: mockServiceWorker.js was copied to apps/frontend/dist in production build!');
  process.exit(1);
}

let foundMswRuntime = false;
function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('setupWorker') || content.includes('createBrowserWorker')) {
        console.error(`FAIL: Found MSW browser worker code in production bundle: ${entry.name}`);
        foundMswRuntime = true;
      }
    }
  }
}

scanDir(distDir);

if (foundMswRuntime) {
  console.error('FAIL: Production build contains MSW runtime artifacts!');
  process.exit(1);
}

console.log('PASS: Production build contains zero MSW runtime or worker assets.');
process.exit(0);

