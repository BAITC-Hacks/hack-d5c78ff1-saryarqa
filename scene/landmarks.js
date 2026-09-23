/**
 * Stylized architectural miniatures for the 17 supplied landmark anchors.
 * These drawings convey identity, not surveyed footprints or building dimensions.
 * Every symbol's ground anchor is (0, 0); the renderer owns geographic placement.
 */
const NS = 'http://www.w3.org/2000/svg';
export const LANDMARK_STYLES = Object.freeze({
  ivory: '#faf6e9', stone: '#e5dbc1', shade: '#beb89f', edge: '#827f69',
  teal: '#357b7a', glass: '#79b8b5', dark: '#245c61', pale: '#c7e0d7',
  gold: '#ceab58', goldLight: '#f5d989', goldDark: '#9c7835',
  lawn: '#92aa79', shadow: '#24433d27', line: '#ffffff88', selection: '#d8b468',
});
const C = LANDMARK_STYLES;
const LABELS = Object.freeze({
  baiterek: 'Бәйтерек', akorda: 'Ақорда', khan_shatyr: 'Хан Шатыр',
  national_museum: 'Национальный музей Республики Казахстан', astana_opera: 'Astana Opera',
  palace_peace: 'Дворец мира и согласия', hazret_sultan: 'Мечеть Хазрет Султан',
  grand_mosque: 'Главная мечеть Астаны', nazarbayev_university: 'Nazarbayev University',
  astana_arena: 'Astana Arena', barys_arena: 'Барыс Арена', nur_alem: 'Нұр Әлем / EXPO',
  nurly_zhol_station: 'Вокзал Нұрлы жол', astana_1_station: 'Вокзал Астана-1',
  astana_airport: 'Международный аэропорт Астаны', abu_dhabi_plaza: 'Abu Dhabi Plaza',
  shabyt: 'Қазақ ұлттық өнер университеті / Шабыт',
});

export const landmarkLabel = id => Object.prototype.hasOwnProperty.call(LABELS, id)
  ? LABELS[id] : 'Городской объект';

const element = (tag, attributes = {}) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
};
const add = (group, tag, attributes) => group.appendChild(element(tag, attributes));
const path = (g, d, fill = C.ivory, attributes = {}) => add(g, 'path', { d, fill, ...attributes });
const ellipse = (g, cx, cy, rx, ry, fill, attributes = {}) => add(g, 'ellipse', { cx, cy, rx, ry, fill, ...attributes });
const circle = (g, cx, cy, r, fill, attributes = {}) => add(g, 'circle', { cx, cy, r, fill, ...attributes });
const rect = (g, x, y, width, height, fill, rx = 0, attributes = {}) => add(g, 'rect', { x, y, width, height, rx, fill, ...attributes });
const line = (g, x1, y1, x2, y2, stroke = C.edge, width = 1, attributes = {}) => add(g, 'line', {
  x1, y1, x2, y2, stroke, 'stroke-width': width, 'stroke-linecap': 'round', ...attributes,
});
const shadow = (g, width = 31, height = 7) => ellipse(g, 3, 2, width, height, C.shadow);
const plinth = (g, width = 30) => {
  path(g, `M${-width},-3 0,-13 ${width},-3 0,8Z`, C.stone);
  path(g, `M${-width},-3 0,5 ${width},-3 0,-11Z`, C.ivory);
};

// A low cabinet seen from the same three-quarter direction as the other symbols.
function block(g, x, y, width, height, depth = 7, fill = C.ivory) {
  rect(g, x, y - height, width, height, fill);
  path(g, `M${x + width},${y - height}l${depth},${-depth * .55}v${height}l${-depth},${depth * .55}Z`, C.shade);
  path(g, `M${x},${y - height}l${depth},${-depth * .55}h${width}l${-depth},${depth * .55}Z`, C.stone);
}

function windows(g, x, y, count, spacing = 6, height = 7, width = 3, fill = C.teal) {
  for (let index = 0; index < count; index += 1) rect(g, x + index * spacing, y, width, height, fill, .5);
}

