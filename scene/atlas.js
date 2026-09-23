import { createCamera, pointInRegion, regionBounds, polygonsToPath, segmentsCross } from './camera.js';
import { createLandmarkSymbol } from './landmarks.js';
import { createEffects } from './effects.js';
import { createSpatialIndex, lineBounds } from './spatial-index.js';

const NS = 'http://www.w3.org/2000/svg';
const mounts = new WeakMap();
const districtNames = { esil: 'Есиль', almaty: 'Алматы', saryarka: 'Сарыарка', baikonur: 'Байконур', nura: 'Нура', saraishyk: 'Сарайшық' };
const kindNames = { landmark: 'Достопримечательность', government: 'Государственный объект', culture: 'Культура', religion: 'Архитектура', university: 'Образование', sport: 'Спорт', transport: 'Транспорт', business: 'Деловой центр', park_anchor: 'Парк · опорная точка' };
const el = (tag, attributes = {}, text) => { const node = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attributes)) node.setAttribute(k, v); if (text != null) node.textContent = text; return node; };
const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const linePath = points => points?.length ? `M${points.map(p => p.join(',')).join('L')}` : '';

/** Optional real-geography renderer. Snapshot semantics and intents remain v1. */
export function createAtlasScene({ root, mapData, onIntent = () => {} }) {
  mounts.get(root)?.destroy();
  const map = mapData;
  const city = map.city || {id:'astana',name:'Астана',mapTitle:'Карта Астаны',placesTitle:'Места Астаны',simulation:true};
  const cityName=html(city.name);
  const container = document.createElement('section');
  container.className = 'akim-scene akim-atlas';
  container.innerHTML = `<header class="atlas-header"><div class="atlas-brand"><span>а</span><strong>АКИМ<small>АСТАНА</small></strong></div><div class="atlas-breadcrumb">${html(city.mapTitle)}</div><div class="atlas-header-end"><button data-act="sources" type="button" aria-label="Источники данных">ⓘ</button></div></header>
  <div class="atlas-body"><aside class="atlas-sidebar"><div class="atlas-sidebar-head"><h2>${html(city.placesTitle)}</h2></div>
    <label class="atlas-search"><span>⌕</span><input aria-label="Найти место: ${cityName}" placeholder="Найти место…" autocomplete="off"></label><div class="atlas-search-results" hidden></div>
    <div class="atlas-tabs" role="tablist" aria-label="Содержание карты"><button data-tab="places" role="tab" aria-selected="true">Места</button><button data-tab="roads" role="tab" aria-selected="false">Дороги</button><button data-tab="districts" role="tab" aria-selected="false">Районы</button></div>
    <div class="atlas-sidebar-content"></div></aside>
    <div class="atlas-map-shell"><div class="atlas-map-top"><div class="atlas-map-title"><span class="atlas-pill">${cityName}</span><span>${map.bounds ? ((map.city?.center?.[1] ?? 51.1282).toFixed(4)+'° N &nbsp; '+(map.city?.center?.[0] ?? 71.4304).toFixed(4)+'° E') : ''}</span></div><div class="atlas-projections"><button type="button" data-act="top">Карта</button><button type="button" data-act="tilted">2.5D</button></div></div>
      <div class="atlas-stage" tabindex="0" role="group" aria-label="${html(city.mapTitle)}. Стрелки перемещают камеру, плюс и минус меняют масштаб."><svg class="atlas-svg" aria-label="${html(city.mapTitle)}" role="img"></svg></div>
      <div class="atlas-layer-tools" role="group" aria-label="Слои карты"><button type="button" data-layer="buildings" aria-pressed="true">▥ <span>Здания</span></button><button type="button" data-layer="landmarks" aria-pressed="true">◈ <span>Места</span></button><button type="button" data-layer="traffic" aria-pressed="false">⇄ <span>Нагрузка</span></button></div>
      <div class="atlas-place-card" hidden></div><div class="atlas-camera-tools"><button type="button" data-act="zoom-in" aria-label="Приблизить">+</button><button type="button" data-act="zoom-out" aria-label="Отдалить">−</button><button type="button" data-act="center" aria-label="Центр города">⌾</button><button type="button" data-act="overview" aria-label="Вся территория">⤢</button></div>
      <div class="atlas-compass" aria-hidden="true"><span>С</span>↑</div><div class="atlas-scale"><i></i><span></span></div>
      <div class="atlas-map-credit"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>${city.id === 'astana' ? ' · Геопортал Астаны' : ''} <button data-act="sources" type="button">Источники ↗</button></div>
      <div class="atlas-status-bar"><span class="atlas-mode-status">ГОРОД · ОБЗОР</span><span class="atlas-status-help">Ctrl/⌘ + колесо — масштаб</span><span class="atlas-object-count"></span></div>
    </div></div><div class="atlas-playback"><span class="atlas-feedback" role="status"></span><div><i></i></div><small>Восемь кварталов · визуализация рассчитанного результата</small></div>`;
  root.appendChild(container);
  if (!city.simulation) {
    container.querySelector('[data-tab="districts"]').hidden=true;
    container.querySelector('[data-layer="traffic"]').hidden=true;
  }
  const $ = selector => container.querySelector(selector);
  const stage = $('.atlas-stage'), surface = $('.atlas-svg');
  const ground = el('g', { class: 'atlas-ground' }); surface.appendChild(ground);
  const layers = {};
  for (const name of ['districts', 'parks', 'water', 'road-casing', 'roads', 'buildings', 'traffic', 'intersections']) { layers[name] = el('g', { class: `atlas-layer-${name}` }); ground.appendChild(layers[name]); }
  for (const name of ['vehicles', 'landmarks', 'labels', 'effects', 'mayor']) { layers[name] = el('g', { class: `atlas-layer-${name}` }); surface.appendChild(layers[name]); }
  const camera = createCamera({ viewBox: map.viewBox, width: 1000, height: 700, projection: 'tilted', maxZoom: 40 });
  const features = [...map.landmarks, ...map.parkAnchors.map(p => ({ ...p, category: 'park_anchor' }))];
  const featureMap = new Map(features.map(p => [p.id, p]));
  const enabled = { buildings: true, landmarks: true, traffic: false };
  const listeners = [];
  // Accept the six attributed source polygons without claiming their effective date is verified.
  const sourcedSix = Object.keys(districtNames).every(id => map.regions?.some(r => r.regionId === id && r.status !== 'historical' && r.sourceIds?.includes('astana-municipal-six-districts')));
  const worldRegions = (map.regions || []).filter(r => r.regionId && (r.status === 'verified' || (sourcedSix && r.status !== 'historical' && Object.hasOwn(districtNames, r.regionId) && r.sourceIds?.includes('astana-municipal-six-districts'))));
  const policyNames = {M1:'Автобусы',M2:'Светофоры',M3:'ЛРТ',M4:'Парк',M5:'Топливо',M6:'Озеленение',M7:'Школа',M8:'Медицина',M9:'Спорт',M10:'Освещение',M11:'Переходы',M12:'Обращения',M13:'Сети',M14:'Службы'};
  const policyAnchors = new Map(worldRegions.map(region => [region.regionId, features.filter(f => pointInRegion(f.position, region)).sort((a,b) => distance(a.position,map.center)-distance(b.position,map.center))[0]?.position || region.labelAnchor]));
  const roadNodes = new Map();
  let snapshot = null, context = {}, destroyed = false, frame = null, lastTime = null, frames = 0, totalRenderMs = 0;
  let width = 1000, height = 700, selected = features[0]?.id || null, currentTab = 'places', drag = null, lastProjection = null, currentView = null;
  let movingSeconds = 0, destination = null, mayor = null, walkable = null, selectedCorridor = null, inspectorSignature = '';
  const pressed = new Set();
  const effects = createEffects({ onComplete: (planRevision, runId) => { if (!destroyed) onIntent({ type: 'PLAYBACK_COMPLETE', planRevision, ...(runId === undefined ? {} : { runId }) }); } });
  const listen = (node, type, fn, options) => { node.addEventListener(type, fn, options); listeners.push(() => node.removeEventListener(type, fn, options)); };
  const visible = () => !destroyed && snapshot?.mode === 'game' && context.visible !== false && !document.hidden;
  const detail = () => snapshot?.view === 'district' && snapshot?.focusedRegion === 'nura';

  const buildingIndex = createSpatialIndex(map.buildings || [], regionBounds);
  const roadIndex = createSpatialIndex(map.roads, lineBounds);
  const landscapeIndex = createSpatialIndex(map.landscape || [], regionBounds);
  let renderedBounds = null, renderedProjection = null;
  function refreshGround() {
    const corners = [[0,0],[width,0],[0,height],[width,height]].map(p => camera.unproject(p));
    const minX = Math.min(...corners.map(p => p[0])), maxX = Math.max(...corners.map(p => p[0]));
    const minY = Math.min(...corners.map(p => p[1])), maxY = Math.max(...corners.map(p => p[1]));
    if (renderedProjection === snapshot.projection && renderedBounds && minX >= renderedBounds.minX && maxX <= renderedBounds.maxX && minY >= renderedBounds.minY && maxY <= renderedBounds.maxY && (renderedBounds.maxX-renderedBounds.minX) < (maxX-minX)*3) return;
    const px=(maxX-minX)*.25+4,py=(maxY-minY)*.25+4;
    renderedBounds={minX:minX-px,maxX:maxX+px,minY:minY-py,maxY:maxY+py};
    renderedProjection=snapshot.projection;
    buildGround();
  }
  function buildGround() {
    for (const name of ['districts', 'parks', 'water', 'road-casing', 'roads', 'buildings', 'traffic', 'intersections']) layers[name].replaceChildren();
    for (const region of worldRegions) {
      const path = el('path', { d: polygonsToPath(region), fill: 'none', stroke: '#728c77', 'stroke-width': 1, 'stroke-dasharray': '6 6', 'vector-effect': 'non-scaling-stroke', opacity: .55, 'fill-rule': 'evenodd', 'data-district': region.regionId });
      layers.districts.appendChild(path);
    }
    for (const feature of landscapeIndex.query(renderedBounds)) {
      const water = /water|river|hydro/.test(feature.kind);
      (water ? layers.water : layers.parks).appendChild(el('path', { d: polygonsToPath(feature), fill: water ? '#cfE4e9' : '#e2ebdf', stroke: water ? '#b5d2d9' : '#cddbc9', 'stroke-width': .25, 'fill-rule': 'evenodd', class: water ? 'atlas-water-polygon' : 'atlas-park-polygon' }));
    }
    roadNodes.clear();
    for (const road of roadIndex.query(renderedBounds)) {
      const d = linePath(road.points); if (!d) continue;
      const major = /motorway|trunk|primary/.test(road.kind) || road.importance >= 4;
      layers['road-casing'].appendChild(el('path', { d, fill: 'none', stroke: '#d9dfe1', 'stroke-width': major ? 5 : 3, 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      const path = el('path', { d, fill: 'none', stroke: major ? '#ffffff' : '#ffffff', 'stroke-width': major ? 3.2 : 1.65, 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-road-id': road.id });
      layers.roads.appendChild(path); roadNodes.set(road.id, path);
    }
    // Heights are illustrative; footprints remain the municipal geometry.
    const [a, b, c, d] = snapshot?.projection === 'top' ? [1, 0, 0, 1] : [1, .24, -.35, .65];
    const determinant = a * d - b * c;
    const roofs = [], walls = [];
    for (const building of buildingIndex.query(renderedBounds)) {
      for (const polygon of building.polygons || []) {
        const ring = polygon[0]; if (!ring || ring.length < 4) continue;
        const bounds = regionBounds({ polygons: [polygon] });
        const h = snapshot?.projection === 'top' ? 0 : Math.min(2.8, Math.max(.35, Math.sqrt(bounds.width * bounds.height) * .6));
        const offset = [c * h / determinant, -a * h / determinant];
        let sides = '';
        if (h) for (let i = 1; i < ring.length; i++) {
          const p = ring[i - 1], q = ring[i];
          if (a * (q[0] - p[0]) + c * (q[1] - p[1]) < 0) continue;
          const points = [p, q, [q[0] + offset[0], q[1] + offset[1]], [p[0] + offset[0], p[1] + offset[1]]];
          sides += `${linePath(points)}Z`;
        }
        if (sides) walls.push(sides);
        const roof = { polygons: [polygon.map(r => r.map(p => [p[0] + offset[0], p[1] + offset[1]]))] };
        roofs.push(polygonsToPath(roof));
      }
    }
    // Batch adjacent paths to keep complete geometry without tens of thousands of DOM nodes.
    for (let i=0; i<roofs.length; i+=128) {
      if(walls.length) layers.buildings.appendChild(el('path',{d:walls.slice(i,i+128).join(' '),fill:'#cdd2d3',stroke:'#bbc2c4','stroke-width':.07}));
      layers.buildings.appendChild(el('path',{d:roofs.slice(i,i+128).join(' '),fill:'#edf0f0',stroke:'#cdd3d5','stroke-width':.12,'fill-rule':'evenodd'}));
    }
    const historicalIds = new Set((map.corridors || []).flatMap(corridor => corridor.roadIds || []));
    for (const road of map.roads.filter(r => historicalIds.has(r.id))) layers.traffic.appendChild(el('path', { d: linePath(road.points), fill: 'none', stroke: '#d59451', 'stroke-width': 4, opacity: .65, 'vector-effect': 'non-scaling-stroke' }));
    for (const junction of map.intersections || []) {
      const dot = el('circle', { cx: junction.position[0], cy: junction.position[1], r: .25, fill: '#759583', stroke: '#f8f9e8', 'stroke-width': .09, 'data-junction-id': junction.id });
      dot.appendChild(el('title', {}, `Узел OSM: ${junction.roads.join(' / ')}`)); layers.intersections.appendChild(dot);
    }
    highlightRoads();
    layers.traffic.setAttribute('display', enabled.traffic ? '' : 'none');
    layers.buildings.setAttribute('display', enabled.buildings ? '' : 'none');
  }

  function highlightRoads() {
    const ids = new Set(map.corridors?.find(c => c.id === selectedCorridor)?.roadIds || []);
    for (const [id, path] of roadNodes) path.setAttribute('stroke', ids.has(id) ? '#d28a47' : '#ffffff');
  }
  function showJunction(id) {
    const junction = map.intersections?.find(j => j.id === id); if (!junction) return;
    $('.atlas-place-card').hidden = false;
    $('.atlas-place-card').innerHTML = `<button type="button" data-act="close-card" aria-label="Закрыть">×</button><span class="atlas-eyebrow">УЗЕЛ ДОРОЖНОЙ СЕТИ</span><h3>${html(junction.roads.filter(r => !r.startsWith('osm_way_')).join(' / ') || 'Соединение улиц')}</h3><p>${junction.coordinates.map(n => n.toFixed(5)).join(', ')} · OpenStreetMap</p><p>Общая точка дорожных линий в данных. Это не измерение потока транспорта.</p>`;
  }

  function renderPlaces() {
    layers.landmarks.replaceChildren(); layers.labels.replaceChildren();
    if (!enabled.landmarks) return;
    const items = features.map(feature => ({ feature, point: camera.project(feature.position) }))
      .filter(({ point }) => point[0] > -80 && point[0] < width + 80 && point[1] > -90 && point[1] < height + 100)
      .sort((x, y) => x.point[1] - y.point[1]);
    const labelBoxes = [];
    const sortedLabels = [...items].sort((x, y) => Number(y.feature.id === selected) - Number(x.feature.id === selected) || y.feature.importance - x.feature.importance);
    for (const { feature, point: [x, y] } of items) {
      const active = feature.id === selected;
      const size = Math.min(86, Math.max(30, camera.getState().zoom * 9)) * (active ? 1.2 : 1);
      const group = el('g', { transform: `translate(${x} ${y})`, 'data-feature-id': feature.id, class: `atlas-landmark ${active ? 'is-selected' : ''}`, role: 'button', tabindex: '0', 'aria-label': feature.label });
      group.appendChild(el('title', {}, feature.label));
      if (feature.category === 'city') {
        group.appendChild(el('circle',{r:7,fill:'#292e31',stroke:'#ffffff','stroke-width':3}));
      } else if (feature.category === 'park_anchor') {
        group.appendChild(el('circle', { cy: -6, r: active ? 15 : 10, fill: '#688e69', stroke: '#f5f7e8', 'stroke-width': 2 }));
        group.appendChild(el('path', { d: 'M-5 -5L0 -15L5 -5ZM-6 -1L0 -11L6 -1Z', fill: '#e6efcc' }));
      } else group.appendChild(createLandmarkSymbol(feature.id, { projection: snapshot?.projection || 'tilted', size, selected: active }));
      layers.landmarks.appendChild(group);
    }
    for (const { feature, point: [x, y] } of sortedLabels) {
      const active = feature.id === selected;
      let text = feature.label;
      if (text.length > 24) text = text.slice(0, 23) + '…';
      const box = { x: x - (text.length * 5.6 + 22) / 2, y: y + 8, w: text.length * 5.6 + 22, h: 25 };
      if (!active && (box.x < 4 || box.x + box.w > width - 4 || labelBoxes.some(b => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y))) continue;
      if (!active && camera.getState().zoom < 1.8 && feature.importance < 5) continue;
      labelBoxes.push(box);
      const group = el('g', { 'data-feature-id': feature.id, class: 'atlas-map-label', transform: `translate(${x} ${y + 8})` });
      group.appendChild(el('rect', { x: -box.w / 2, y: 0, width: box.w, height: box.h, rx: 7, fill: active ? '#292e31' : '#ffffff', stroke: active ? '#292e31' : '#e0e4e5', 'stroke-width': .6 }));
      group.appendChild(el('text', { 'text-anchor': 'middle', y: 16, fill: active ? '#ffffff' : '#343a3d', 'font-size': 10, 'font-weight': 650 }, text));
      layers.labels.appendChild(group);
    }
  }

  const vehicleRoads = map.roads.filter(road => road.points?.length > 4 && road.points.length < 200).slice(0, 36);
  const vehicles = vehicleRoads.map((road, i) => {
    let total = 0; const segments = [];
    for (let j = 1; j < road.points.length; j++) { const length = distance(road.points[j - 1], road.points[j]); if (length > 0) { segments.push({ a: road.points[j - 1], b: road.points[j], start: total, length }); total += length; } }
    return { road, segments, total, offset: i * .618 % 1, bus: i % 7 === 0 };
  }).filter(v => v.total > 0);
  function motion() {
    const begin = performance.now();
    layers.vehicles.replaceChildren();
    for (const vehicle of vehicles) {
      const along = ((vehicle.offset + movingSeconds * .0018) % 1) * vehicle.total;
      const segment = vehicle.segments.find(s => s.start + s.length >= along) || vehicle.segments.at(-1);
      const fraction = (along - segment.start) / segment.length;
      const point = segment.a.map((v, i) => v + (segment.b[i] - v) * fraction);
      const [x, y] = camera.project(point); if (x < 0 || x > width || y < 0 || y > height) continue;
      const a = camera.project(segment.a), b = camera.project(segment.b), angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      const group = el('g', { transform: `translate(${x} ${y}) rotate(${angle})` });
      group.appendChild(el('rect', { x: vehicle.bus ? -5 : -3, y: -1.65, width: vehicle.bus ? 10 : 6, height: 3.3, rx: 1, fill: vehicle.bus ? '#ca9f58' : '#738c82', stroke: '#f9f6df', 'stroke-width': .5 }));
      layers.vehicles.appendChild(group);
    }
    layers.mayor.replaceChildren();
    if (detail() && mayor) {
      const [x, y] = camera.project(mayor);
      const g = el('g', { transform: `translate(${x} ${y})` });
      g.appendChild(el('ellipse', { rx: 9, ry: 3, fill: '#1f594638' }));
      g.appendChild(el('path', { d: 'M-5 0L-4-13Q0-17 4-13L5 0Z', fill: '#234b46', stroke: '#fef9df', 'stroke-width': 1 }));
      g.appendChild(el('circle', { cy: -18, r: 4.5, fill: '#ddb999' }));
      g.appendChild(el('text', { y: -28, 'text-anchor': 'middle', fill: '#1e4c3f', stroke: '#fffbec', 'stroke-width': 3, 'paint-order': 'stroke', 'font-size': 9, 'font-weight': 800 }, 'АКИМ'));
      layers.mayor.appendChild(g);
    }
    const state = effects.getState(); layers.effects.replaceChildren();
    const counts = new Map();
    for (const marker of state.markers) {
      const region = worldRegions.find(r => r.regionId === marker.regionId); if (!region) continue;
      const [x, y] = camera.project(policyAnchors.get(region.regionId)), offset = counts.get(marker.regionId) || 0; counts.set(marker.regionId, offset + 1);
      const g = el('g', { transform: `translate(${x + offset * 69} ${y})`, class: `akim-scene-marker akim-scene-marker-${marker.phase}` });
      g.appendChild(el('title', {}, `${districtNames[marker.regionId]} · ${policyNames[marker.measureId]} · условный маркер района, не адрес строительства`));
      g.appendChild(el('rect', { x:-31,y:-27,width:62,height:41,rx:8,fill:marker.phase === 'active' ? '#e4eed2' : '#fff3da',stroke:marker.phase === 'active' ? '#648a58' : '#b99766','stroke-width':1 }));
      g.appendChild(el('text', { y:-10,'text-anchor':'middle','font-size':9,'font-weight':700,fill:'#395939' }, policyNames[marker.measureId]));
      g.appendChild(el('text', { y:2,'text-anchor':'middle','font-size':7,fill:'#7d8869' }, marker.phase === 'active' ? 'ВВЕДЕНО ✓' : marker.phase === 'queued' ? 'В ПЛАНЕ' : 'СТРОИТСЯ'));
      g.appendChild(el('rect', { x:-23,y:7,width:46*marker.progress,height:2,rx:1,fill:'#789965' })); layers.effects.appendChild(g);
    }
    if ($('.atlas-feedback').textContent !== state.feedback) $('.atlas-feedback').textContent = state.feedback;
    if (state.status === 'complete' && state.reactions.length) {
      const negative = state.reactions.some(r => r.tone === 'negative');
      const positive = state.reactions.some(r => r.tone === 'positive');
      const label = negative ? positive ? '↑↓ Есть улучшения и ухудшения' : '↓ Есть ухудшения' : '↑ Изменения показаны в результате';
      const group = el('g', { transform: `translate(${width / 2} ${height - 58})`, class: 'atlas-final-reaction' });
      group.appendChild(el('rect', { x: -125, y: -18, width: 250, height: 29, rx: 14, fill: negative ? '#f2debc' : '#e9f0d7' }));
      group.appendChild(el('text', { 'text-anchor': 'middle', y: 1, fill: '#476243', 'font-size': 11 }, label));
      layers.effects.appendChild(group);
    }
    $('.atlas-playback > div > i').style.width = `${state.progress * 100}%`;
    container.classList.toggle('has-plan', state.markers.length > 0 || state.status !== 'idle');
    frames++; totalRenderMs += performance.now() - begin;
  }

  function render() {
    if (destroyed || !snapshot) return;
    refreshGround();
    ground.setAttribute('transform', `matrix(${camera.matrix().join(' ')})`);
    layers.intersections.setAttribute('display', camera.getState().zoom >= 5 ? '' : 'none');
    renderPlaces(); motion();
    const pixelsPerWorld = camera.getState().scale;
    const worldPerKm = 1000 / ((map.bounds[2] - map.bounds[0]) * 111.32 * Math.cos(((map.bounds[1] + map.bounds[3]) / 2) * Math.PI / 180));
    const meters = 90 / (pixelsPerWorld * worldPerKm) * 1000;
    $('.atlas-scale span').textContent = meters >= 1000 ? `${(meters / 1000).toFixed(1)} км` : `${Math.round(meters / 50) * 50} м`;
  }
  function focusCenter() { camera.reset(); camera.focus([map.center[0] - 150, map.center[1] - 110, 300, 220]); render(); }
  function focusFeature(id) {
    const feature = featureMap.get(id); if (!feature) return;
    selected = id; selectedCorridor = null; highlightRoads(); camera.focus([feature.position[0] - 68, feature.position[1] - 54, 136, 108]);
    renderInspector(); render();
  }
  function renderInspector(force = false) {
    for (const tab of container.querySelectorAll('[data-tab]')) tab.setAttribute('aria-selected', String(tab.dataset.tab === currentTab));
    const signature = `${currentTab}|${selected}|${snapshot?.focusedRegion}|${selectedCorridor}|${detail()}`;
    if (!force && signature === inspectorSignature) return; inspectorSignature = signature;
    const regionStatus = worldRegions.length === 6 ? 'Шесть контуров городского GIS. Дата действия границ источником не указана.' : 'Актуальные границы шести районов ещё не подтверждены';
    if (currentTab === 'places') {
      const feature = featureMap.get(selected) || features[0];
      $('.atlas-sidebar-content').innerHTML = `<div class="atlas-feature-info"><h2>${html(feature.label)}</h2><button type="button" class="atlas-primary" data-place="${feature.id}">На карте <span>↗</span></button></div>
      <div class="atlas-list-heading" ${features.length <= 1 ? 'hidden' : ''}>ДРУГИЕ МЕСТА <span>${Math.max(0,features.length - 1)}</span></div><div class="atlas-place-list">${features.filter(f => f.id !== feature.id).map(f => `<button data-place="${f.id}" type="button"><i>${f.category === 'park_anchor' ? '♧' : '◈'}</i><span>${html(f.label)}<small>${html(kindNames[f.category] || 'Место города')}</small></span><b>↗</b></button>`).join('')}</div>`;
    } else if (currentTab === 'roads') {
      $('.atlas-sidebar-content').innerHTML = `<div class="atlas-feature-info"><span class="atlas-eyebrow">ГОРОДСКОЙ КАРКАС</span><h2>${map.roads.length.toLocaleString('ru-RU')} сегментов</h2><p>Геометрия улиц — OpenStreetMap. Движущиеся машины — условная анимация.</p><div class="atlas-data-note">АРХИВНОЕ ИССЛЕДОВАНИЕ<br><span>Нагрузка ниже — исторический показатель, не пробки сейчас. Подсвечивается вся сопоставленная улица; границы отрезка не подтверждены.</span></div></div><div class="atlas-corridor-list">${(map.corridors || []).map((corridor, index) => `<button type="button" data-corridor="${html(corridor.id)}" aria-pressed="${selectedCorridor === corridor.id}"><span class="atlas-rank">${String(index + 1).padStart(2, '0')}</span><span>${html(corridor.road || corridor.name)}<small>${html(corridor.from)} → ${html(corridor.to)}</small><i style="--load:${Math.min(1, corridor.importance_0_1 || corridor.importance || 0) * 100}%"></i></span><b>${Math.round((corridor.importance_0_1 || corridor.importance || 0) * 100)}</b></button>`).join('')}</div>`;
    } else {
      $('.atlas-sidebar-content').innerHTML = `<div class="atlas-feature-info"><span class="atlas-eyebrow">ШЕСТЬ РАЙОНОВ</span><h2>Районы Астаны</h2><p>Сарайшық — только для просмотра.</p><div class="atlas-data-note">${html(regionStatus)}</div></div><div class="atlas-district-list">${Object.entries(districtNames).map(([id, label], index) => `<button type="button" data-district-id="${id}" aria-pressed="${snapshot?.focusedRegion === id}"><span>${String(index + 1).padStart(2, '0')}</span><b>${label}<small>${id === 'saraishyk' ? 'Вне расчёта' : id === 'nura' ? 'Прогулка акима' : 'В расчёте'}</small></b><i>↗</i></button>`).join('')}</div><div class="atlas-feature-info"><button type="button" class="atlas-primary" data-act="walk">Прогулка акима по Нуре ↗</button><p class="atlas-walk-note">${walkable ? 'Маршрут декоративный; движение не меняет решения, бюджет и результат.' : 'Для прогулки нужна актуальная граница Нуры. На точной карте она не заменяется выдуманным полигоном.'}</p></div>`;
    }
  }

  function sources() {
    $('.atlas-place-card').hidden = false;
    $('.atlas-place-card').innerHTML = `<button type="button" data-act="close-card" aria-label="Закрыть">×</button><span class="atlas-eyebrow">О КАРТЕ</span><h3>География с источником</h3><p>${map.roads.length.toLocaleString('ru-RU')} дорожных сегментов · ${(map.buildings || []).length.toLocaleString('ru-RU')} контуров зданий · ${map.landmarks.length} достопримечательностей · ${map.parkAnchors.length} опорных точек парков.</p><p>${city.id === 'astana' ? 'Координаты достопримечательностей — из набора проекта; пять точек уточнены по OpenStreetMap.' : 'Центр города — именованный объект OpenStreetMap.'} Дороги, здания, вода и озеленение — OpenStreetMap.${city.id === 'astana' ? ' Границы районов — муниципальный геопортал Астаны.' : ''} Высота домов и движение транспорта иллюстративны. Численность населения и работа транспорта здесь не измеряются.</p><p>Историческая нагрузка не является текущим трафиком. Здания, улицы и зелёные зоны получены из OpenStreetMap в пределах карты города без ограничения количества. Полнота зависит от покрытия источника.</p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap · ODbL ↗</a>${city.id === 'astana' ? '<br><a href="https://gis.esaulet.kz/server/rest/services/dop_sloi_geoportal_otkr/MapServer" target="_blank" rel="noopener noreferrer">Геопортал Астаны ↗</a>' : ''}`;
  }

  function setupWalkable() {
    const nura = worldRegions.find(r => r.regionId === 'nura'); if (!nura) return;
    const exclusions = [...(map.buildings || []), ...(map.landscape || []).filter(f => /water|river|hydro/.test(f.kind))];
    const candidates = [...map.parkAnchors, ...map.landmarks].filter(f => pointInRegion(f.position, nura)).map(f => f.position);
    candidates.push(nura.labelAnchor);
    let start = null;
    for (const candidate of candidates) { for (let i = 0; i < 40; i++) { const p = [candidate[0] + Math.cos(i * 2.4) * i * .35, candidate[1] + Math.sin(i * 2.4) * i * .35]; if (pointInRegion(p, nura) && !exclusions.some(f => pointInRegion(p, f))) { start = p; break; } } if (start) break; }
    if (!start) return;
    const localExclusions = exclusions.filter(f => { const b = regionBounds(f); return b && b.maxX > start[0] - 22 && b.minX < start[0] + 22 && b.maxY > start[1] - 22 && b.minY < start[1] + 22; });
    walkable = { start, contains: p => Math.abs(p[0] - start[0]) <= 20 && Math.abs(p[1] - start[1]) <= 20 && pointInRegion(p, nura) && !localExclusions.some(f => pointInRegion(p, f)) };
    const rings = [nura, ...localExclusions].flatMap(shape => shape.polygons.flat());
    walkable.canTraverse = (from, to) => walkable.contains(from) && walkable.contains(to) && !rings.some(ring => ring.some((p, i) => i > 0 && segmentsCross(from, to, ring[i - 1], p)));
    mayor = [...start];
  }
  setupWalkable();
  function moveMayor(target, maximum) {
    if (!walkable || !mayor) return;
    const length = distance(mayor, target); if (!length) return;
    const travel = Math.min(length, maximum), from = [...mayor], count = Math.ceil(travel / .025);
    for (let i = 1; i <= count; i++) { const p = from.map((v, axis) => v + (target[axis] - v) / length * travel * i / count); if (!walkable.canTraverse(mayor, p)) { destination = null; break; } mayor = p; }
    if (distance(mayor, target) < .01) destination = null;
  }
  function resize() { const rect = stage.getBoundingClientRect(); if (!rect.width || !rect.height) return; width = rect.width; height = rect.height; surface.setAttribute('viewBox', `0 0 ${width} ${height}`); camera.setViewport(width, height); render(); }
  function stop() { if (frame !== null) cancelAnimationFrame(frame); frame = null; lastTime = null; }
  function schedule() { if (visible() && (!context.reducedMotion || pressed.size) && frame === null) frame = requestAnimationFrame(tick); }
  function tick(time) { frame = null; if (!visible()) return; if (lastTime === null) lastTime = time; const dt = Math.min(.1, (time - lastTime) / 1000); if (dt >= 1 / 30) { lastTime = time; if (!context.reducedMotion) movingSeconds += dt;
    if (detail() && mayor) { const dx = Number(pressed.has('ArrowRight') || pressed.has('d')) - Number(pressed.has('ArrowLeft') || pressed.has('a')); const dy = Number(pressed.has('ArrowDown') || pressed.has('s')) - Number(pressed.has('ArrowUp') || pressed.has('w')); if (dx || dy) moveMayor([mayor[0] + dx, mayor[1] + dy], dt * 1.5); else if (destination && !context.reducedMotion) moveMayor(destination, dt * 1.5); }
    effects.step(dt); if (!destroyed) motion(); } schedule(); }

  function action(command) {
    if (command === 'top' || command === 'tilted') onIntent({ type: 'SET_PROJECTION', projection: command });
    if (command === 'zoom-in' || command === 'zoom-out') { camera.zoomAt(command === 'zoom-in' ? 1.4 : 1 / 1.4, [width / 2, height / 2]); render(); }
    if (command === 'center') focusCenter();
    if (command === 'overview') { onIntent({ type: 'SET_VIEW', view: 'overview' }); camera.reset(); render(); }
    if (command === 'sources') sources();
    if (command === 'close-card') $('.atlas-place-card').hidden = true;
    if (command === 'walk' && walkable) { onIntent({ type: 'FOCUS_REGION', regionId: 'nura' }); onIntent({ type: 'SET_VIEW', view: 'district' }); }
  }
  listen(container, 'click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.act) action(button.dataset.act);
    if (button.dataset.place) { currentTab = 'places'; focusFeature(button.dataset.place); $('.atlas-search-results').hidden = true; }
    if (button.dataset.tab) { currentTab = button.dataset.tab; renderInspector(); }
    if (button.dataset.layer) { const name = button.dataset.layer; enabled[name] = !enabled[name]; button.setAttribute('aria-pressed', String(enabled[name])); if (name === 'landmarks') renderPlaces(); else layers[name].setAttribute('display', enabled[name] ? '' : 'none'); }
    if (button.dataset.districtId) { const id = button.dataset.districtId; onIntent({ type: 'FOCUS_REGION', regionId: id }); const region = worldRegions.find(r => r.regionId === id); if (region) { camera.focus(regionBounds(region)); render(); } renderInspector(); }
    if (button.dataset.corridor) {
      selectedCorridor = button.dataset.corridor; const corridor = map.corridors.find(c => c.id === selectedCorridor);
      const roads = map.roads.filter(r => corridor.roadIds?.includes(r.id));
      highlightRoads();
      if (roads.length) camera.focus(regionBounds({ polygons: roads.map(r => [r.points]) }));
      renderInspector(); render();
    }
    for (const tab of container.querySelectorAll('[data-tab]')) tab.setAttribute('aria-selected', String(tab.dataset.tab === currentTab));
  });
  listen($('.atlas-search input'), 'input', event => {
    const query = event.target.value.trim().toLocaleLowerCase('ru');
    const matches = query ? features.filter(f => f.label.toLocaleLowerCase('ru').includes(query)).slice(0, 8) : [];
    $('.atlas-search-results').hidden = !query;
    $('.atlas-search-results').innerHTML = matches.length ? matches.map(f => `<button data-place="${f.id}" type="button">${html(f.label)} ↗</button>`).join('') : '<span>Ничего не найдено</span>';
  });
  const point = event => { const box = stage.getBoundingClientRect(); return [event.clientX - box.left, event.clientY - box.top]; };
  listen(stage, 'pointerdown', event => { if (!visible() || event.button !== 0) return; const p = point(event); drag = { id: event.pointerId, start: p, last: p, moved: false, featureId: event.target.closest('[data-feature-id]')?.dataset.featureId, junctionId: event.target.closest('[data-junction-id]')?.dataset.junctionId }; stage.setPointerCapture?.(event.pointerId); stage.focus({ preventScroll: true }); });
  listen(stage, 'pointermove', event => { if (!visible() || !drag || drag.id !== event.pointerId) return; const p = point(event); if (distance(p, drag.start) > 6) drag.moved = true; if (drag.moved) { camera.pan(p[0] - drag.last[0], p[1] - drag.last[1]); render(); } drag.last = p; });
  listen(stage, 'pointerup', event => { if (!visible() || !drag || drag.id !== event.pointerId) return; const last = drag; drag = null; if (stage.hasPointerCapture?.(event.pointerId)) stage.releasePointerCapture(event.pointerId); if (last.moved) return;
    if (last.featureId) { selected = last.featureId; currentTab = 'places'; renderInspector(); render(); }
    else if (last.junctionId) showJunction(last.junctionId);
    else if (detail() && walkable) { const p = camera.unproject(point(event)); if (walkable.contains(p)) { destination = p; if (context.reducedMotion) moveMayor(p, distance(mayor, p)); motion(); } }
    else { const p = camera.unproject(point(event)), region = worldRegions.find(r => pointInRegion(p, r)); if (region) onIntent({ type: 'FOCUS_REGION', regionId: region.regionId }); }
  });
  listen(stage, 'pointercancel', () => { drag = null; });
  listen(stage, 'wheel', event => { if (!visible() || (!event.ctrlKey && !event.metaKey)) return; event.preventDefault(); camera.zoomAt(Math.exp(-event.deltaY * .003), point(event)); render(); }, { passive: false });
  listen(stage, 'keydown', event => {
    const featureId = event.target.closest('[data-feature-id]')?.dataset.featureId;
    if (featureId && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); focusFeature(featureId); stage.focus({ preventScroll: true }); return; }
    if (event.target !== stage || !visible() || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] }[key];
    if (direction) { event.preventDefault(); if (detail() && mayor && !event.shiftKey) { if (!pressed.has(key)) moveMayor([mayor[0] + direction[0], mayor[1] + direction[1]], .06); pressed.add(key); motion(); schedule(); } else { camera.pan(-direction[0] * 45, -direction[1] * 45); render(); } }
    else if (key === '+' || key === '=') { event.preventDefault(); action('zoom-in'); } else if (key === '-') { event.preventDefault(); action('zoom-out'); } else if (key === 'Home') { event.preventDefault(); focusCenter(); }
  });
  listen(stage, 'keyup', event => pressed.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
  listen(stage, 'blur', () => pressed.clear());
  listen(document, 'visibilitychange', () => { pressed.clear(); if (drag && stage.hasPointerCapture?.(drag.id)) stage.releasePointerCapture(drag.id); drag = null; if (snapshot) effects.update({ snapshot, reducedMotion: context.reducedMotion, visible: visible() }); stop(); schedule(); });
  const observer = new ResizeObserver(resize); observer.observe(stage);
  const api = {
    update({ snapshot: next, context: nextContext = {} }) {
      if (destroyed) return; if (next?.contractVersion !== 1) throw new TypeError('Scene contract v1 required.');
      snapshot = next; context = nextContext;
      if (!visible()) { pressed.clear(); if (drag && stage.hasPointerCapture?.(drag.id)) stage.releasePointerCapture(drag.id); drag = null; stop(); }
      if (lastProjection !== snapshot.projection) { camera.setProjection(snapshot.projection); renderedBounds = null; lastProjection = snapshot.projection; }
      const view = detail() ? 'district' : 'overview';
      if (currentView !== view) { pressed.clear(); if (detail() && walkable) camera.focus([walkable.start[0] - 23, walkable.start[1] - 18, 46, 36]); else if (currentView === null || currentView === 'district') focusCenter(); currentView = view; }
      for (const button of container.querySelectorAll('[data-act="top"], [data-act="tilted"]')) button.setAttribute('aria-pressed', String(button.dataset.act === snapshot.projection));
      $('.atlas-mode-status').textContent = detail() && walkable ? 'НУРА · ПРОГУЛКА АКИМА' : city.name.toLocaleUpperCase('ru');
      $('.atlas-status-help').textContent = detail() && walkable ? 'WASD / стрелки — идти · Shift + стрелки — камера' : 'Перетаскивай карту · Ctrl/⌘ + колесо — масштаб';
      $('.atlas-object-count').textContent = `${map.landmarks.length} мест · ${map.roads.length.toLocaleString('ru-RU')} дорог`;
      effects.update({ snapshot, reducedMotion: !!context.reducedMotion, visible: visible() });
      renderInspector(); resize(); if (context.reducedMotion && !pressed.size) stop(); else schedule();
    },
    destroy() { if (destroyed) return; destroyed = true; stop(); pressed.clear(); if (drag && stage.hasPointerCapture?.(drag.id)) stage.releasePointerCapture(drag.id); drag = null; listeners.forEach(fn => fn()); observer.disconnect(); effects.destroy(); container.remove(); if (mounts.get(root) === api) mounts.delete(root); },
    getDiagnostics() { return { frames, averageMotionRenderMs: frames ? totalRenderMs / frames : 0, actorCount: vehicles.length, visible: visible(), running: frame !== null, destroyed, camera: camera.getState(), mayor: mayor ? [...mayor] : null, selected, effects: effects.getState(), data: { roads: map.roads.length, buildings: (map.buildings || []).length, landmarks: map.landmarks.length, regions: worldRegions.length }, missingAssetIds: [] }; },
  };
  mounts.set(root, api);
  return api;
}
