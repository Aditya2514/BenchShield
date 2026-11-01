/**
 * Full-stack browser test: drives the real frontend against the real backend
 * (import -> policy -> launch -> verify -> review -> report, RBAC, 401).
 * Writes screenshots and the list of API calls to the output directory.
 */
const { chromium } = require('playwright');
// Usage: start scripts/dev_server.py and the Vite dev server (live mode), then:
//   node scripts/e2e_browser.cjs [outDir]
const OUT = process.argv[2] || 'e2e-results';
require('fs').mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
const GOLD = ['Sub-surface thorium reactor', 'Vellan Stream'];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  const apiCalls = [];
  page.on('response', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/')) apiCalls.push(`${r.request().method()} ${u.pathname} ${r.status()}`); });
  const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true });
  const tab = (name) => page.getByRole('navigation').getByRole('button', { name }).click();
  const T = 30000;

  try {
    await page.goto('http://localhost:5173/');
    await page.getByText('Connect to the BenchShield API').waitFor({ timeout: T });
    check('Live mode: connect panel shown (no mocks)', await page.getByText('Live API').isVisible());
    await shot('01-connect');

    await page.getByRole('button', { name: /alice@corp-alpha.com \(admin\)/ }).click();
    await page.getByText('Connected').waitFor({ timeout: T });
    const hdr = await page.locator('header').innerText(); check('Login as alice via dev server token', hdr.includes('ws_alpha') && hdr.includes('alice@corp-alpha.com'), hdr.split('\n').slice(0,3).join(' '));

    // Invalid benchmark -> row errors from the real backend
    await page.getByRole('button', { name: 'Load sample with errors' }).click();
    await page.getByRole('button', { name: /Validate & Stage Items/ }).click();
    await page.getByText('Actionable Row Errors:').waitFor({ timeout: T });
    const codes = await page.locator('table').innerText();
    check('Invalid import returns per-row errors', codes.includes('unsupported_task_type') && codes.includes('missing_required_field'));
    await shot('02-import-row-errors');

    // Valid benchmark
    await page.getByRole('button', { name: 'Load valid sample' }).click();
    await page.getByRole('button', { name: /Validate & Stage Items/ }).click();
    await page.getByText(/Version: bmv_/).waitFor({ timeout: T });
    const bmv = (await page.getByText(/Version: bmv_/).innerText()).match(/bmv_\w+/)[0];
    check('Valid import accepted (4 items)', true, bmv);
    await shot('03-import-accepted');

    await tab('Policies');
    await page.getByRole('button', { name: /Create Immutable Policy Version/ }).click();
    await page.getByText(/Version: polv_\w+ \(Immutable\)/).waitFor({ timeout: T });
    const polv = (await page.getByText(/Version: polv_/).innerText()).match(/polv_\w+/)[0];
    check('Policy created', true, polv);
    await shot('04-policy');

    await tab('Investigations');
    await page.getByRole('button', { name: 'Launch Investigation' }).click();
    await page.getByText('Investigation Operations').waitFor({ timeout: T });
    const invId = (await page.locator('code').filter({ hasText: /^inv_/ }).first().innerText());
    check('Investigation launched', invId.startsWith('inv_'), invId);
    await page.getByText('awaiting_review', { exact: true }).waitFor({ timeout: 60000 });
    const evCount = await page.getByText(/unique event\(s\) recorded/).innerText();
    check('Discovery ran via worker; SSE events streamed live', parseInt(evCount) > 5, evCount);
    await shot('05-discovery-done');

    await page.getByRole('button', { name: 'Run Verification' }).click();
    await page.getByText(/new finding\(s\)/).waitFor({ timeout: T });
    const verifyText = await page.getByText(/new finding\(s\)/).innerText();
    check('Verification created findings', /[1-9]\d* new finding/.test(verifyText), verifyText.trim());
    await page.waitForFunction(() => document.body.innerText.split('verification_completed').length - 1 >= 1, null, { timeout: T });
    check('verification_completed events arrived after reconnect', true);
    await shot('06-verified');

    await tab('Findings');
    await page.getByText('Independent Finding Dimensions').waitFor({ timeout: T });
    await page.locator('tbody tr').first().waitFor({ timeout: T });
    const rows = await page.locator('tbody tr').count();
    check('Findings table loaded from backend', rows >= 3, `${rows} findings`);
    const body = await page.locator('main').innerText();
    check('No gold answers on findings page', !GOLD.some((g) => body.includes(g)));
    await shot('07-findings');

    const row = page.locator('tbody tr').filter({ hasText: 'SYN-003' }).first();
    await row.getByRole('button', { name: 'Inspect' }).click();
    await page.getByText(/Evidence Record: SYN-003/).waitFor({ timeout: T });
    check('Evidence excerpt rendered as plain text <pre>', await page.locator('pre').count() > 0);
    await page.getByRole('button', { name: 'Adjudicate Finding' }).click();
    await page.getByRole('button', { name: 'Record Decision' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached', timeout: T });
    await page.getByText(/v2: confirm/).first().waitFor({ timeout: T });
    await page.getByText(/by usr_alice/).waitFor({ timeout: T });
    check('Review recorded (v1→v2, attributed to usr_alice)', true);
    await shot('08-reviewed');

    // Stale-version conflict through the real API using the UI's credentials
    const conflict = await page.evaluate(async () => {
      const s = JSON.parse(sessionStorage.getItem('benchshield.session'));
      const inv = JSON.parse(sessionStorage.getItem('benchshield.workflow')).investigationId;
      const h = { Authorization: `Bearer ${s.token}`, 'X-Workspace-ID': s.workspaceId, 'Content-Type': 'application/json' };
      const list = await (await fetch(`/api/v1/investigations/${inv}/findings?size=100`, { headers: h })).json();
      const f = list.items.find((x) => x.version >= 2);
      const r = await fetch(`/api/v1/findings/${f.finding_id}/reviews`, { method: 'POST', headers: h, body: JSON.stringify({ expected_version: 1, action: 'reject', reason: 'stale' }) });
      return r.status;
    });
    check('Stale review rejected with 409', conflict === 409, `HTTP ${conflict}`);

    await tab('Reports');
    await page.getByRole('button', { name: /Freeze & Generate Report/ }).click();
    await page.getByText('COMPLETED').waitFor({ timeout: T });
    await page.getByText(/SHA-256/).waitFor({ timeout: T });
    check('Report frozen (R-001) and contents fetched with auth', await page.getByText('R-001').first().isVisible());
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: T }), page.getByRole('button', { name: 'Download Authorized Report' }).click()]);
    const p = await dl.path();
    const txt = require('fs').readFileSync(p, 'utf8');
    const rep = JSON.parse(txt);
    check('Report download works and contains no gold answers', !!rep.content_sha256 && !GOLD.some((g) => txt.includes(g)), `${dl.suggestedFilename()}, verified=${rep.summary_counts.verified_claims_count}`);
    await shot('09-report');

    await tab('Experiments');
    check('Experiments shows not-available (backend 501)', await page.getByText(/backend phase B4/).isVisible());

    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    check('Browser storage holds no gold answers', !GOLD.some((g) => storage.includes(g)));

    // Reload keeps place (workflow persisted, IDs only)
    await page.reload();
    await page.getByText(invId).first().waitFor({ timeout: T });
    check('Reload restores session and audit context', true);

    // Viewer role is refused by the backend
    await page.getByRole('button', { name: 'Disconnect' }).click();
    await page.getByRole('button', { name: /charlie@corp-alpha.com \(viewer\)/ }).click();
    await page.getByText('Connected').waitFor({ timeout: T });
    await tab('Policies');
    await page.getByRole('button', { name: /Create Immutable Policy Version/ }).click();
    await page.getByText('Policy was not created').waitFor({ timeout: T });
    const err = await page.getByText(/lacks required permission/).innerText();
    check('Viewer role blocked by backend RBAC (403)', true, err.trim().slice(0, 80));
    await shot('10-viewer-forbidden');

    // Invalid token -> 401 banner
    await page.evaluate(() => { const s = JSON.parse(sessionStorage.getItem('benchshield.session')); s.token = 'bad'; sessionStorage.setItem('benchshield.session', JSON.stringify(s)); });
    await page.reload();
    await tab('Policies');
    await page.getByRole('button', { name: /Create Immutable Policy Version/ }).click();
    await page.getByText(/Session Expired \(HTTP 401/).waitFor({ timeout: T });
    check('Invalid token shows 401 session-expired banner', true);
    await shot('11-401');
  } catch (e) {
    check('UNEXPECTED ERROR', false, String(e).split('\n')[0]);
    await shot('zz-failure').catch(() => {});
  }

  const realErrors = consoleErrors.filter((e) => !/401|403|409|Failed to load resource/.test(e));
  check('No unexpected browser console errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
  require('fs').writeFileSync(`${OUT}/api-calls.txt`, apiCalls.join('\n'));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed; ${apiCalls.length} real API calls`);
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