function dome(g, x, y, radius, fill = C.teal) {
  path(g, `M${x - radius},${y}Q${x - radius},${y - radius * .9} ${x},${y - radius * 1.1}Q${x + radius},${y - radius * .9} ${x + radius},${y}Z`, fill);
  path(g, `M${x - radius * .65},${y - 1}Q${x - radius * .63},${y - radius * .8} ${x - 1},${y - radius * .99}`, 'none', { stroke: C.line, 'stroke-width': 1.6 });
  line(g, x, y - radius * 1.1, x, y - radius * 1.4, C.gold, 1.5);
  circle(g, x, y - radius * 1.47, 1.2, C.goldLight);
  rect(g, x - radius, y - 1.1, radius * 2, 2.2, C.gold);
}

function minaret(g, x, y, height = 37, fill = C.ivory) {
  path(g, `M${x - 2.7},${y}l.8,${-height}h3.8l.8,${height}Z`, fill);
  line(g, x + 2, y - 1, x + 1.5, y - height, C.shade, 1.2);
  for (const fraction of [.38, .75]) rect(g, x - 3.4, y - height * fraction, 6.8, 1.7, C.gold);
  path(g, `M${x - 2.2},${y - height}l2.2,-6 2.2,6Z`, C.teal);
  line(g, x, y - height - 6, x, y - height - 9, C.gold, 1);
}

function roof(g, width = 31, height = 21, fill = C.ivory) {
  shadow(g, width + 2, height + 2);
  rect(g, -width, -height, width * 2, height * 2, C.shade, 3);
  rect(g, -width, -height - 3, width * 2, height * 2, fill, 3);
  rect(g, -width + 3, -height, width * 2 - 6, height * 2 - 6, 'none', 2, { stroke: C.stone, 'stroke-width': 1 });
}

function baiterek(g, top) {
  if (top) {
    shadow(g, 23, 20); circle(g, 0, -2, 23, C.stone); circle(g, 0, -3, 18, C.ivory);
    for (let index = 0; index < 10; index += 1) {
      const angle = index * Math.PI / 5;
      line(g, Math.cos(angle) * 12, -3 + Math.sin(angle) * 12, Math.cos(angle) * 20, -3 + Math.sin(angle) * 20, C.gold, 1);
    }
    circle(g, 0, -4, 13, C.gold); ellipse(g, -3.5, -8, 7, 5.5, C.goldLight);
    ellipse(g, 0, -4, 7, 13, 'none', { stroke: C.goldDark, 'stroke-width': .8 });
    return;
  }
  shadow(g, 23, 5); plinth(g, 21);
  path(g, 'M-11,-5C-6,-24 -4,-38 -14,-53M11,-5C6,-24 4,-38 14,-53', 'none', { stroke: C.shade, 'stroke-width': 3 });
  for (let index = -2; index <= 2; index += 1) {
    path(g, `M${index * 4},-5Q${-index * 3},-30 ${index * 6},-54`, 'none', { stroke: C.ivory, 'stroke-width': 2.1 });
  }
  for (const y of [-14, -22, -30, -39]) ellipse(g, 0, y, y === -39 ? 5.5 : 4.5, 1.2, 'none', { stroke: C.gold, 'stroke-width': 1 });
  circle(g, 0, -60, 14, C.goldDark); circle(g, -1, -61, 13, C.gold);
  ellipse(g, -4, -65, 7.5, 5.5, C.goldLight);
  ellipse(g, 0, -60, 7, 13, 'none', { stroke: C.goldDark, 'stroke-width': .8 });
  path(g, 'M-13,-59Q0,-54 13,-59M-12,-65Q0,-61 12,-65', 'none', { stroke: '#fff1be99', 'stroke-width': .9 });
}

