/** Optional scene acceptance. Uses Chrome/Playwright; never installs app dependencies. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { platform, release, cpus } from 'node:os';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const output = resolve(process.env.AKIM_TEST_OUTPUT || '.codex-private/scene-evidence');
await mkdir(output, { recursive: true });
const url = process.env.AKIM_SCENE_TEST_URL || 'http://127.0.0.1:3012/scene/dev.html';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
const page = await context.newPage();
const errors = [], failedResources = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) failedResources.push(`${response.status()} ${response.url()}`); });
const report = { browser: browser.version(), machine: `${platform()} ${release()} / ${cpus()[0]?.model}`, geometry: 'explicit development fixture; not real Astana', widths: [], checks: [], overlayNotes: [] };
const state = () => page.evaluate(() => window.akimSceneDev.snapshot);
const diagnostics = () => page.evaluate(() => window.akimSceneDev.scene.getDiagnostics());
async function tick() { await page.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)))); }
async function screenPoint(worldPoint) {
  await page.locator('.akim-scene-map').scrollIntoViewIfNeeded();
  return page.evaluate(point => {
    const m = document.querySelector('.akim-scene-layer-regions').getScreenCTM();
    const p = new DOMPoint(...point).matrixTransform(m);
    return { x: p.x, y: p.y };
  }, worldPoint);
}
try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.akimSceneDev?.scene);
  assert.equal((await state()).result, null);
  const regions = await page.evaluate(() => window.akimSceneDev.geography.regions.map(r => ({ id: r.regionId, anchor: r.labelAnchor })));
  for (const width of [320, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1050 }); await tick();
    for (const projection of ['top', 'tilted']) {
      await page.locator(`.akim-scene-toolbar [data-action="${projection}"]`).click();
      await page.locator('[data-action="reset"]').click();
      for (const region of regions) {
        let point = await screenPoint(region.anchor);
        const covered = await page.evaluate(p => Boolean(document.elementFromPoint(p.x, p.y)?.closest('button')), point);
        if (covered) {
          report.overlayNotes.push(`${region.id}/${projection}/${width}: camera overlay covers anchor; used camera button to pan before selection`);
          await page.locator('[data-action="pan-down"]').click();
          point = await screenPoint(region.anchor);
        }
        await page.mouse.click(point.x, point.y);
        if ((await state()).focusedRegion !== region.id) {
          await page.screenshot({ path: resolve(output, 'hit-test-failure.png') });
          console.error({ region, projection, width, point, target: await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.outerHTML, point) });
        }
        assert.equal((await state()).focusedRegion, region.id, `hit-test ${region.id}/${projection}/${width}`);
      }
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow ${width}`);
    await page.screenshot({ path: resolve(output, `scene-${width}.png`) });
    report.widths.push(width);
  }
  report.checks.push('72 district hit-tests across six widths and two projections; no horizontal overflow');
  await page.locator('.akim-scene-regions [data-region="nura"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.region), 'nura');
  await page.locator('.akim-scene-inspector [data-action="detail"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'detail');
  assert.equal((await state()).view, 'district');
  const stage = page.locator('.akim-scene-map');
  await stage.focus();
  const beforeMove = (await diagnostics()).mayor.position;
  await page.keyboard.down('d'); await page.waitForTimeout(300); await page.keyboard.up('d');
  assert.ok((await diagnostics()).mayor.position[0] > beforeMove[0]);
  const beforeBlur = (await diagnostics()).mayor.position;
  await page.keyboard.down('d');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(150); await page.keyboard.up('d');
  assert.ok((await diagnostics()).mayor.position[0] - beforeBlur[0] < 2, 'blur clears held movement');
  assert.equal((await state()).plan.length, 0);
  report.checks.push('keyboard focus survives district/inspector updates; mayor movement does not mutate plan; blur releases controls');

  await page.locator('#preview').click();
  assert.equal((await state()).plan.length, 2); assert.equal((await state()).result, null);
  await page.locator('#speed').selectOption('4');
  await page.locator('#play').click();
  await page.waitForTimeout(300); await page.locator('#pause').click();
  const progress = (await diagnostics()).effects.progress;
  await page.waitForTimeout(220);
  assert.equal((await diagnostics()).effects.progress, progress);
  await page.locator('#pause').click();
  await page.waitForFunction(() => window.akimSceneDev.snapshot.playback.status === 'complete', { timeout: 12000 });
  assert.ok(Math.abs((await state()).result.score - 56.54307) < 1e-8);
  const result = JSON.stringify((await state()).result);
  const firstRun = (await state()).playback.runId;
  await page.locator('#replay').click();
  assert.ok((await state()).playback.runId > firstRun);
  await page.locator('#skip').click();
  assert.equal(JSON.stringify((await state()).result), result);
  await page.locator('#reduced').check(); await page.locator('#replay').click();
  assert.equal((await state()).playback.status, 'complete');
  assert.equal(JSON.stringify((await state()).result), result);
  const completions = await page.evaluate(() => window.akimSceneDev.intents.filter(i => i.type === 'PLAYBACK_COMPLETE'));
  assert.ok(completions.every(i => Number.isSafeInteger(i.runId)));
  report.checks.push('real shared-session finalization 56.54307; pause, normal completion, replay, skip and reduced motion preserve exact result');
  await page.locator('#hidden').check();
  const hiddenMayor = (await diagnostics()).mayor;
  await stage.focus(); await page.keyboard.press('ArrowRight');
  const hiddenPoint = await screenPoint(hiddenMayor.position);
  await page.mouse.click(hiddenPoint.x + 6, hiddenPoint.y);
  assert.deepEqual((await diagnostics()).mayor, hiddenMayor, 'hidden scene rejects input');
  const hiddenFrames = (await diagnostics()).frames;
  await page.waitForTimeout(180);
  assert.equal((await diagnostics()).running, false); assert.equal((await diagnostics()).frames, hiddenFrames);
  await page.locator('#hidden').uncheck(); await page.locator('#reduced').uncheck();
  const actorCount = (await diagnostics()).actorCount;
  for (let i = 0; i < 3; i++) await page.locator('#remount').click();
  assert.equal(await page.locator('.akim-scene').count(), 1);
  assert.equal((await diagnostics()).actorCount, actorCount);
  report.checks.push('Calculator/hidden stops frame work; three remounts retain one scene and stable actor counts');
  const perfStart = await diagnostics();
  const started = Date.now(); await page.waitForTimeout(1500);
  const perfEnd = await diagnostics();
  report.performance = { durationMs: Date.now() - started, actorCount: perfEnd.actorCount,
    motionUpdates: perfEnd.frames - perfStart.frames, averageMotionRenderMs: perfEnd.averageMotionRenderMs,
    note: 'Headless Chrome fixture scene, not physical-device FPS or production geography benchmark.' };
  await page.evaluate(() => { window.akimSceneDev.scene.destroy(); window.akimSceneDev.scene.destroy(); });
  assert.equal(await page.locator('.akim-scene').count(), 0);
  assert.equal((await diagnostics()).running, false);

  const touchContext = await browser.newContext({ viewport: { width: 375, height: 900 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const touch = await touchContext.newPage();
  touch.on('pageerror', error => errors.push(error.message));
  await touch.goto(url, { waitUntil: 'networkidle' });
  await touch.locator('.akim-scene-regions [data-region="nura"]').tap();
  await touch.locator('.akim-scene-toolbar [data-action="detail"]').tap();
  await touch.locator('.akim-scene-map').scrollIntoViewIfNeeded();
  const destination = await touch.evaluate(() => {
    const d = window.akimSceneDev.scene.getDiagnostics();
    const m = document.querySelector('.akim-scene-layer-regions').getScreenCTM();
    // Keep the destination clear of the mobile camera overlay and touch-target expansion.
    const point = new DOMPoint(d.mayor.position[0] - 15, d.mayor.position[1]).matrixTransform(m);
    return { x: point.x, y: point.y, start: d.mayor.position };
  });
  await touch.touchscreen.tap(destination.x, destination.y);
  if ((await touch.evaluate(() => window.akimSceneDev.scene.getDiagnostics().mayor.position))[0] >= destination.start[0]) {
    await touch.screenshot({ path: resolve(output, 'touch-failure.png') });
    console.error({ destination, touch: await touch.evaluate(p => ({ target: document.elementFromPoint(p.x, p.y)?.outerHTML, diagnostics: window.akimSceneDev.scene.getDiagnostics(), snapshot: window.akimSceneDev.snapshot }), destination) });
  }
  assert.ok((await touch.evaluate(() => window.akimSceneDev.scene.getDiagnostics().mayor.position))[0] < destination.start[0]);
  assert.equal((await touch.evaluate(() => window.akimSceneDev.snapshot)).plan.length, 0);
  await touchContext.close();
  report.checks.push('emulated touch selection and explicit mayor destination work with reduced motion; physical touch not tested');
  assert.deepEqual(errors, []); assert.deepEqual(failedResources, []);
  report.errors = errors; report.failedResources = failedResources;
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
