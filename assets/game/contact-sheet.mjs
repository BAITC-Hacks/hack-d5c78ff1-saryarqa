import { readFileSync, writeFileSync } from 'node:fs';
import { inspectSvg } from '../../tools/check-assets.mjs';
const root = new URL('../../', import.meta.url);
const { assets } = JSON.parse(readFileSync(new URL('manifest.json', import.meta.url)));
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
function render(v) {
  let svg = readFileSync(new URL(v.path, root), 'utf8');
  inspectSvg(svg);
  if (v.symbolId) {
    const symbol = [...svg.matchAll(/<symbol\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/symbol>/g)].find(m => m[1] === v.symbolId);
    const styles = svg.match(/<style>[\s\S]*?<\/style>/)?.[0] ?? '';
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${v.width} ${v.height}">${styles}${symbol[2]}</svg>`;
  }
  return `<img alt="" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`;
}
const cards = assets.map(a => `<article><h2>${escape(a.id)}</h2><b>${a.status}</b>${Object.entries(a.views).map(([name, v]) => `<p>${name} · ${v.width}×${v.height} · anchor ${v.anchor.join(',')}</p><div class="art">${render(v)}</div>`).join('')}<small>${escape(a.note ?? '')}</small></article>`).join('');
writeFileSync(new URL('CONTACT-SHEET.html', import.meta.url), `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Akim — asset intake review</title><style>body{margin:24px;background:#f6f3eb;color:#233d3b;font:15px system-ui}h1{font-size:28px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}article{background:white;border:1px solid #cdc9bf;padding:12px;min-width:0}h2{font-size:15px;overflow-wrap:anywhere}p{line-height:1.5}.art{height:130px;display:flex;justify-content:center;background:repeating-conic-gradient(#ececec 0 25%,white 0 50%) 0/16px 16px;color:#233d3b}.art img{max-width:100%;height:100%}small{display:block}b{color:#73591d}</style><h1>Akim / проверка ассетов</h1><p>14 готовых значков мер. Остальные материалы — placeholder или missing. География и сцена проверяются отдельно.</p><main>${cards}</main></html>\n`);
console.log(`Contact sheet: ${assets.length} asset entries`);
