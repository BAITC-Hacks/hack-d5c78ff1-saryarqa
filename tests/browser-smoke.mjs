/** Optional real-browser acceptance: requires Playwright and Chrome; no app dependency. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const output = resolve(process.env.AKIM_TEST_OUTPUT || '.codex-private/browser-evidence');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const report = { browser: browser.version(), checkedWidths: [], checks: [], scene: 'not supplied; fallback tested' };
try {
  await page.goto(process.env.AKIM_TEST_URL || 'http://127.0.0.1:3010', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('#region-buttons button').count(), 6);
  assert.equal(await page.locator('#calculate-button').isDisabled(), true);
  await page.locator('[data-region="nura"]').click();
  await page.locator('[data-focus-key="measure-M7"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#selection-count').textContent(), '1/5');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.focusKey), 'measure-M7');
  await page.locator('[data-focus-key="district-M7"]').focus();
  await page.locator('[data-focus-key="district-M7"]').selectOption('Сарыарка');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.focusKey), 'district-M7');
  await page.locator('#reset-button').click();
  await page.locator('[data-region="saraishyk"]').click();
  assert.equal(await page.locator('[data-focus-key="measure-M7"]').isDisabled(), true);
  assert.equal(await page.locator('[data-focus-key="measure-M12"]').isDisabled(), false);
  report.checks.push('six region controls, Saraishyk unscored, keyboard focus preserved');

  await page.locator('#sample-button').click();
  await page.locator('#mode-calculator').click();
  assert.equal(await page.locator('#budget-used').textContent(), '95');
  assert.equal(await page.locator('#selection-count').textContent(), '5/5');
  await page.locator('#calculate-button').click();
  await page.locator('#results').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#result-score').textContent(), '56,54');
  await page.locator('#mode-game').click();
  assert.equal(await page.locator('#result-score').textContent(), '56,54');
  assert.equal(await page.locator('#playback-status').textContent(), 'Расчёт завершён');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#personal-best').textContent(), '56,54');
  report.checks.push('official example 95 / 56.54, mode parity, local best after reload');

  for (const width of [320, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('.game-workspace').scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, `horizontal overflow at ${width}`);
    const boxes = await page.locator('.game-workspace button:visible').evaluateAll((buttons) => buttons.map((button) => ({ left: button.getBoundingClientRect().left, right: button.getBoundingClientRect().right, width: button.getBoundingClientRect().width })));
    assert.ok(boxes.every((box) => box.left >= 0 && box.right <= width + 1 && box.width > 20), `clipped game controls at ${width}`);
    await page.screenshot({ path: resolve(output, `shell-${width}.png`) });
    report.checkedWidths.push(width);
  }
  report.checks.push('six responsive widths without overflow or clipped shell buttons');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#sample-button').click();
  await page.locator('#mode-calculator').click();
  await page.locator('#calculate-button').click();
  let finishAI;
  let startedAI;
  const started = new Promise((resolveStart) => { startedAI = resolveStart; });
  await page.route('**/api/analyze', async (route) => {
    startedAI();
    await new Promise((release) => { finishAI = release; });
    await route.fulfill({ json: { analysis: 'STALE RESPONSE MUST NOT APPEAR', source: 'openai', score: 56.54307 } }).catch(() => {});
  });
  await page.locator('#ai-button').click();
  await started;
  await page.locator('#reset-button').click();
  finishAI();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#ai-output').isVisible(), false);
  assert.equal(await page.locator('#results').isVisible(), false);
  assert.equal((await page.locator('body').textContent()).includes('STALE RESPONSE MUST NOT APPEAR'), false);
  report.checks.push('pending AI result cancelled and ignored after editing plan');
  await page.unroute('**/api/analyze');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#mode-game').click();
  await page.locator('#sample-button').click();
  await page.locator('#calculate-button').click();
  await page.locator('#results').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#result-score').textContent(), '56,54');
  report.checks.push('game without world resources still reveals exact result; reduced-motion fallback');
  assert.deepEqual(errors, []);
  report.pageErrors = errors;
  console.log(JSON.stringify(report, null, 2));
  await writeFile(resolve(output, 'browser-report.json'), JSON.stringify(report, null, 2));
} finally { await browser.close(); }
