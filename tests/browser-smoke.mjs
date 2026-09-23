/** Main game acceptance in real Chrome. AI calls below are deliberate mocks, never live-provider evidence. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { calculatePlan } from '../simulator.js';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const output = resolve(process.env.AKIM_TEST_OUTPUT || '.codex-private/browser-evidence');
const base = process.env.AKIM_TEST_URL || 'http://127.0.0.1:3027';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(12000);
const report = { browser: browser.version(), base, scene: 'pending', ai: 'mocked browser contract tests only; live provider not tested here', checks: [], failures: [], pageErrors: [] };
page.on('pageerror', error => report.pageErrors.push(error.message));
async function check(name, action) { try { await action(); report.checks.push(name); } catch (error) { report.failures.push({ name, message: error.message }); } }
async function sample() {
  await page.locator('#sample-button').click();
  await page.locator('#calculate-button').click();
  await page.locator('#results').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#result-score').textContent(), '56,54');
}
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await check('Main UI mounts actual sourced atlas, without former sidebar/place list', async () => {
    await page.locator('#scene-root .akim-atlas').waitFor();
    assert.ok(await page.locator('.atlas-layer-roads path').count() > 0);
    assert.equal(await page.locator('#scene-notice').isVisible(), false);
    assert.equal(await page.locator('.atlas-sidebar, .atlas-search, [data-tab="districts"]').count(), 0);
    assert.doesNotMatch(await page.locator('body').innerText(), /Other Places|Другие места/i);
    report.scene = 'actual sourced Astana atlas mounted, no fallback or fixture';
  });
  await check('All fourteen policy cards show successfully loaded generated object artwork', async () => {
    await page.locator('#tab-measures').click();
    const cards = page.locator('#measure-groups .measure-card');
    assert.equal(await cards.count(), 14);
    for (let n = 0; n < 14; n++) {
      const image = cards.nth(n).locator('img');
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(image => image.decode());
      const data = await image.evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight, src: image.getAttribute('src') }));
      assert.ok(data.width > 0 && data.height > 0);
      assert.match(data.src, /assets\/exports\/policies\/M\d\d-M\d\d\/M\d\d-tilted-object\.svg$/);
    }
  });
  await check('Keyboard selection and district edits preserve focus; Saraishyk remains unscored', async () => {
    assert.equal(await page.locator('#region-buttons button').count(), 6);
    assert.equal(await page.locator('#calculate-button').isDisabled(), true);
    await page.locator('[data-region="nura"]').click();
    await page.locator('#tab-measures').click();
    await page.locator('[data-focus-key="measure-M7"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#selection-count').textContent(), '1/5');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.focusKey), 'measure-M7');
    await page.locator('#tab-plan').click();
    await page.locator('[data-focus-key="district-M7"]').focus();
    await page.locator('[data-focus-key="district-M7"]').selectOption('Сарыарка');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.focusKey), 'district-M7');
    await page.locator('#reset-button').click();
    await page.locator('[data-region="saraishyk"]').click();
    await page.locator('#tab-measures').click();
    assert.equal(await page.locator('[data-focus-key="measure-M7"]').isDisabled(), true);
    assert.equal(await page.locator('[data-focus-key="measure-M12"]').isDisabled(), false);
  });
  await check('Official example and reduced-motion game/calculator parity; personal best persists', async () => {
    await sample();
    assert.equal(await page.locator('#budget-used').textContent(), '95');
    assert.equal(await page.locator('#result-critical').textContent(), '0');
    assert.equal(await page.locator('#playback-status').textContent(), 'Прогноз готов');
    await page.locator('#mode-calculator').click();
    assert.equal(await page.locator('#result-score').textContent(), '56,54');
    await page.locator('#mode-game').click();
    assert.equal(await page.locator('#result-score').textContent(), '56,54');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#personal-best').textContent(), '56,54');
  });
  await check('Forecast suggestion changes plan, invalidates old result and recomputes its advertised improvement', async () => {
    await sample();
    const suggestion = page.locator('#forecast-suggestions .suggestion').first();
    const advertised = await suggestion.locator('p').filter({ hasText: /^Бюджет / }).textContent();
    const [, budget, score] = advertised.match(/Бюджет (\d+)\/100 · индекс ([\d,]+)/);
    await suggestion.locator('button').click();
    assert.equal(await page.locator('#results').isVisible(), false);
    assert.equal(await page.locator('#tab-plan').getAttribute('aria-selected'), 'true');
    const plan = await page.locator('#selected-list .selected-item').evaluateAll(rows => rows.map(row => ({ id: row.querySelector('[data-focus-key^="remove-"]').dataset.focusKey.replace('remove-', ''), district: row.querySelector('select')?.value ?? null })));
    const computed = calculatePlan(plan);
    assert.equal(computed.valid, true);
    assert.equal(computed.cost, Number(budget));
    assert.ok(computed.score > 56.54307);
    assert.ok(Math.abs(computed.score - Number(score.replace(',', '.'))) <= .0051);
    await page.locator('#calculate-button').click();
    await page.locator('#results').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#result-score').textContent(), score);
    report.suggestion = { budget: computed.cost, score: computed.score, plan };
  });
  await check('Mock AI analysis and advice send distinct modes and share the exact computed plan', async () => {
    await sample();
    const requests = [];
    await page.route('**/api/analyze', async route => {
      const body = route.request().postDataJSON(); requests.push(body);
      await route.fulfill({ json: { analysis: `MOCK ${body.mode} contract response`, source: 'openai', score: 56.54307 } });
    });
    try {
      for (const [mode, selector] of [['analysis', '#ai-button'], ['advice', '#ai-advice-button']]) {
        await page.locator(selector).click();
        await page.waitForFunction(text => document.querySelector('#ai-output').textContent === text, `MOCK ${mode} contract response`);
      }
      assert.deepEqual(requests.map(body => body.mode), ['analysis', 'advice']);
      requests.forEach(body => assert.ok(Math.abs(calculatePlan(body.plan).score - 56.54307) < 1e-9));
      assert.equal(await page.locator('#result-score').textContent(), '56,54');
    } finally { await page.unroute('**/api/analyze'); }
  });
  await check('Mock delayed AI is cancelled and never shown after editing the plan', async () => {
    await sample();
    let release, markStarted;
    const started = new Promise(resolve => { markStarted = resolve; });
    await page.route('**/api/analyze', async route => {
      markStarted(); await new Promise(resolve => { release = resolve; });
      await route.fulfill({ json: { analysis: 'STALE RESPONSE MUST NOT APPEAR', source: 'openai', score: 56.54307 } }).catch(() => {});
    });
    try {
      await page.locator('#ai-button').click(); await started;
      await page.locator('#tab-plan').click(); await page.locator('#reset-button').click();
      release(); await page.waitForTimeout(200);
      assert.equal(await page.locator('#ai-output').isVisible(), false);
      assert.equal(await page.locator('#results').isVisible(), false);
      assert.equal((await page.locator('body').textContent()).includes('STALE RESPONSE MUST NOT APPEAR'), false);
    } finally { release?.(); await page.unroute('**/api/analyze'); }
  });
  await check('Mock unavailable AI retains deterministic score and actionable improvements', async () => {
    await sample();
    await page.route('**/api/analyze', route => route.fulfill({ status: 503, json: { error: 'mock provider unavailable' } }));
    try {
      for (const selector of ['#ai-button', '#ai-advice-button']) {
        const finished = page.waitForResponse(response => response.url().endsWith('/api/analyze'));
        await page.locator(selector).click(); await finished;
        await page.waitForFunction(() => !document.querySelector('#ai-button').disabled && !document.querySelector('#ai-advice-button').disabled);
        assert.match(await page.locator('#ai-status').textContent(), /AI временно недоступен/);
        assert.equal(await page.locator('#result-score').textContent(), '56,54');
        assert.ok(await page.locator('#forecast-suggestions button').count() > 0);
      }
    } finally { await page.unroute('**/api/analyze'); }
  });
  await check('No page script errors', () => assert.deepEqual(report.pageErrors, []));
  await page.screenshot({ path: resolve(output, 'main-forecast.png'), fullPage: true });
} catch (error) { report.failures.push({ name: 'Harness setup', message: error.message }); }
finally { await writeFile(resolve(output, 'browser-report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); await browser.close(); }
if (report.failures.length) process.exitCode = 1;
