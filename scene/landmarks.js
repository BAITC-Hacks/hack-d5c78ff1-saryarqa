/** Architectural miniatures. Shapes, materials and heights are illustrative;
 * geographic positions are supplied by the caller. Ground anchor: (0, 0). */
const NS = 'http://www.w3.org/2000/svg';
export const LANDMARK_STYLES = Object.freeze({
  ivory: '#fff9e9', stone: '#dfd9c6', shade: '#afbbaa', edge: '#7a968e',
  teal: '#276d78', glass: '#78b5bd', dark: '#174755', pale: '#c4e3df',
  gold: '#d0aa57', goldLight: '#ffe29a', goldDark: '#957136', lawn: '#83a889',
  shadow: '#143e3f22', line: '#ffffffa6', selection: '#cba45b',
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
export const landmarkLabel = id => Object.hasOwn(LABELS, id) ? LABELS[id] : 'Городской объект';
const node = (tag, attrs = {}) => {
  const result = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) result.setAttribute(key, String(value));
  return result;
};
const add = (g, tag, attrs) => g.appendChild(node(tag, attrs));
const path = (g, d, fill, more = {}) => add(g, 'path', { d, fill, ...more });
const ellipse = (g, x, y, rx, ry, fill, more = {}) => add(g, 'ellipse', { cx: x, cy: y, rx, ry, fill, ...more });
const circle = (g, x, y, r, fill, more = {}) => add(g, 'circle', { cx: x, cy: y, r, fill, ...more });
const line = (g, a, b, color = C.line, width = .7, more = {}) => add(g, 'line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: color, 'stroke-width': width, ...more });
const outline = points => `M${points.map(p => p.join(',')).join('L')}Z`;
const polygon = (g, points, fill, more = {}) => path(g, outline(points), fill, more);
const I = (c, x, y, z = 0) => [(x - y) * .86, (x + y) * (c.top ? .48 : .34) - z * (c.top ? .77 : 1)];
const quad = (c, x, y, w, d, z = 0) => [I(c, x, y, z), I(c, x + w, y, z), I(c, x + w, y + d, z), I(c, x, y + d, z)];

function base(c, w = 28, d = 22) {
  ellipse(c.g, 3, 5, 40, 10, '#1d49470a'); ellipse(c.g, 2, 4, 35, 8, '#1d49470f');
  const top = quad(c, -w, -d, w * 2, d * 2, 1.5), bottom = quad(c, -w, -d, w * 2, d * 2, -.7);
  polygon(c.g, [top[1], top[2], top[3], bottom[3], bottom[2], bottom[1]], C.shade);
  polygon(c.g, top, '#f0eada');
  polygon(c.g, quad(c, -w + 2, -d + 2, w * 2 - 4, d * 2 - 4, 1.6), '#e6e7d6');
}

function box(c, x, y, w, d, h, z = 2, material = C.ivory, glazing = 0) {
  const lower = quad(c, x, y, w, d, z), upper = quad(c, x, y, w, d, z + h);
  polygon(c.g, [lower[1], lower[2], upper[2], upper[1]], material === C.teal ? C.dark : C.shade);
  polygon(c.g, [lower[2], lower[3], upper[3], upper[2]], material === C.teal ? '#3a828a' : C.stone);
  polygon(c.g, upper, material, { stroke: '#fff9e970', 'stroke-width': .45 });
  if (glazing) {
    const rows = Math.max(1, Math.min(8, Math.floor(h / 5))), columns = Math.max(2, Math.min(9, Math.floor(w / 3.5)));
    let front = '', side = '';
    for (let row = 0; row < rows; row += 1) {
      const bottom = z + 1.5 + row * (h - 2) / rows, top = Math.min(z + h - 1, bottom + (h - 2) / rows * .62);
      for (let col = 0; col < columns; col += 1) {
        const left = x + 1 + col * (w - 2) / columns, right = left + (w - 2) / columns * .65;
        front += outline([I(c, left, y + d, bottom), I(c, right, y + d, bottom), I(c, right, y + d, top), I(c, left, y + d, top)]);
      }
      const cols = Math.max(2, Math.min(6, Math.floor(d / 4)));
      for (let col = 0; col < cols; col += 1) {
        const near = y + 1 + col * (d - 2) / cols, far = near + (d - 2) / cols * .65;
        side += outline([I(c, x + w, near, bottom), I(c, x + w, far, bottom), I(c, x + w, far, top), I(c, x + w, near, top)]);
      }
    }
    path(c.g, front, material === C.teal ? '#bbdfdfaa' : C.teal); path(c.g, side, material === C.teal ? '#78b3bcbb' : '#3b7180');
  }
  return { lower, upper };
}

function rim(c, x, y, w, d, z, color = C.gold, width = .9) {
  const q = quad(c, x, y, w, d, z);
  path(c.g, outline(q), 'none', { stroke: color, 'stroke-width': width });
}

function dome(c, x, y, z, r, color = C.teal) {
  const [px, py] = I(c, x, y, z), h = r * (c.top ? .8 : 1.05);
  ellipse(c.g, px, py + 1, r + 1, r * .26, C.goldDark);
  path(c.g, `M${px - r},${py}C${px - r},${py - h * .65} ${px - r * .55},${py - h} ${px},${py - h}C${px + r * .55},${py - h} ${px + r},${py - h * .65} ${px + r},${py}Z`, color);
  path(c.g, `M${px},${py - h}Q${px + r * .7},${py - h * .8} ${px + r},${py}H${px}Z`, color === C.ivory ? C.stone : '#1d5665');
  for (const t of [-.55, 0, .55]) path(c.g, `M${px},${py - h}Q${px + r * t},${py - h * .55} ${px + r * t * 1.35},${py}`, 'none', { stroke: '#ffffff67', 'stroke-width': .65 });
  ellipse(c.g, px, py, r, r * .22, 'none', { stroke: C.gold, 'stroke-width': 1 });
  line(c.g, [px, py - h], [px, py - h - 5], C.gold, 1);
  circle(c.g, px, py - h - 5.5, 1.2, C.goldLight);
}

function columns(c, x, y, count, step, h, z = 2) {
  for (let index = 0; index < count; index += 1) {
    const [px, py] = I(c, x + index * step, y, z), top = I(c, x + index * step, y, z + h);
    line(c.g, [px, py], top, C.shade, 2.8); line(c.g, [px - .7, py], [top[0] - .7, top[1]], C.ivory, 1.5);
    ellipse(c.g, px, py, 1.7, .65, C.stone); ellipse(c.g, top[0], top[1], 1.8, .8, C.ivory);
  }
}

function minaret(c, x, y, height = 38) {
  const [px, py] = I(c, x, y, 2), top = I(c, x, y, height);
  path(c.g, `M${px - 2.3},${py}L${top[0] - 1.4},${top[1]}H${top[0] + 1.4}L${px + 2.3},${py}Z`, C.ivory);
  line(c.g, [px + 1.2, py], [top[0] + .8, top[1]], C.shade, 1);
  for (const f of [.35, .7, 1]) { const p = I(c, x, y, 2 + (height - 2) * f); ellipse(c.g, p[0], p[1], 2.7, .8, C.gold); }
  path(c.g, `M${top[0] - 1.6},${top[1]}l1.6,-6 1.6,6Z`, C.teal); line(c.g, [top[0], top[1] - 6], [top[0], top[1] - 9], C.gold, .8);
}

function baiterek(c) {
  base(c, 21, 20);
  const [x, y] = I(c, 0, 0, 3), ball = I(c, 0, 0, 64), neck = I(c, 0, 0, 40);
  ellipse(c.g, x, y, 16, 5.5, C.ivory); ellipse(c.g, x, y - 1, 12, 3.5, C.gold); ellipse(c.g, x, y - 1.5, 10, 2.8, C.stone);
  for (let i = -3; i <= 3; i += 1) {
    const bottom = x + i * 3.2, crown = ball[0] + i * 4;
    path(c.g, `M${bottom},${y - 2}Q${neck[0] - i * 2},${neck[1]} ${crown},${ball[1] + 6}`, 'none', { stroke: i % 2 ? C.ivory : '#b6c4b5', 'stroke-width': 1.8 });
    path(c.g, `M${bottom},${y - 2}Q${neck[0] + i * 2},${neck[1]} ${-crown},${ball[1] + 6}`, 'none', { stroke: '#f9f5dd', 'stroke-width': .75 });
  }
  for (const z of [14, 24, 35, 47]) { const p = I(c, 0, 0, z); ellipse(c.g, p[0], p[1], z > 35 ? 7 : 4.2, 1.1, 'none', { stroke: C.gold, 'stroke-width': .75 }); }
  circle(c.g, ball[0] + .8, ball[1], 13.5, C.goldDark); circle(c.g, ball[0] - .8, ball[1] - 1, 12.7, C.gold);
  path(c.g, `M${ball[0] - 12},${ball[1] - 4}Q${ball[0] - 6},${ball[1] - 17} ${ball[0] + 7},${ball[1] - 10}Q${ball[0]},${ball[1] - 4} ${ball[0] - 12},${ball[1] - 4}`, C.goldLight);
  for (const w of [5, 10]) ellipse(c.g, ball[0], ball[1], w, 12.6, 'none', { stroke: '#94723b88', 'stroke-width': .6 });
  for (const dy of [-6, 1, 7]) ellipse(c.g, ball[0], ball[1] + dy, Math.sqrt(13 ** 2 - dy ** 2), 2.3, 'none', { stroke: '#fff1b9aa', 'stroke-width': .55 });
}

function akorda(c) {
  base(c, 29, 22); box(c, -25, -12, 50, 24, 11, 2, C.ivory, 1);
  box(c, -26, -13, 11, 25, 15, 2, C.ivory, 1); box(c, 15, -13, 11, 25, 15, 2, C.ivory, 1);
  box(c, -12, -10, 24, 22, 19, 2, C.ivory, 1); rim(c, -12, -10, 24, 22, 21);
  box(c, -8, -7, 16, 14, 5, 21, C.ivory); dome(c, 0, 0, 27, 9.5);
  for (let i = 0; i < 3; i += 1) box(c, -14 - i, 14 + i * 1.6, 28 + i * 2, 2, 1, 3 - i * .55, C.ivory);
  columns(c, -10, 15, 6, 4, 14, 5);
  const front = [I(c, -14, 16, 20), I(c, 0, 16, 27), I(c, 14, 16, 20)]; polygon(c.g, front, C.ivory); line(c.g, front[0], front[2], C.gold, 1.1);
  const p = I(c, 0, 0, 47); line(c.g, [p[0], p[1] + 8], p, C.gold, .9); path(c.g, `M${p[0]},${p[1]}l8,1 -1,4 -7,-1Z`, C.teal);
}

function khan(c) {
  base(c, 28, 25); const y = c.top ? -3 : -2, peak = c.top ? [7, -48] : [7, -65];
  ellipse(c.g, 0, y, 34, c.top ? 20 : 13, C.shade); ellipse(c.g, 0, y - 2, 33, c.top ? 18 : 11, C.teal);
  path(c.g, `M-34,${y - 4}Q-5,-34 ${peak[0]},${peak[1]}Q15,-24 34,${y - 4}Q8,${y + 17} -34,${y - 4}Z`, '#f6f2dc');
  path(c.g, `M${peak[0]},${peak[1]}Q17,-25 34,${y - 4}Q25,${y + 7} 9,${y + 7}Z`, '#ccd5c8');
  for (let i = -4; i <= 4; i += 1) { const x = i * 7.2, bottom = y + 7 - Math.abs(i) * 2.6; path(c.g, `M${peak[0]},${peak[1]}Q${x * .4},-21 ${x},${bottom}`, 'none', { stroke: i % 2 ? '#fffdf0' : '#b6c3b6', 'stroke-width': i % 2 ? 1.1 : .65 }); }
  for (const t of [.32, .57, .78]) { const half = 34 * t, cy = peak[1] * (1 - t) + y * t; path(c.g, `M${-half + 7 * (1-t)},${cy}Q7,${cy + 13 * t} ${half + 7 * (1-t)},${cy}`, 'none', { stroke: '#b6c4b177', 'stroke-width': .65 }); }
  ellipse(c.g, 0, y - 1, 33, c.top ? 13 : 8.4, 'none', { stroke: C.gold, 'stroke-width': 1.2 });
  line(c.g, peak, [peak[0] + 2, peak[1] - 10], C.goldDark, 1.4); box(c, -4, 18, 8, 4, 5, 2, C.teal, 1);
}

function museum(c) {
  base(c, 30, 23); box(c, -26, -13, 21, 21, 20, 2, C.ivory, 1);
  box(c, -2, -17, 24, 23, 30, 2, C.gold, 0); box(c, 21, -7, 9, 19, 16, 2, C.ivory, 1);
  box(c, -19, 8, 31, 10, 10, 2, C.teal, 1); box(c, -29, 7, 10, 13, 13, 2, C.ivory, 1);
  const facade = [I(c, 1, 6, 7), I(c, 18, 6, 7), I(c, 18, 6, 29), I(c, 1, 6, 29)]; polygon(c.g, facade, '#ebc873');
  for (let i = 0; i < 6; i += 1) line(c.g, I(c, 1 + i * 3, 6, 7), I(c, 1 + i * 3, 6, 29), '#b38f4555', .65);
  path(c.g, outline([I(c, 4, 6, 11), I(c, 15, 6, 25), I(c, 16, 6, 24), I(c, 5, 6, 10)]), C.goldLight);
  rim(c, -2, -17, 24, 23, 32, '#fff0bb', 1); box(c, -15, 19, 29, 3, 1.2, 1.5, C.ivory);
}

function opera(c) {
  base(c, 30, 25); box(c, -23, -16, 46, 28, 17, 3, C.ivory, 1);
  polygon(c.g, [I(c,-25,-18,20),I(c,0,-18,29),I(c,25,-18,20),I(c,25,10,20),I(c,0,10,29),I(c,-25,10,20)], C.teal);
  polygon(c.g, [I(c,0,-18,29),I(c,25,-18,20),I(c,25,10,20),I(c,0,10,29)], '#285967');
  for (let i = 0; i < 4; i += 1) box(c, -26-i*.7, 15+i*1.6, 52+i*1.4, 2, 1, 3-i*.55, C.ivory);
  columns(c, -22, 16, 8, 6.2, 17, 5);
  polygon(c.g, [I(c,-27,17,23),I(c,0,17,34),I(c,27,17,23)], C.ivory);
  polygon(c.g, [I(c,-21,17,24),I(c,0,17,31),I(c,21,17,24)], '#d8d4bd');
  line(c.g, I(c,-27,17,23),I(c,27,17,23),C.gold,1.2);
  const p=I(c,0,15,37); path(c.g,`M${p[0]-7},${p[1]}l2,-4 3,1 2,-3 2,3 3,-1 2,4M${p[0]-4},${p[1]+1}h10`, 'none',{stroke:C.goldDark,'stroke-width':1.5});
}

function pyramid(c) {
  base(c, 25, 25); const ground=quad(c,-22,-22,44,44,3),apex=I(c,0,0,58);
  polygon(c.g,[ground[0],ground[1],apex],C.pale); polygon(c.g,[ground[1],ground[2],apex],C.teal);polygon(c.g,[ground[2],ground[3],apex],C.glass);
  for(const [left,right] of [[ground[1],ground[2]],[ground[2],ground[3]]]){
    for(let i=1;i<=5;i++){const f=i/6;line(c.g,[apex[0]+(left[0]-apex[0])*f,apex[1]+(left[1]-apex[1])*f],[apex[0]+(right[0]-apex[0])*f,apex[1]+(right[1]-apex[1])*f],C.line,.55);}
    for(let i=1;i<5;i++){const f=i/5;line(c.g,apex,[left[0]+(right[0]-left[0])*f,left[1]+(right[1]-left[1])*f],C.line,.55);}
  }
  const crown=ground.map(p=>[apex[0]+(p[0]-apex[0])*.3,apex[1]+(p[1]-apex[1])*.3]);polygon(c.g,[apex,crown[1],crown[2],crown[3]],'#cde6dfaa');
  line(c.g,apex,ground[2],C.goldLight,1);rim(c,-22,-22,44,44,3,C.gold,1);
}

function mosque(c, grand) {
  base(c,29,25); minaret(c,-24,-21,grand?49:41);minaret(c,24,-21,grand?49:41);
  box(c,-23,-17,46,34,12,2,C.ivory,1);box(c,-11,-9,22,21,11,14,C.ivory,1);
  dome(c,0,0,27,grand?13:10.5,grand?C.teal:C.ivory);
  for(const[x,y]of[[-17,-8],[17,-8],[-17,12],[17,12]])dome(c,x,y,15,4.8,grand?C.glass:C.ivory);
  box(c,-9,17,18,5,17,2,C.ivory);
  const left=I(c,-5,22,3),right=I(c,5,22,3),tip=I(c,0,22,17);
  path(c.g,`M${left}L${left[0]},${tip[1]+5}Q${tip} ${right[0]},${tip[1]+5}L${right}Z`,C.teal);
  line(c.g,I(c,-9,22,19),I(c,9,22,19),C.gold,1.2);
  minaret(c,-25,22,grand?48:39);minaret(c,25,22,grand?48:39);
}

function university(c) {
  base(c,30,25);box(c,-25,-19,50,11,22,2,C.ivory,1);box(c,-25,-8,11,28,17,2,C.ivory,1);box(c,14,-8,11,28,17,2,C.ivory,1);
  polygon(c.g,quad(c,-11,-6,22,22,2),C.lawn);polygon(c.g,quad(c,-2,-4,4,27,2.2),C.stone);
  box(c,-12,4,24,14,14,2,C.teal,1);box(c,-9,5,18,11,1,16,C.pale);
  for(let i=0;i<5;i++)line(c.g,I(c,-9+i*4.5,5,17),I(c,-9+i*4.5,16,17),C.ivory,.8);
  rim(c,-25,-19,50,11,24,C.gold,.9);
  columns(c,-10,19,6,4,13,2);box(c,-14,18,28,3,1.2,15,C.ivory);
}

function arena(c, ice) {
  base(c,30,24); const cy=-8,ry=c.top?23:17;
  path(c.g,`M-34,${cy}v12Q0,${cy+ry+21} 34,${cy+12}V${cy}Z`,ice?'#426c76':'#659299');
  for(let x=-28;x<=28;x+=4)line(c.g,[x,cy+4],[x,cy+13+6*(1-Math.abs(x)/34)],'#cbe5df77',.7);
  ellipse(c.g,0,cy,34,ry,C.ivory);ellipse(c.g,0,cy,26,ry*.7,C.dark);ellipse(c.g,0,cy+1,20,ry*.48,ice?C.pale:C.lawn);
  path(c.g,`M-33,${cy-3}Q-6,${cy-ry-11} 25,${cy-10}L17,${cy-4}Q-7,${cy-ry+4} -25,${cy+3}Z`,ice?C.glass:'#cbd6c8');
  path(c.g,`M-33,${cy-3}Q-6,${cy-ry-11} 25,${cy-10}`, 'none',{stroke:'#fffcef','stroke-width':1.8});
  for(let i=-2;i<=3;i++){const x=i*8;line(c.g,[x,cy-ry+Math.abs(x)*.1],[x+3,cy-ry*.52+Math.abs(x)*.05],C.ivory,.8);}
  ellipse(c.g,0,cy,33.5,ry,'none',{stroke:C.gold,'stroke-width':.9});
  if(ice){path(c.g,`M-16,${cy+1}Q0,${cy-8} 16,${cy+1}Q0,${cy+10} -16,${cy+1}Z`,'none',{stroke:'#fff','stroke-width':.7});line(c.g,[0,cy-4],[0,cy+7],'#749eaa',.7);}
  else {line(c.g,[-13,cy+1],[13,cy+1],'#d9ebd3',.6);ellipse(c.g,0,cy+1,4,2,'none',{stroke:'#d9ebd3','stroke-width':.6});}
  box(c,-6,24,12,3,5,2,C.teal,1);
}

function nurAlem(c) {
  base(c,26,25);box(c,-17,-15,34,30,5,2,C.stone);const cy=c.top?-24:-31,r=27;
  circle(c.g,1,cy+1,r,C.dark);circle(c.g,-1,cy-1,r-1,C.teal);
  path(c.g,`M-26,${cy-3}A26,26 0 0 1 14,${cy-23}Q9,${cy+6} -14,${cy+21}A26,26 0 0 1 -26,${cy-3}Z`,'#78b8bc');
  for(const rx of [7,15,23])ellipse(c.g,0,cy,rx,r-1,'none',{stroke:'#d6ece18c','stroke-width':.65});
  for(const dy of [-19,-10,0,10,19])ellipse(c.g,0,cy+dy,Math.sqrt((r-1)**2-dy**2),3.5,'none',{stroke:'#d6ece18c','stroke-width':.6});
  path(c.g,`M-22,${cy-8}Q-14,${cy-26} 3,${cy-20}Q-5,${cy-10} -22,${cy-8}`, '#dcf4e688');
  line(c.g,[-18,cy+18],[18,cy-18],'#fffbd699',1.1);ellipse(c.g,0,cy+r-2,9,2.7,C.goldDark);
  box(c,-7,20,14,4,4,2,C.teal,1);
}

function modernStation(c) {
  base(c,32,24);box(c,-29,-15,58,27,16,2,C.teal,1);
  for(const y of [-10,-2,6]){
    const l=I(c,-32,y,18),m=I(c,0,y,29),r=I(c,32,y,18),lf=I(c,-32,y+4,18),mf=I(c,0,y+4,29),rf=I(c,32,y+4,18);
    path(c.g,`M${l}Q${m} ${r}L${rf}Q${mf} ${lf}Z`, y===-2?'#e4d6aa':C.ivory);
    path(c.g,`M${l}Q${m} ${r}`,'none',{stroke:'#fefcf2','stroke-width':1.2});
  }
  for(const x of [-22,-11,0,11,22])columns(c,x,14,1,0,16,2);
  for(const y of [18,22]){line(c.g,I(c,-29,y,2),I(c,29,y,2),C.edge,.65);line(c.g,I(c,-29,y+1.4,2),I(c,29,y+1.4,2),C.edge,.65);}
  const q=I(c,-14,14,10);path(c.g,`M${q[0]},${q[1]}h26`,'none',{stroke:C.goldLight,'stroke-width':1.1});
  box(c,-13,19,26,4,3,2,C.ivory,1);
}

function oldStation(c) {
  base(c,31,24);box(c,-27,-12,54,24,16,2,C.ivory,1);
  box(c,-10,-13,20,25,21,2,C.ivory,1);box(c,-5,-5,10,10,12,23,C.ivory,0);
  polygon(c.g,[I(c,-7,-7,35),I(c,0,-7,42),I(c,7,-7,35),I(c,7,7,35),I(c,0,7,42),I(c,-7,7,35)],C.teal);
  for(const x of [-25,15]){polygon(c.g,quad(c,x,-14,10,28,19),C.teal);rim(c,x,-14,10,28,19,C.gold,.65);}
  const p=I(c,0,5,30);circle(c.g,p[0],p[1],3.2,C.gold);circle(c.g,p[0],p[1],2.6,C.ivory);line(c.g,p,[p[0],p[1]-1.7],C.dark,.7);line(c.g,p,[p[0]+1.7,p[1]+.4],C.dark,.7);
  columns(c,-9,15,5,4.5,14,2);box(c,-12,14,24,4,2,16,C.ivory);
  for(const y of [20,23])line(c.g,I(c,-28,y,2),I(c,29,y,2),C.edge,.7);
  box(c,-10,20,20,3,1,2,C.stone);
}

function airport(c) {
  base(c,32,24);box(c,-28,-11,56,24,12,2,C.teal,1);box(c,-11,-13,22,26,10,14,C.ivory,1);dome(c,0,0,25,13,C.teal);
  for(const x of [-25,-15,15,25])box(c,x,13,3,10,4,2,C.ivory,0);
  box(c,23,-20,5,6,31,2,C.ivory);box(c,20,-22,11,10,6,33,C.teal,1);rim(c,20,-22,11,10,39,C.ivory,1);
  const t=I(c,25,-17,42);line(c.g,t,[t[0],t[1]-8],C.gold,.8);
  const p=I(c,-18,-7,42);path(c.g,`M${p[0]},${p[1]}l3,-11 2,10 12,7 -1,2 -12,-5 -1,9 4,3 -1,1 -6,-2 -5,1 -1,-1 4,-3 1,-9 -12,2 -1,-2Z`,C.gold);
}

function towers(c) {
  base(c,27,22);box(c,-24,-18,47,36,6,2,C.ivory,1);
  box(c,-19,-13,13,15,46,8,C.teal,1);rim(c,-19,-13,13,15,54,C.pale,.7);
  box(c,-3,-12,14,16,70,8,C.teal,1);rim(c,-3,-12,14,16,78,C.gold,1);
  polygon(c.g,quad(c,-1,-10,10,12,79),C.pale);line(c.g,I(c,4,-4,79),I(c,4,-4,86),C.gold,.8);
  box(c,13,3,9,13,27,8,C.teal,1);box(c,-19,7,13,9,21,8,C.teal,1);
  line(c.g,I(c,-3,4,10),I(c,-3,4,76),'#edf6e4aa',1.3);line(c.g,I(c,11,4,10),I(c,11,4,76),'#edf6e477',.8);
}

function shabyt(c) {
  base(c,29,25);const cy=-13,ry=c.top?23:17;
  path(c.g,`M-32,${cy-4}Q0,${cy+ry+2} 32,${cy-4}L29,${cy+17}Q0,${cy+ry+22} -29,${cy+17}Z`,C.teal);
  for(let x=-26;x<=26;x+=4)line(c.g,[x,cy+4+8*(1-Math.abs(x)/28)],[x*.91,cy+18+7*(1-Math.abs(x)/28)],'#a9d6ce',.75);
  ellipse(c.g,0,cy-4,32,ry,C.glass);ellipse(c.g,0,cy-5,16,ry*.5,C.dark);ellipse(c.g,0,cy,12,ry*.28,'#91ae88');
  for(let i=0;i<12;i++){const a=i*Math.PI/6;line(c.g,[Math.cos(a)*17,cy-4+Math.sin(a)*ry*.52],[Math.cos(a)*31,cy-4+Math.sin(a)*ry],C.line,.65);}
  ellipse(c.g,0,cy-4,32,ry,'none',{stroke:C.ivory,'stroke-width':1.6});ellipse(c.g,0,cy-5,16,ry*.5,'none',{stroke:C.gold,'stroke-width':.9});
  box(c,-7,24,14,4,5,2,C.teal,1);
}

function fallback(c) { base(c,24,21);box(c,-18,-13,36,26,20,2,C.ivory,1);box(c,-12,-8,24,16,6,22,C.teal,1);rim(c,-18,-13,36,26,22,C.gold,1); }
const BUILDERS=Object.freeze({baiterek,akorda,khan_shatyr:khan,national_museum:museum,astana_opera:opera,palace_peace:pyramid,
  hazret_sultan:c=>mosque(c,false),grand_mosque:c=>mosque(c,true),nazarbayev_university:university,
  astana_arena:c=>arena(c,false),barys_arena:c=>arena(c,true),nur_alem:nurAlem,nurly_zhol_station:modernStation,
  astana_1_station:oldStation,astana_airport:airport,abu_dhabi_plaza:towers,shabyt});

/** Fresh, self-contained SVG group. Place inside translate(screenX, screenY).
 * Top is a shallower architectural miniature; tilted emphasizes vertical mass.
 * No global SVG IDs, filters, timers, randomness or camera dependencies. */
export function createLandmarkSymbol(id,{projection='tilted',size=64,selected=false}={}) {
  const scale=(Number.isFinite(size)&&size>0?size:64)/88;
  const group=node('g',{transform:`scale(${scale})`,'data-landmark-id':id,'data-projection':projection==='top'?'top':'tilted',
    'data-illustrative':'true','data-style':'architectural-model-v2',role:'img','aria-label':landmarkLabel(id),'stroke-linejoin':'round','stroke-linecap':'round'});
  const title=node('title');title.textContent=`${landmarkLabel(id)} · архитектурная миниатюра`;group.appendChild(title);
  if(selected)ellipse(group,0,3,45,projection==='top'?26:18,'#e8c5732b',{stroke:C.selection,'stroke-width':1.3});
  const builder=Object.hasOwn(BUILDERS,id)?BUILDERS[id]:fallback;builder({g:group,top:projection==='top'});
  return group;
}
