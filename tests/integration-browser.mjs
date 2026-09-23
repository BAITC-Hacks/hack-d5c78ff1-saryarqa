/** Real atlas integration acceptance; optional Playwright/Chrome, no application dependency. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const output = resolve(process.env.AKIM_TEST_OUTPUT || '.codex-private/integration-browser');
const base = process.env.AKIM_TEST_URL || 'http://127.0.0.1:3027';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(12000);
const report = { browser: browser.version(), base, scene: 'not yet verified', checks: [], widths: [], failures: [], consoleErrors: [], pageErrors: [], failedResources: [], navigationCancellations: [], limitations: ['Physical touchscreen gestures and full frame-rate performance are not tested.', 'No AI requests are made by this harness; browser-smoke uses explicit mocks and separate live-provider evidence is required.'] };
let navigating = false;
page.on('pageerror', error => report.pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ text: message.text(), location: message.location().url }); });
page.on('response', response => { if (response.status() >= 400) report.failedResources.push(`${response.status()} ${response.url()}`); });
page.on('requestfailed', request => {
  const failure = `${request.failure()?.errorText} ${request.url()}`;
  if (navigating && request.failure()?.errorText === 'net::ERR_ABORTED') report.navigationCancellations.push(failure);
  else report.failedResources.push(failure);
});
async function navigate(url) {
  navigating = true;
  try { await page.goto(url, { waitUntil: 'networkidle' }); }
  finally { navigating = false; }
}
async function check(name, action) {
  try { await action(); report.checks.push(name); }
  catch (error) { report.failures.push({ name, message: error.message }); }
}
async function layout(surface, width) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const measurement = await page.evaluate(() => {
    const controls = [...document.querySelectorAll('button, select, input')].filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
    return { overflow: document.documentElement.scrollWidth > innerWidth + 1, clippedControls: controls.flatMap(node => {
      const rect = node.getBoundingClientRect();
      const label = node.id || node.getAttribute('aria-label') || node.textContent.trim().slice(0, 65);
      if (rect.left < -1 || rect.right > innerWidth + 1) return [{ label, reason: 'outside viewport', left: rect.left, right: rect.right }];
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent), box = parent.getBoundingClientRect();
        if (style.overflowX === 'hidden' && (rect.left < box.left - 1 || rect.right > box.right + 1)) return [{ label, reason: 'clipped by ancestor' }];
      }
      return [];
    }) };
  });
  report.widths.push({ surface, width, ...measurement });
  await page.screenshot({ path: resolve(output, `${surface}-${width}.png`), fullPage: true });
  assert.equal(measurement.overflow, false, `${surface} overflow at ${width}`);
  assert.deepEqual(measurement.clippedControls, [], `${surface} clipped controls at ${width}`);
}
try {
  await navigate(base);
  await check('Main application mounts real atlas and roads', async () => {
    await page.locator('#scene-root .akim-atlas').waitFor();
    assert.ok(await page.locator('.atlas-layer-roads path').count() > 0);
    assert.equal(await page.locator('#scene-notice').isVisible(), false);
    assert.equal(await page.locator('.atlas-sidebar, .atlas-search, [data-tab="districts"]').count(), 0);
    assert.doesNotMatch(await page.locator('body').innerText(), /Other Places|Другие места/i);
    report.scene = 'actual sourced Astana atlas mounted in main application, not fixture';
  });
  for (const width of [320, 375, 430, 768, 1024, 1440]) await check(`Main default layout ${width}`, () => layout('main-default', width));
  await page.locator('#sample-button').click();
  for (const width of [320, 375, 430, 768, 1024, 1440]) await check(`Main selected plan layout ${width}`, () => layout('main-plan', width));
  await check('Official example: budget 95, score 56.54, zero critical cells, mode parity', async () => {
    await page.locator('#sample-button').click();
    await page.locator('#mode-calculator').click();
    assert.equal(await page.locator('#budget-used').textContent(), '95');
    assert.equal(await page.locator('#selection-count').textContent(), '5/5');
    await page.locator('#calculate-button').click();
    await page.locator('#results').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#result-score').textContent(), '56,54');
    assert.equal(await page.locator('#result-critical').textContent(), '0');
    await page.locator('#mode-game').click();
    assert.equal(await page.locator('#result-score').textContent(), '56,54');
    assert.equal(await page.locator('#playback-status').textContent(), 'Прогноз готов');
  });
  await check('Main real atlas replay naturally completes and skip preserves result', async () => {
    await page.locator('#playback-speed').selectOption('4');
    await page.locator('#playback-replay').click();
    await page.waitForFunction(() => document.querySelector('#playback-status').textContent === 'Прогноз готов', null, { timeout: 15000 });
    assert.equal(await page.locator('#result-score').textContent(), '56,54');
    await page.locator('#playback-replay').click();
    await page.locator('#playback-skip').click();
    assert.equal(await page.locator('#result-score').textContent(), '56,54');
  });
  for (const width of [320, 375, 430, 768, 1024, 1440]) await check(`Main forecast results layout ${width}`, () => layout('main-results', width));
  await navigate(`${base}/scene/dev.html`);
  await page.waitForFunction(() => window.akimSceneDev?.mapData && window.akimSceneDev?.scene);
  await check('Actual atlas diagnostics and both camera projections', async () => {
    report.atlas = await page.evaluate(() => window.akimSceneDev.scene.getDiagnostics().data);
    assert.equal(report.atlas.regions, 6); assert.ok(report.atlas.roads > 0);
    for (const projection of ['top', 'tilted']) {
      await page.locator(`[data-act="${projection}"]`).click();
      assert.equal(await page.evaluate(() => window.akimSceneDev.snapshot.projection), projection);
    }
  });
  await check('Nura mayor moves on real geography without modifying plan', async () => {
    await page.locator('[data-act="walk"]').click();
    assert.equal(await page.evaluate(() => window.akimSceneDev.snapshot.view), 'district');
    const before = await page.evaluate(() => ({ mayor: window.akimSceneDev.scene.getDiagnostics().mayor, plan: JSON.stringify(window.akimSceneDev.snapshot.plan) }));
    assert.ok(Array.isArray(before.mayor));
    await page.locator('.atlas-stage').focus();
    await page.keyboard.down('d'); await page.waitForTimeout(300); await page.keyboard.up('d');
    const after = await page.evaluate(() => ({ mayor: window.akimSceneDev.scene.getDiagnostics().mayor, plan: JSON.stringify(window.akimSceneDev.snapshot.plan) }));
    assert.notDeepEqual(after.mayor, before.mayor); assert.equal(after.plan, before.plan);
    report.movement = { before: before.mayor, after: after.mayor };
  });
  for (const width of [320, 375, 430, 768, 1024, 1440]) await check(`Standalone atlas layout ${width}`, () => layout('atlas', width));
  await page.locator('.atlas-play-toggle').click();
  for (const width of [320, 375, 430, 768, 1024, 1440]) await check(`Expanded atlas editor layout ${width}`, () => layout('atlas-editor', width));
  await check('No page/console/network errors', async () => {
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.failedResources, []);
  });
} catch (error) { report.failures.push({ name: 'Harness setup', message: error.message }); }
finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
if (report.failures.length) process.exitCode = 1;