function akorda(g, top) {
  if (top) {
    roof(g, 34, 19); rect(g, -32, -15, 64, 9, C.stone); rect(g, -26, 8, 52, 7, C.stone);
    circle(g, 0, -3, 12, C.gold); circle(g, 0, -4, 10, C.teal); ellipse(g, -3, -7, 5, 4, C.glass);
    for (const x of [-27, 27]) rect(g, x - 4, -18, 8, 30, C.ivory, 1);
    return;
  }
  shadow(g, 37); block(g, -32, -4, 64, 19, 5);
  block(g, -12, -6, 24, 27, 4);
  windows(g, -28, -19, 4, 7, 8); windows(g, 11, -19, 3, 7, 8);
  for (const x of [-9, -3, 3, 9]) { rect(g, x - 1.4, -29, 2.8, 20, C.ivory); line(g, x + 1.5, -27, x + 1.5, -9, C.shade, .8); }
  path(g, 'M-15,-32 0,-40 15,-32Z', C.ivory); rect(g, -16, -33, 32, 3, C.gold);
  rect(g, -8, -41, 16, 6, C.ivory); dome(g, 0, -41, 10);
  line(g, 0, -56, 0, -68, C.gold, 1.3); path(g, 'M1,-68h9l-2,4H1Z', C.teal);
  rect(g, -17, -6, 34, 3, C.stone); rect(g, -20, -3, 40, 3, C.ivory);
}

function khanShatyr(g, top) {
  if (top) {
    shadow(g, 33, 25); ellipse(g, 0, -3, 32, 25, C.stone); ellipse(g, 0, -5, 30, 23, C.ivory);
    for (let index = 0; index < 12; index += 1) { const a = index * Math.PI / 6; line(g, 5, -10, Math.cos(a) * 30, -5 + Math.sin(a) * 23, C.stone, 1.2); }
    circle(g, 5, -10, 3, C.gold); return;
  }
  shadow(g, 36); ellipse(g, 0, -4, 34, 9, C.shade);
  path(g, 'M-34,-7Q-6,-32 7,-64Q13,-28 35,-7Q4,7 -34,-7Z', C.ivory);
  path(g, 'M7,-64Q15,-27 35,-7Q21,-1 10,0Z', C.stone);
  for (const x of [-27, -17, -7, 5, 18, 29]) path(g, `M7,-62Q${x * .5},-25 ${x},-4`, 'none', { stroke: '#bdbba5', 'stroke-width': .8 });
  path(g, 'M-26,-16Q3,-7 29,-16M-17,-29Q5,-21 21,-27', 'none', { stroke: '#d5cbb4', 'stroke-width': .8 });
  ellipse(g, 0, -5, 32, 5, 'none', { stroke: C.gold, 'stroke-width': 2 });
  line(g, 7, -65, 9, -76, C.goldDark, 1.4); rect(g, -4, -9, 9, 7, C.teal, 1);
}

function museum(g, top) {
  if (top) {
    roof(g, 32, 19); rect(g, -27, -16, 19, 24, C.teal, 1); rect(g, -3, -19, 19, 29, C.gold, 1);
    rect(g, 19, -10, 13, 25, C.ivory, 1); rect(g, -29, 11, 50, 5, C.stone); return;
  }
  shadow(g, 37); block(g, -33, -3, 23, 25, 5, C.ivory); block(g, -11, -3, 29, 38, 6, C.gold);
  block(g, 19, -1, 12, 22, 5, C.ivory); rect(g, -30, -24, 17, 15, C.teal);
  for (const x of [-28, -23, -18]) line(g, x, -23, x, -10, C.glass, .9);
  rect(g, -8, -35, 23, 22, C.goldLight); path(g, 'M-6,-13L12,-34', 'none', { stroke: C.goldDark, 'stroke-width': 1 });
  windows(g, 21, -18, 2, 5, 10, 2.7); rect(g, -29, -4, 59, 4, C.stone); rect(g, -7, -11, 18, 8, C.dark);
}

