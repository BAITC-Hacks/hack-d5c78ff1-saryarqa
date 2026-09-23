import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Editable source for the small map reactions. No generated shape represents
// an actual Astana boundary: district styling is applied to real map paths.
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', 'exports', 'effects');
mkdirSync(out, { recursive: true });

const c = {
  ink: '#10243B', blue: '#139DEE', cyan: '#3CC6F2', green: '#32A852',
  lightGreen: '#78CD51', amber: '#F6AF2B', red: '#E85443', slate: '#8A9AA9',
  pale: '#F9F3E4', white: '#FFFFFF', road: '#445568', water: '#38B9E7',
};
const line = `stroke="${c.ink}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" aria-hidden="true">${body}</svg>\n`;
const asset = {
  'placement-pulse': svg(`<circle cx="32" cy="32" r="25" stroke="${c.cyan}" stroke-width="3"/><circle cx="32" cy="32" r="16" stroke="${c.blue}" stroke-width="3"/><path d="M32 38c5-7 8-11 8-15a8 8 0 0 0-16 0c0 4 3 8 8 15Z" fill="${c.blue}" ${line}/><circle cx="32" cy="23" r="2.5" fill="${c.white}"/>`),
  'connection-path': svg(`<path d="M6 48 20 34 32 38 48 20 58 20" stroke="${c.road}" stroke-width="11" stroke-linecap="round"/><path d="M6 48 20 34 32 38 48 20 58 20" stroke="${c.cyan}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="48" r="5" fill="${c.white}" stroke="${c.blue}" stroke-width="3"/><circle cx="58" cy="20" r="5" fill="${c.white}" stroke="${c.blue}" stroke-width="3"/>`),
  'positive-improvement': svg(`<path d="M32 7 53 32H41v22H23V32H11L32 7Z" fill="${c.green}" ${line}/><path d="m7 12 2 3m47-3-2 3" stroke="${c.green}" stroke-width="3" stroke-linecap="round"/>`),
  'negative-tradeoff': svg(`<path d="M32 55 11 30h12V8h18v22h12L32 55Z" fill="${c.amber}" ${line}/><path d="M32 18v13" stroke="${c.ink}" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="38" r="2" fill="${c.ink}"/>`),
  'critical-warning': svg(`<path d="M32 7 59 54H5L32 7Z" fill="${c.red}" ${line}/><path d="M32 23v15" stroke="${c.white}" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="46" r="3" fill="${c.white}"/>`),
  'greenery-improved': svg(`<path d="M14 50V29m18 21V19m18 31V30" stroke="${c.ink}" stroke-width="4" stroke-linecap="round"/><circle cx="14" cy="26" r="11" fill="${c.lightGreen}" ${line}/><circle cx="32" cy="19" r="14" fill="${c.green}" ${line}/><circle cx="50" cy="27" r="10" fill="${c.lightGreen}" ${line}/><path d="M8 54h48" stroke="${c.green}" stroke-width="5" stroke-linecap="round"/>`),
  'cleaner-air': svg(`<path d="M7 21c12-8 20 3 32-2 7-3 8-9 4-12M10 34c11-6 16 4 30 0 12-3 13-11 8-13M16 47c10-5 16 2 27 0" stroke="${c.blue}" stroke-width="4" stroke-linecap="round"/><path d="M8 57V43h10v14m5 0V39h12v18m6 0V43h11v14" stroke="${c.ink}" stroke-width="3" stroke-linecap="round"/>`),
  'better-transit': svg(`<rect x="6" y="19" width="43" height="28" rx="6" fill="${c.blue}" ${line}/><path d="M11 28h33" stroke="${c.white}" stroke-width="5"/><circle cx="17" cy="49" r="4" fill="${c.ink}"/><circle cx="40" cy="49" r="4" fill="${c.ink}"/><path d="M51 18h7v30h-7M49 52h11" stroke="${c.cyan}" stroke-width="4" stroke-linecap="round"/>`),
  'safer-roads': svg(`<path d="M5 15h54v42H5z" fill="${c.road}" ${line}/><path d="m10 51 8-30m3 30 7-30m4 30 7-30m4 30 7-30" stroke="${c.white}" stroke-width="5"/><path d="M42 7 54 11v11c0 8-5 13-12 17-7-4-12-9-12-17V11L42 7Z" fill="${c.blue}" ${line}/><path d="m37 22 4 4 7-8" stroke="${c.white}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`),
  'school-access': svg(`<path d="M7 53h50M11 26 32 13l21 13v27H11V26Z" fill="${c.pale}" ${line}/><path d="M26 53V37h12v16" fill="${c.blue}" ${line}/><path d="M18 31h5m18 0h5" stroke="${c.blue}" stroke-width="4" stroke-linecap="round"/><path d="M26 11V5l9 2-9 3" fill="${c.blue}" ${line}/>`),
  'clinic-access': svg(`<rect x="8" y="19" width="48" height="35" rx="3" fill="${c.white}" ${line}/><path d="M23 19V10h18v9" fill="${c.white}" ${line}/><path d="M32 22v20m-10-10h20" stroke="${c.red}" stroke-width="7" stroke-linecap="round"/><path d="M12 54h40" stroke="${c.blue}" stroke-width="4"/>`),
  'utilities-improved': svg(`<path d="M6 18h22v14h21v20H35V46H20V32H6V18Z" fill="${c.slate}" ${line}/><path d="M53 10c-4 6-7 9-7 13a7 7 0 0 0 14 0c0-4-3-7-7-13Z" fill="${c.water}" ${line}/>`),
  'citizen-cheer': svg(`<circle cx="21" cy="19" r="7" fill="${c.pale}" ${line}/><circle cx="44" cy="19" r="7" fill="${c.pale}" ${line}/><path d="M14 55V34L6 24m15 9 7-11m9 11-7-11m14 11 7-11 7 5M37 55V34" stroke="${c.ink}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 55V39h18v16m6 0V39h18v16" fill="${c.blue}" ${line}/>`),
  'citizen-calm': svg(`<circle cx="32" cy="18" r="9" fill="${c.pale}" ${line}/><path d="M16 55V42a16 16 0 0 1 32 0v13H16Z" fill="${c.green}" ${line}/><path d="M27 27q5 4 10 0" stroke="${c.ink}" stroke-width="2" stroke-linecap="round"/>`),
  'citizen-concerned': svg(`<circle cx="32" cy="18" r="9" fill="${c.pale}" ${line}/><path d="M16 55V42a16 16 0 0 1 32 0v13H16Z" fill="${c.amber}" ${line}/><path d="M28 29q4-3 8 0" stroke="${c.ink}" stroke-width="2" stroke-linecap="round"/><path d="M46 9h10m-5-5v10" stroke="${c.amber}" stroke-width="3" stroke-linecap="round"/>`),
  'finish-higher': svg(`<circle cx="32" cy="32" r="19" fill="${c.amber}" ${line}/><path d="m32 19 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1 4-8Z" fill="${c.white}"/><path d="M32 4v5m0 46v5M4 32h5m46 0h5M12 12l4 4m32 32 4 4m0-40-4 4M16 48l-4 4" stroke="${c.amber}" stroke-width="3" stroke-linecap="round"/>`),
  'finish-restrained': svg(`<circle cx="32" cy="32" r="20" fill="${c.slate}" ${line}/><path d="m21 32 8 8 15-16" stroke="${c.white}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 5v4m0 46v4M5 32h4m46 0h4" stroke="${c.slate}" stroke-width="3" stroke-linecap="round"/>`),
};

