import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = path.resolve(import.meta.dirname, '../../..');
const source = path.join(root, 'assets/sources/style');
const output = path.join(root, 'assets/exports/style');
fs.mkdirSync(output, { recursive: true });

// One deliberately fictional block. The tilted ground uses these same paths
// through a single affine transform; neither view is an Astana boundary map.
const C = {
  paper: '#FFF8EA', land: '#A5CF59', landDark: '#78B74B',
  grass: '#70C44D', tree: '#1D8E63', treeLight: '#49B36C',
  river: '#28B9DD', riverShade: '#159BC4', walk: '#F7DEAA',
  road: '#4A5D67', roadEdge: '#344D5B', bus: '#E66C4C',
  building: '#F5B64D', buildingSide: '#DC893A',
  civic: '#EFA447', civicRoof: '#E97859', apartment: '#E88A62',
  blue: '#51A5CE', white: '#FFF8EA', ink: '#173247',
};

const river = 'M0 0 H72 C116 62 76 112 110 168 C145 223 96 266 132 323 C157 365 214 399 265 480 H0 Z';
const riverShade = 'M72 0 C116 62 76 112 110 168 C145 223 96 266 132 323 C157 365 214 399 265 480';
const roadHorizontal = 'M0 220 H640 V278 H0 Z';
const roadVertical = 'M496 0 H550 V480 H496 Z';
const buildings = [
  { x: 318, y: 57, w: 122, h: 68, z: 40, fill: C.civic, roof: C.civicRoof, civic: true },
  { x: 557, y: 53, w: 47, h: 74, z: 48, fill: C.building, roof: C.walk },
  { x: 557, y: 137, w: 47, h: 58, z: 42, fill: C.apartment, roof: C.walk },
  { x: 308, y: 322, w: 54, h: 69, z: 37, fill: C.building, roof: C.walk },
  { x: 373, y: 342, w: 53, h: 59, z: 32, fill: C.apartment, roof: C.walk },
  { x: 558, y: 323, w: 47, h: 78, z: 46, fill: C.blue, roof: C.walk },
];
const trees = [
  [220, 76, 22], [281, 97, 18], [256, 157, 19], [217, 195, 19],
  [445, 160, 18], [77, 312, 18], [194, 342, 18], [265, 415, 21],
  [457, 372, 20], [611, 436, 17],
];