function opera(g, top) {
  if (top) {
    roof(g, 32, 22); rect(g, -26, -18, 52, 24, C.teal, 1); path(g, 'M-28,8 0,1 28,8V18H-28Z', C.ivory);
    for (let x = -23; x <= 23; x += 9.2) circle(g, x, 15, 1.8, C.gold); return;
  }
  shadow(g, 36); block(g, -30, -5, 59, 23, 6); rect(g, -25, -27, 50, 22, C.dark);
  for (const x of [-23, -14, -5, 5, 14, 23]) { rect(g, x - 2, -29, 4, 24, C.ivory); rect(g, x - 2.8, -29, 5.6, 2.5, C.gold); }
  path(g, 'M-34,-31 0,-45 34,-31Z', C.ivory); path(g, 'M-26,-32 0,-41 26,-32Z', C.stone);
  line(g, -35, -30, 35, -30, C.gold, 2); rect(g, -32, -5, 64, 3, C.stone); rect(g, -36, -2, 72, 3, C.ivory);
  // Small sculptural crest suggests the rooftop chariot without a detailed sprite.
  path(g, 'M-7,-46l2,-5 5,2 5,-2 2,5M-3,-48v-5h6v5', 'none', { stroke: C.goldDark, 'stroke-width': 2, 'stroke-linejoin': 'round' });
}

function pyramid(g, top) {
  if (top) {
    shadow(g, 31, 25); path(g, 'M0,-32 33,-4 0,26 -33,-4Z', C.teal);
    path(g, 'M0,-32 0,-4 -33,-4Z', C.pale); path(g, 'M0,-32 33,-4 0,-4Z', C.glass);
    path(g, 'M0,-4 33,-4 0,26Z', C.dark); line(g, -33, -4, 33, -4, C.line, .8); line(g, 0, -32, 0, 26, C.line, .8); return;
  }
  shadow(g, 34); plinth(g, 35);
  path(g, 'M0,-64 -32,-9 0,2Z', C.glass); path(g, 'M0,-64 32,-9 0,2Z', C.teal);
  path(g, 'M0,-64 -11,-45 0,-42 11,-45Z', C.pale);
  for (const y of [-45, -30, -15]) { const w = (y + 64) * 32 / 55; path(g, `M${-w},${y}L0,${y + w * .34} ${w},${y}`, 'none', { stroke: C.line, 'stroke-width': .8 }); }
  for (const x of [-21, -10, 10, 21]) line(g, 0, -63, x, -9 + (32 - Math.abs(x)) * .34, C.line, .7);
  line(g, 0, -64, 0, 2, C.gold, 1.2);
}

function mosque(g, top, grand) {
  const domeFill = grand ? C.teal : C.ivory;
  if (top) {
    roof(g, 29, 24, C.stone); rect(g, -22, -18, 44, 36, C.ivory, 2);
    for (const x of [-26, 26]) for (const y of [-23, 21]) { circle(g, x, y, 3.5, C.gold); circle(g, x, y - 1, 2.4, C.ivory); }
    for (const x of [-15, 15]) for (const y of [-13, 12]) circle(g, x, y, 5, grand ? C.glass : C.stone);
    circle(g, 0, -2, grand ? 13 : 11, C.gold); circle(g, 0, -3, grand ? 11 : 9, domeFill); ellipse(g, -3, -6, 4, 3, grand ? C.glass : '#ffffff'); return;
  }
  shadow(g, 37); minaret(g, -29, -10, grand ? 48 : 43); minaret(g, 28, -10, grand ? 48 : 43);
  block(g, -25, -3, 50, 18, 4);
  for (const x of [-17, 17]) { rect(g, x - 7, -23, 14, 7, C.ivory); dome(g, x, -23, 7, grand ? C.glass : C.stone); }
  rect(g, -12, -31, 24, 12, C.ivory); dome(g, 0, -31, grand ? 14 : 12, domeFill);
  path(g, 'M-5,-3v-11Q0,-23 5,-14v11Z', C.teal); path(g, 'M-8,-4v-11Q0,-27 8,-15v11', 'none', { stroke: C.gold, 'stroke-width': 1.5 });
  for (const x of [-20, -13, 12, 19]) path(g, `M${x},-7v-5q2,-5 4,0v5Z`, C.dark);
  minaret(g, -34, 1, grand ? 50 : 40); minaret(g, 33, 1, grand ? 50 : 40);
}

