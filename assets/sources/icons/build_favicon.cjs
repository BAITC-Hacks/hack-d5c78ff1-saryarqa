// Rasterize the approved logo A SVG with the system browser for exact PNG parity.
const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/Дiлда/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');

(async () => {
  const root = path.resolve(__dirname, '../..');
  const source = path.join(root, 'sources', 'icons', 'logo-app.svg');
  const output = path.join(root, 'exports', 'favicon');
  fs.mkdirSync(output, { recursive: true });
  const original = fs.readFileSync(source, 'utf8');
  fs.writeFileSync(path.join(output, 'favicon.svg'), original);
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--disable-gpu'] });
  try {
    for (const size of [16, 32, 64, 192, 512]) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      const markup = original.replace(/width="32" height="32"/, `width="${size}" height="${size}"`);
      await page.setContent(`<html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${markup}</body></html>`);
      await page.screenshot({ path: path.join(output, `favicon-${size}.png`), omitBackground: true });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log('Wrote SVG plus favicon PNGs at 16, 32, 64, 192, 512 px');
})().catch(err => { console.error(err); process.exit(1); });