const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><title>Fictional miniature city style sample</title>${body}</svg>\n`;

function commonGround() {
  return `<rect width="640" height="480" fill="${C.land}"/>
  <path d="${river}" fill="${C.river}"/>
  <path d="${riverShade}" fill="none" stroke="${C.riverShade}" stroke-width="8"/>
  <path d="M136 0 V200 M152 295 Q183 368 270 465" fill="none" stroke="${C.walk}" stroke-width="20"/>
  <path d="${roadVertical}" fill="${C.road}"/>
  <path d="${roadHorizontal}" fill="${C.road}"/>
  <rect x="0" y="215" width="640" height="5" fill="${C.walk}"/>
  <rect x="0" y="278" width="640" height="5" fill="${C.walk}"/>
  <rect x="0" y="267" width="640" height="11" fill="${C.bus}"/>
  <path d="M165 26 H473 V193 H165 Z" fill="none" stroke="${C.walk}" stroke-width="15" stroke-linejoin="round"/>
  <path d="M174 124 H468 M301 28 V194" stroke="${C.walk}" stroke-width="13"/>
  <circle cx="265" cy="128" r="23" fill="${C.walk}"/><circle cx="265" cy="128" r="12" fill="${C.river}"/>
  <path d="M303 306 H466 V429 H292" fill="none" stroke="${C.walk}" stroke-width="13" stroke-linejoin="round"/>
  <path d="M13 228 H126 M13 276 H126" stroke="${C.walk}" stroke-width="4"/>
  <path d="M22 248 H460 M562 248 H624" stroke="${C.white}" stroke-width="2.5" stroke-dasharray="18 18" opacity=".82"/>
  <path d="M523 20 V206 M523 290 V458" stroke="${C.white}" stroke-width="2.5" stroke-dasharray="17 17" opacity=".82"/>`;
}

function topScene() {
  const house = buildings.map(b => `<rect x="${b.x+3}" y="${b.y+5}" width="${b.w}" height="${b.h}" fill="${C.roadEdge}" opacity=".18"/><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="3" fill="${b.fill}"/><path d="M${b.x} ${b.y} H${b.x+b.w} V${b.y+15} H${b.x}Z" fill="${b.roof}"/>${b.civic ? `<rect x="${b.x+47}" y="${b.y+47}" width="28" height="21" fill="${C.white}"/>` : ''}`).join('');
  const tree = trees.map(([x,y,r]) => `<ellipse cx="${x+5}" cy="${y+7}" rx="${r}" ry="${r*.62}" fill="${C.ink}" opacity=".16"/><circle cx="${x}" cy="${y}" r="${r}" fill="${C.tree}"/><circle cx="${x-5}" cy="${y-5}" r="${r*.39}" fill="${C.treeLight}" opacity=".75"/>`).join('');
  return svg(640,480, `${commonGround()}${house}${tree}<rect x="397" y="250" width="48" height="16" rx="5" fill="${C.white}"/><rect x="402" y="253" width="37" height="10" rx="2" fill="${C.bus}"/><circle cx="410" cy="266" r="3" fill="${C.ink}"/><circle cx="432" cy="266" r="3" fill="${C.ink}"/>`);
}

const project = (x,y,z=0) => [190 + .9*x - .35*y, 27 + .25*x + .5*y-z];
const poly = points => points.map(p => p.join(',')).join(' ');
function tiltedBuilding(b) {
  const A=project(b.x,b.y), B=project(b.x+b.w,b.y), D=project(b.x,b.y+b.h), E=project(b.x+b.w,b.y+b.h);
  const At=project(b.x,b.y,b.z), Bt=project(b.x+b.w,b.y,b.z), Dt=project(b.x,b.y+b.h,b.z), Et=project(b.x+b.w,b.y+b.h,b.z);
  return `<polygon points="${poly([D,E,Et,Dt])}" fill="${b.fill}"/><polygon points="${poly([B,E,Et,Bt])}" fill="${b.buildingSide ?? C.buildingSide}"/><polygon points="${poly([At,Bt,Et,Dt])}" fill="${b.roof}" stroke="${C.white}" stroke-width="1.6" stroke-linejoin="round"/>${b.civic ? `<polygon points="${poly([project(b.x+42,b.y+b.h,b.z),project(b.x+76,b.y+b.h,b.z),project(b.x+76,b.y+b.h,0),project(b.x+42,b.y+b.h,0)])}" fill="${C.white}"/>` : ''}`;
}
function tiltedTree([x,y,r]) {
  const [px,py]=project(x,y); const z=r*1.3;
  return `<ellipse cx="${px+8}" cy="${py+5}" rx="${r*.9}" ry="${r*.28}" fill="${C.ink}" opacity=".18"/><path d="M${px} ${py} V${py-z*.65}" stroke="${C.roadEdge}" stroke-width="3"/><circle cx="${px}" cy="${py-z}" r="${r*.75}" fill="${C.tree}"/><circle cx="${px-r*.27}" cy="${py-z-r*.28}" r="${r*.23}" fill="${C.treeLight}"/>`;
}
function tiltedScene() {
  const ground = `<g transform="matrix(.9 .25 -.35 .5 190 27)">${commonGround()}</g>`;
  const sorted = [...buildings.map(b=>({y:b.y+b.h, html:tiltedBuilding(b)})), ...trees.map(t=>({y:t[1],html:tiltedTree(t)}))].sort((a,b)=>a.y-b.y).map(x=>x.html).join('');
  const [bx,by]=project(415,258,5);
  const bus=`<ellipse cx="${bx+7}" cy="${by+6}" rx="25" ry="7" fill="${C.ink}" opacity=".16"/><path d="M${bx-23} ${by-8} l42 11 v12 l-42-11Z" fill="${C.bus}"/><path d="M${bx-23} ${by-8} l13-9 42 11 -13 9Z" fill="${C.white}"/><path d="M${bx-23} ${by+4} l42 11" stroke="${C.ink}" stroke-width="2"/>`;
  return svg(800,480, `<rect width="800" height="480" fill="${C.paper}"/>${ground}${sorted}${bus}`);
}

const palette = [
  ['Land',C.land],['River',C.river],['Road',C.road],['Building',C.building],['Greenery',C.grass],['Transport', '#00AEB6'],
  ['Ecology','#70C44D'],['Social','#FF9B39'],['Safety','#278DD2'],['City service','#8C75C8'],
  ['Positive','#2AA779'],['Negative','#D95C58'],['Neutral','#89999A'],['Selected','#F2CA55'],['Unscored','#B8B8AD'],
];
function paletteSvg() {
  return svg(800, 380, `<rect width="800" height="380" fill="${C.paper}"/>${palette.map(([name,color],i)=>{const x=20+(i%5)*156,y=24+Math.floor(i/5)*116;return `<rect x="${x}" y="${y}" width="142" height="72" rx="10" fill="${color}" stroke="${C.ink}" stroke-width="1.5"/><text x="${x}" y="${y+91}" font-family="Arial,sans-serif" font-size="13" fill="${C.ink}">${name}</text><text x="${x}" y="${y+107}" font-family="Arial,sans-serif" font-size="11" fill="${C.ink}">${color}</text>`}).join('')}`);
}

const top=topScene(), tilted=tiltedScene(), swatches=paletteSvg();
for (const [name,data] of [['scene-top.svg',top],['scene-tilted.svg',tilted],['palette.svg',swatches]]) {
  fs.writeFileSync(path.join(source,name),data);
  fs.writeFileSync(path.join(output,name),data);
}
const preview = svg(1540,615, `<rect width="1540" height="615" fill="${C.paper}"/><g transform="translate(36 55) scale(.95)">${top.replace(/^<svg[^>]*>|<\/svg>\s*$/g,'')}</g><g transform="translate(668 55) scale(1.03)">${tilted.replace(/^<svg[^>]*>|<\/svg>\s*$/g,'')}</g><path d="M645 32 V545" stroke="#DACBAE" stroke-width="2"/><rect x="26" y="553" width="1488" height="37" fill="${C.paper}"/>${palette.slice(0,10).map(([,color],i)=>`<rect x="${35+i*62}" y="562" width="46" height="20" rx="5" fill="${color}"/>`).join('')}`);
fs.writeFileSync(path.join(source,'preview-style.svg'),preview);
fs.writeFileSync(path.join(output,'preview-style.svg'),preview);
await sharp(Buffer.from(preview)).png().toFile(path.join(output,'preview-style.png'));
console.log('Built style SVG sources, exports, and PNG preview.');