function campus(g, top) {
  if (top) {
    roof(g, 34, 22, C.lawn); rect(g, -31, -19, 62, 10, C.ivory); rect(g, -31, -10, 12, 30, C.ivory); rect(g, 19, -10, 12, 30, C.ivory);
    rect(g, -15, -6, 30, 12, C.stone); rect(g, -5, -4, 10, 18, C.teal); return;
  }
  shadow(g, 38); path(g, 'M-30,-4 1,-14 34,-4 3,7Z', C.lawn);
  block(g, -30, -7, 60, 25, 5); rect(g, -24, -25, 48, 12, C.teal);
  for (const x of [-17, -8, 1, 10, 19]) line(g, x, -24, x, -13, C.glass, 1);
  block(g, -35, 0, 13, 24, 6); block(g, 23, 0, 12, 24, 5);
  block(g, -14, -2, 28, 15, 5); rect(g, -8, -16, 16, 14, C.glass); line(g, 0, -16, 0, -2, C.ivory, 1.5);
  rect(g, -18, -33, 36, 2.5, C.gold);
}

function arena(g, top, ice) {
  if (top) {
    shadow(g, 35, 24); ellipse(g, 0, -3, 35, 25, C.shade); ellipse(g, 0, -5, 33, 23, C.ivory);
    ellipse(g, 0, -5, 24, 15, C.teal); rect(g, -18, -14, 36, 18, ice ? C.pale : C.lawn, ice ? 6 : 1);
    rect(g, -14, -12, 28, 14, 'none', ice ? 5 : 0, { stroke: '#ffffffbb', 'stroke-width': 1 }); line(g, 0, -12, 0, 2, '#ffffffbb', 1); return;
  }
  shadow(g, 38); ellipse(g, 0, -7, 36, 12, C.shade); path(g, 'M-35,-17v10Q0,12 35,-7v-10Z', ice ? C.teal : C.glass);
  for (let x = -28; x <= 28; x += 8) line(g, x, -12, x, -3, C.line, 1);
  ellipse(g, 0, -19, 36, 16, C.ivory); ellipse(g, 0, -20, 26, 10, C.dark); ellipse(g, 0, -19, 20, 6, ice ? C.pale : C.lawn);
  if (ice) { path(g, 'M-33,-22Q0,-39 33,-22L20,-16Q0,-27 -20,-16Z', C.glass); line(g, -28, -24, 26, -24, C.line, 1); }
  else { path(g, 'M-32,-25Q-8,-41 21,-30L15,-23Q-8,-30 -23,-19Z', C.stone); line(g, 0, -24, 0, -15, '#ffffffbb', 1); }
  path(g, 'M-30,-18Q0,-2 30,-18', 'none', { stroke: C.gold, 'stroke-width': 1.5 });
}

function nurAlem(g, top) {
  if (top) {
    shadow(g, 31, 29); circle(g, 0, -2, 31, C.stone); circle(g, 0, -3, 27, C.teal); circle(g, -2, -5, 24, C.glass);
    ellipse(g, 0, -3, 13, 27, 'none', { stroke: C.line, 'stroke-width': 1 }); ellipse(g, 0, -3, 27, 13, 'none', { stroke: C.line, 'stroke-width': 1 });
    ellipse(g, -8, -12, 9, 6, C.pale); return;
  }
  shadow(g, 32); ellipse(g, 0, -2, 27, 8, C.stone); rect(g, -13, -15, 26, 12, C.dark);
  circle(g, 0, -33, 28, C.dark); circle(g, -1, -35, 27, C.teal);
  path(g, 'M-25,-37A26,26 0 0 1 15,-57Q9,-26 -18,-16A26,26 0 0 1 -25,-37Z', C.glass);
  ellipse(g, -8, -47, 10, 6, C.pale, { transform: 'rotate(-25 -8 -47)' });
  for (const rx of [10, 20]) ellipse(g, 0, -34, rx, 27, 'none', { stroke: C.line, 'stroke-width': .8 });
  for (const y of [-48, -34, -20]) { const w = Math.sqrt(27 ** 2 - (y + 34) ** 2); ellipse(g, 0, y, w, 3.6, 'none', { stroke: C.line, 'stroke-width': .7 }); }
  path(g, 'M-25,-23Q0,-13 25,-23', 'none', { stroke: C.gold, 'stroke-width': 1.3 });
}