for (const [name, content] of Object.entries(asset)) {
  const filename = `${name}.svg`;
  writeFileSync(join(here, filename), content, 'utf8');
  copyFileSync(join(here, filename), join(out, filename));
}

const css = `/* Apply district classes to the real SVG/GeoJSON geometry, never to a drawn substitute. */
.effect-district-hover { stroke: ${c.cyan}; stroke-width: 3; stroke-linejoin: round; fill-opacity: .08; vector-effect: non-scaling-stroke; }
.effect-district-selected { stroke: ${c.blue}; stroke-width: 5; stroke-linejoin: round; fill-opacity: .12; vector-effect: non-scaling-stroke; }
.effect-district-unscored { fill: ${c.slate}; fill-opacity: .24; stroke: ${c.ink}; stroke-width: 1.5; stroke-dasharray: 5 4; vector-effect: non-scaling-stroke; }
.effect-placement-pulse, .effect-positive, .effect-negative, .effect-critical, .effect-cheer, .effect-finish { transform-box: fill-box; transform-origin: center; }
.effect-placement-pulse { animation: effect-pulse 1s ease-out 2; }
.effect-connection-path { stroke-dasharray: 9 5; animation: effect-path 1.2s linear 2; }
.effect-positive, .effect-negative, .effect-critical { animation: effect-pop .28s ease-out 1; }
.effect-cheer { animation: effect-pop .35s ease-out 1; }
.effect-finish { animation: effect-pop .45s ease-out 1; }
@keyframes effect-pulse { 0% { transform: scale(.85); opacity: .6; } 65% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
@keyframes effect-path { to { stroke-dashoffset: -28; } }
@keyframes effect-pop { 0% { transform: scale(.8); opacity: .4; } 100% { transform: scale(1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .effect-placement-pulse, .effect-connection-path, .effect-positive, .effect-negative, .effect-critical, .effect-cheer, .effect-finish { animation: none !important; transform: none !important; opacity: 1 !important; }
}
`;
writeFileSync(join(here, 'effects.css'), css, 'utf8');
copyFileSync(join(here, 'effects.css'), join(out, 'effects.css'));

const manifest = ['filename,purpose,view,viewBox,anchor point,source/creator,license,status'];
for (const name of Object.keys(asset)) {
  manifest.push(`effects/${name}.svg,${name.replaceAll('-', ' ')},both,0 0 64 64,center,Original project artwork,Project-owned; redistribution license not specified,final`);
}
manifest.push('effects/effects.css,District path styles and brief animation with reduced motion static fallback,both,n/a,n/a,Original project artwork,Project-owned; redistribution license not specified,final');
writeFileSync(join(here, 'ASSET-MANIFEST.csv'), `${manifest.join('\n')}\n`, 'utf8');