function station(g, top, modern) {
  if (top) {
    roof(g, 34, 18); rect(g, -30, -14, 60, 15, modern ? C.teal : C.stone, 2);
    for (let y = 7; y <= 21; y += 5) { line(g, -35, y, 35, y, C.edge, 1); for (const x of [-25, -10, 5, 20]) line(g, x, y - 2, x, y + 2, C.stone, 2); }
    if (!modern) circle(g, 0, -7, 6, C.gold); return;
  }
  shadow(g, 38); block(g, -34, -3, 66, 20, 5, C.stone);
  if (modern) {
    rect(g, -30, -22, 60, 16, C.teal); windows(g, -27, -21, 10, 6, 14, 1, C.line);
    path(g, 'M-37,-25Q0,-47 38,-25L33,-20Q0,-34 -33,-20Z', C.ivory);
    path(g, 'M-33,-25Q0,-41 33,-25', 'none', { stroke: C.gold, 'stroke-width': 1.3 });
  } else {
    windows(g, -30, -19, 4, 7, 10, 3); windows(g, 8, -19, 4, 7, 10, 3);
    block(g, -8, -4, 16, 35, 3); path(g, 'M-11,-39 0,-47 11,-39Z', C.teal);
    circle(g, 0, -29, 5, C.ivory); line(g, 0, -29, 0, -32, C.goldDark, 1); line(g, 0, -29, 3, -28, C.goldDark, 1);
    rect(g, -4, -15, 8, 11, C.dark, 3);
  }
  line(g, -33, 3, 33, 3, C.edge, 1); line(g, -32, 6, 34, 6, C.edge, 1);
  for (let x = -27; x <= 27; x += 9) line(g, x, 2, x, 7, C.stone, 2);
}

function airport(g, top) {
  if (top) {
    shadow(g, 36, 24); rect(g, -31, -10, 62, 19, C.ivory, 5); circle(g, 0, -1, 16, C.teal); ellipse(g, -4, -5, 7, 5, C.glass);
    for (const x of [-26, -17, 17, 26]) rect(g, x - 2, 7, 4, 15, C.stone, 1);
    path(g, 'M1,-34 4,-24 16,-18 16,-15 4,-18 4,-8 8,-4 8,-2 1,-4 -6,-2 -6,-4 -2,-8 -2,-18 -14,-15 -14,-18 -2,-24Z', C.gold); return;
  }
  shadow(g, 37); block(g, -34, -4, 67, 16, 4); rect(g, -29, -17, 58, 10, C.teal);
  windows(g, -26, -16, 9, 6, 8, 1, C.line); rect(g, -13, -29, 26, 15, C.ivory); dome(g, 0, -30, 18, C.teal);
  block(g, 25, -16, 5, 30, 3); rect(g, 22, -48, 12, 7, C.dark, 1); rect(g, 21, -50, 14, 2, C.ivory, 1); line(g, 28, -50, 28, -59, C.gold, 1);
  path(g, 'M-22,-45l2,-9 3,8 10,4v2l-11,-2 -5,4 -2,-1 3,-5 -8,-3v-2Z', C.gold);
}

function towers(g, top) {
  if (top) {
    roof(g, 31, 22); for (const [x, y, w, h] of [[-20,-15,15,28],[1,-19,15,32],[18,-4,10,19]]) {
      rect(g, x, y, w, h, C.dark, 1); rect(g, x + 2, y + 2, w - 4, h - 4, C.glass, 1); line(g, x + w / 2, y + 2, x + w / 2, y + h - 2, C.line, 1);
    } return;
  }
  shadow(g, 31); block(g, -29, -1, 54, 9, 7, C.stone);
  const tower = (x, base, width, height, depth) => {
    block(g, x, base, width, height, depth, C.teal);
    rect(g, x + 2, base - height + 2, width - 4, height - 4, C.glass);
    for (let y = base - height + 7; y < base - 2; y += 7) line(g, x + 2, y, x + width - 2, y, C.line, .6);
    line(g, x + width * .45, base - height + 2, x + width * .45, base - 2, C.line, 1);
  };
  tower(-24, -5, 17, 46, 6); tower(0, -4, 16, 70, 6); tower(19, -1, 10, 28, 4);
  path(g, 'M0,-74l6,-4 16,0 -6,4Z', C.goldLight); line(g, 8, -77, 8, -81, C.gold, 1);
}

function shabyt(g, top) {
  if (top) {
    shadow(g, 32, 27); ellipse(g, 0, -3, 32, 27, C.teal); ellipse(g, 0, -5, 29, 24, C.glass); ellipse(g, 0, -5, 13, 11, C.dark); ellipse(g, 0, -4, 10, 8, C.lawn);
    for (let index = 0; index < 10; index += 1) { const a = index * Math.PI / 5; line(g, Math.cos(a) * 15, -5 + Math.sin(a) * 12, Math.cos(a) * 29, -5 + Math.sin(a) * 24, C.line, .7); } return;
  }
  shadow(g, 35); path(g, 'M-32,-25Q0,-7 32,-25v18Q0,12 -32,-7Z', C.teal);
  for (let x = -26; x <= 26; x += 6.5) line(g, x, -20, x, -4, C.glass, 1);
  ellipse(g, 0, -27, 32, 17, C.glass); ellipse(g, 0, -28, 16, 8, C.dark); ellipse(g, 0, -25, 11, 4, C.lawn);
  path(g, 'M-31,-26Q0,-8 31,-26M-32,-28Q0,-48 32,-28', 'none', { stroke: C.ivory, 'stroke-width': 2 });
  path(g, 'M-13,-29Q0,-36 13,-29', 'none', { stroke: C.gold, 'stroke-width': 1.3 });
}

function fallback(g, top) {
  if (top) { roof(g, 22, 18); rect(g, -14, -11, 28, 20, C.teal, 2); circle(g, 0, -1, 5, C.gold); return; }
  shadow(g, 25); block(g, -20, -2, 40, 25, 5); path(g, 'M-24,-29 0,-43 24,-29Z', C.teal);
  windows(g, -14, -23, 4, 8, 10, 4); rect(g, -5, -12, 10, 10, C.gold);
}

const BUILDERS = Object.freeze({
  baiterek, akorda, khan_shatyr: khanShatyr, national_museum: museum, astana_opera: opera,
  palace_peace: pyramid, hazret_sultan: (g, top) => mosque(g, top, false),
  grand_mosque: (g, top) => mosque(g, top, true), nazarbayev_university: campus,
  astana_arena: (g, top) => arena(g, top, false), barys_arena: (g, top) => arena(g, top, true),
  nur_alem: nurAlem, nurly_zhol_station: (g, top) => station(g, top, true),
  astana_1_station: (g, top) => station(g, top, false), astana_airport: airport,
  abu_dhabi_plaza: towers, shabyt,
});

/**
 * Build a fresh SVG <g>. Translate this group to camera.project(anchor); it is
 * already scaled to screen pixels and should not receive the world matrix.
 * `top` draws a roof plan; `tilted` draws an upright miniature with side faces.
 */
export function createLandmarkSymbol(id, { projection = 'tilted', size = 64, selected = false } = {}) {
  const safeSize = Number.isFinite(size) && size > 0 ? size : 64;
  const group = element('g', {
    transform: `scale(${safeSize / 80})`, 'data-landmark-id': id,
    'data-projection': projection === 'top' ? 'top' : 'tilted',
    'data-illustrative': 'true', role: 'img', 'aria-label': landmarkLabel(id),
    'stroke-linejoin': 'round',
  });
  const title = element('title');
  title.textContent = `${landmarkLabel(id)} · архитектурная миниатюра`;
  group.appendChild(title);
  if (selected) {
    ellipse(group, 0, projection === 'top' ? 0 : 2, 39, projection === 'top' ? 32 : 12, '#e8c5732b', { stroke: C.selection, 'stroke-width': 1.5 });
  }
  const build = Object.prototype.hasOwnProperty.call(BUILDERS, id) ? BUILDERS[id] : fallback;
  build(group, projection === 'top');
  return group;
}
