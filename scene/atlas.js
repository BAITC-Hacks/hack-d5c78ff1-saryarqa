import { createCamera, pointInRegion, regionBounds, polygonsToPath, segmentsCross } from './camera.js';
import { createLandmarkSymbol } from './landmarks.js';
import { createEffects } from './effects.js';
import { actorArt, policyArt, worldArt, effectArt } from '../game/art.js';
import { deriveMapVisualState } from './map-visual-state.js';
import { createMapLife } from './map-life.js';
import { createMapFeedback } from './map-feedback.js';

const NS = 'http://www.w3.org/2000/svg';
const mounts = new WeakMap();
const districtNames = { esil: 'Есиль', almaty: 'Алматы', saryarka: 'Сарыарка', baikonur: 'Байконур', nura: 'Нура', saraishyk: 'Сарайшық' };
const kindNames = { landmark: 'Достопримечательность', government: 'Государственный объект', culture: 'Культура', religion: 'Архитектура', university: 'Образование', sport: 'Спорт', transport: 'Транспорт', business: 'Деловой центр', park_anchor: 'Парк · опорная точка' };
const el = (tag, attributes = {}, text) => { const node = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attributes)) node.setAttribute(k, v); if (text != null) node.textContent = text; return node; };
const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeLink = value => /^https?:\/\//.test(value || '') ? value : null;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const linePath = points => points?.length ? `M${points.map(p => p.join(',')).join('L')}` : '';

/** Optional real-geography renderer. Snapshot semantics and intents remain v1. */
export function createAtlasScene({ root, mapData, onIntent = () => {} }) {
  mounts.get(root)?.destroy();
  const map = mapData;
  const container = document.createElement('section');
  container.className = 'akim-scene akim-atlas';
  container.innerHTML = `<div class="atlas-map-shell">
    <div class="atlas-toolbar" role="toolbar" aria-label="Управление картой">
      <div class="atlas-projections"><button type="button" data-act="top">Сверху</button><button type="button" data-act="tilted">Объём</button></div>
      <button type="button" data-act="walk" class="atlas-walk">Гулять по Нуре</button>
      <details class="atlas-layer-menu"><summary>Слои</summary><div class="atlas-layer-tools"><button type="button" data-layer="buildings" aria-pressed="true">Здания</button><button type="button" data-layer="landmarks" aria-pressed="true">Места</button><button type="button" data-layer="traffic" aria-pressed="false">Нагрузка</button></div></details>
      <button data-act="sources" type="button" aria-label="Источники карты" class="atlas-info">i</button>
    </div>
    <div class="atlas-stage" tabindex="0" role="group" aria-label="Карта Астаны. Стрелки перемещают камеру. В Нуре стрелки или WASD перемещают акима."><svg class="atlas-svg" aria-label="Карта районов Астаны" role="img"></svg></div>
    <div class="atlas-place-card" hidden></div>
    <div class="atlas-camera-tools" role="group" aria-label="Масштаб карты"><button type="button" data-act="zoom-in" aria-label="Приблизить">+</button><button type="button" data-act="zoom-out" aria-label="Отдалить">−</button><button type="button" data-act="overview" aria-label="Весь город">⌂</button></div>
    <div class="atlas-scale"><i></i><span></span></div>
    <div class="atlas-map-credit"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a> · Геопортал Астаны</div>
    <div class="atlas-status-bar"><span class="atlas-mode-status"></span><span class="atlas-status-help"></span></div>
    </div><div class="atlas-playback"><span class="atlas-feedback" role="status"></span><div><i></i></div></div>`;
  root.appendChild(container);
  const $ = selector => container.querySelector(selector);
  const stage = $('.atlas-stage'), surface = $('.atlas-svg');
  const ground = el('g', { class: 'atlas-ground' }); surface.appendChild(ground);
  const layers = {};
  for (const name of ['districts', 'parks', 'water', 'road-casing', 'roads', 'buildings', 'traffic', 'intersections']) { layers[name] = el('g', { class: `atlas-layer-${name}` }); ground.appendChild(layers[name]); }
  for (const name of ['decoration', 'vehicles', 'landmarks', 'citizens', 'labels', 'policy-world', 'effects', 'mayor']) { layers[name] = el('g', { class: `atlas-layer-${name}` }); surface.appendChild(layers[name]); }
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
  const mapLife = createMapLife({ layer: layers.citizens, map, regions: worldRegions });
  const mapFeedback = createMapFeedback({ layer: layers['policy-world'], regions: worldRegions, anchors: policyAnchors });
  const roadNodes = new Map();
  let snapshot = null, context = {}, destroyed = false, frame = null, lastTime = null, frames = 0, totalRenderMs = 0;
  let width = 1000, height = 700, selected = null, drag = null, lastProjection = null, currentView = null;
  let movingSeconds = 0, destination = null, mayor = null, walkable = null, selectedCorridor = null, inspectorSignature = '';
  const pressed = new Set();
  const effects = createEffects({ onComplete: (planRevision, runId) => { if (!destroyed) onIntent({ type: 'PLAYBACK_COMPLETE', planRevision, ...(runId === undefined ? {} : { runId }) }); } });
  const listen = (node, type, fn, options) => { node.addEventListener(type, fn, options); listeners.push(() => node.removeEventListener(type, fn, options)); };
  const visible = () => !destroyed && snapshot?.mode === 'game' && context.visible !== false && !document.hidden;
  const detail = () => snapshot?.view === 'district' && snapshot?.focusedRegion === 'nura';
  const sourceName = 'Муниципальный геопортал Астаны';

  function buildGround() {
    for (const name of ['districts', 'parks', 'water', 'road-casing', 'roads', 'buildings', 'traffic', 'intersections']) layers[name].replaceChildren();
    for (const region of worldRegions) {
      const path = el('path', { d: polygonsToPath(region), fill: 'none', stroke: '#728c77', 'stroke-width': 1, 'stroke-dasharray': '6 6', 'vector-effect': 'non-scaling-stroke', opacity: .55, 'fill-rule': 'evenodd', 'data-district': region.regionId });
      layers.districts.appendChild(path);
    }
    for (const feature of map.landscape || []) {
      const water = /water|river|hydro/.test(feature.kind);
      (water ? layers.water : layers.parks).appendChild(el('path', { d: polygonsToPath(feature), fill: water ? '#a4c8ce' : '#b8cbb2', stroke: water ? '#85b4bf' : '#a6be9e', 'stroke-width': .25, 'fill-rule': 'evenodd', class: water ? 'atlas-water-polygon' : 'atlas-park-polygon' }));
    }
    roadNodes.clear();
    for (const road of map.roads) {
      const d = linePath(road.points); if (!d) continue;
      const major = /motorway|trunk|primary/.test(road.kind) || road.importance >= 4;
      layers['road-casing'].appendChild(el('path', { d, fill: 'none', stroke: '#c0c5b5', 'stroke-width': major ? 5 : 3, 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      const path = el('path', { d, fill: 'none', stroke: major ? '#fff9e8' : '#f8f5e9', 'stroke-width': major ? 3.2 : 1.65, 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-road-id': road.id });
      layers.roads.appendChild(path); roadNodes.set(road.id, path);
    }
    // Heights are illustrative; footprints remain the municipal geometry.
    const [a, b, c, d] = snapshot?.projection === 'top' ? [1, 0, 0, 1] : [1, .24, -.35, .65];
    const determinant = a * d - b * c;
    for (const building of (map.buildings || []).slice(0, 2600)) {
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
        if (sides) layers.buildings.appendChild(el('path', { d: sides, fill: '#b9b9a4', stroke: '#aaa994', 'stroke-width': .07 }));
        const roof = { polygons: [polygon.map(r => r.map(p => [p[0] + offset[0], p[1] + offset[1]]))] };
        layers.buildings.appendChild(el('path', { d: polygonsToPath(roof), fill: '#e6e4d3', stroke: '#b9bcaa', 'stroke-width': .12, 'fill-rule': 'evenodd' }));
      }
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
    for (const [id, path] of roadNodes) path.setAttribute('stroke', ids.has(id) ? '#d28a47' : '#fff9e8');
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
      if (feature.category === 'park_anchor') {
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
      group.appendChild(el('rect', { x: -box.w / 2, y: 0, width: box.w, height: box.h, rx: 7, fill: active ? '#203e39' : '#fffff1ed', stroke: active ? '#203e39' : '#ccd2bd', 'stroke-width': .6 }));
      group.appendChild(el('text', { 'text-anchor': 'middle', y: 16, fill: active ? '#fffbea' : '#385a4b', 'font-size': 10, 'font-weight': 650 }, text));
      layers.labels.appendChild(group);
    }
  }

  const vehicleRoads = map.roads.filter(road => road.points?.length > 4 && road.points.length < 200).slice(0, 36);
  const vehicles = vehicleRoads.map((road, i) => {
    let total = 0; const segments = [];
    for (let j = 1; j < road.points.length; j++) { const length = distance(road.points[j - 1], road.points[j]); if (length > 0) { segments.push({ a: road.points[j - 1], b: road.points[j], start: total, length }); total += length; } }
    return { road, segments, total, offset: i * .618 % 1, bus: i % 7 === 0 };
  }).filter(v => v.total > 0);
  // Every moving image keeps its DOM identity. Change href only when a direction
  // or projection changes; camera/motion updates merely change transforms.
  const artNodes = new Map();
  const missingArt = new Set();
  function drawArt(key, layer, art, position, size, label, extra = {}) {
    if (!art) { missingArt.add(key); return null; }
    let item = artNodes.get(key);
    if (!item) {
      const node = el('g', { 'data-art-id': key, 'aria-label': label });
      node.appendChild(el('title', {}, label));
      const image = el('image', { preserveAspectRatio: 'xMidYMid meet' });
      node.appendChild(image); layer.appendChild(node);
      item = { node, image, href: null }; artNodes.set(key, item);
    }
    if (item.href !== art.href) { item.image.setAttribute('href', art.href); item.href = art.href; }
    const scale = size / Math.max(art.width, art.height);
    item.image.setAttribute('x', -art.anchor[0] * scale);
    item.image.setAttribute('y', -art.anchor[1] * scale);
    item.image.setAttribute('width', art.width * scale);
    item.image.setAttribute('height', art.height * scale);
    item.node.setAttribute('transform', `translate(${position[0]} ${position[1]})`);
    item.node.setAttribute('display', '');
    item.node.setAttribute('opacity', extra.opacity ?? 1);
    return item.node;
  }
  const decorationKinds = ['building.home','tree-01','bench','building.apartment','tree-02','shrub-01','streetlight','building.civic','tree-03','park','shrub-02','sidewalk'];
  let liveArt = new Set();
  const art = (...args) => { const node = drawArt(...args); if (node) liveArt.add(args[0]); return node; };
  function motion() {
    const begin = performance.now(); liveArt = new Set();
    const projection = snapshot?.projection || 'top';
    const state = effects.getState();
    const visualState = deriveMapVisualState({ snapshot, effectState: state, regionIds: worldRegions.map(region => region.regionId) });
    const animation = { camera, width, height, seconds: movingSeconds, reducedMotion: !!context.reducedMotion, visualState, projection };
    mapLife.render(animation); mapFeedback.render(animation);
    for (const [index, vehicle] of vehicles.entries()) {
      const along = ((vehicle.offset + movingSeconds * .0018) % 1) * vehicle.total;
      const segment = vehicle.segments.find(s => s.start + s.length >= along) || vehicle.segments.at(-1);
      const fraction = (along - segment.start) / segment.length;
      const point = segment.a.map((v, i) => v + (segment.b[i] - v) * fraction);
      const position = camera.project(point); if (position[0] < -30 || position[0] > width + 30 || position[1] < -30 || position[1] > height + 30) continue;
      const a = camera.project(segment.a), b = camera.project(segment.b);
      const heading = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      const kind = vehicle.bus ? 'bus' : index % 11 === 0 && snapshot?.plan.some(p => p.id === 'M14') ? 'service' : 'car';
      art(`vehicle-${index}`, layers.vehicles, actorArt(kind, projection, heading), position, detail() ? 33 : 19, kind === 'bus' ? 'Условный автобус' : 'Условный транспорт');
    }
    if (detail() && walkable && mayor) {
      // Decorative pieces are visibly stylized game art, never surveyed footprints.
      for (const [index, kind] of decorationKinds.entries()) {
        const angle = index * 2.399, radius = 7 + index % 3 * 3;
        const p = [walkable.start[0] + Math.cos(angle) * radius, walkable.start[1] + Math.sin(angle) * radius];
        if (!walkable.contains(p)) continue;
        art(`decor-${index}`, layers.decoration, worldArt(kind, projection), camera.project(p), kind.startsWith('building') ? 66 : 44, 'Игровая декорация: не фактический объект');
      }
      art('mayor', layers.mayor, actorArt('mayor', projection), camera.project(mayor), 52, 'Аким');
      if (state.markers.some(m => m.measureId === 'M3' && m.regionId === 'nura')) {
        const p = [walkable.start[0] - 5 + (context.reducedMotion ? 0 : Math.sin(movingSeconds * .18) * 2), walkable.start[1] + 8];
        art('planned-lrt', layers.vehicles, actorArt('lrt', projection, 0), camera.project(p), 68, 'Сценарный LRT: условная иллюстрация решения');
      }
    }
    const counts = new Map();
    for (const marker of state.markers) {
      const region = worldRegions.find(r => r.regionId === marker.regionId); if (!region || (detail() && marker.regionId !== 'nura')) continue;
      const anchor = detail() && marker.regionId === 'nura' && walkable ? walkable.start : policyAnchors.get(region.regionId);
      const [x, y] = camera.project(anchor), offset = counts.get(marker.regionId) || 0; counts.set(marker.regionId, offset + 1);
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;
      const position = [Math.min(width - 38, Math.max(38, x + (offset - 1) * 62)), Math.min(height - 90, Math.max(108, y - 55))];
      const node = art(`policy-${marker.id}`, layers.effects, policyArt(marker.measureId, 'marker'), position, detail() ? 42 : 38,
        `${districtNames[marker.regionId]}: ${policyNames[marker.measureId]} — ${marker.phase === 'active' ? 'реализовано' : 'в плане'}`, { opacity: marker.phase === 'queued' ? .65 : 1 });
      if (node) node.setAttribute('class', `akim-scene-marker akim-scene-marker-${marker.phase}`);
      if (marker.phase === 'construction') art(`build-${marker.id}`, layers.effects, effectArt('placement-pulse'), [position[0], position[1] + 12], 32, 'Реализация решения');
    }
    for (const [key, item] of artNodes) if (!liveArt.has(key)) item.node.setAttribute('display', 'none');
    const feedback = state.status === 'complete' ? 'Готово' : state.markers.length ? state.status === 'idle' ? 'План на карте' : 'Реализуем решения…' : '';
    if ($('.atlas-feedback').textContent !== feedback) $('.atlas-feedback').textContent = feedback;
    $('.atlas-playback > div > i').style.width = `${state.progress * 100}%`;
    container.classList.toggle('has-plan', state.markers.length > 0 || state.status !== 'idle');
    frames++; totalRenderMs += performance.now() - begin;
  }

  function render() {
    if (destroyed || !snapshot) return;
    ground.setAttribute('transform', `matrix(${camera.matrix().join(' ')})`);
    layers.intersections.setAttribute('display', camera.getState().zoom >= 5 ? '' : 'none');
    for (const path of layers.districts.children) { const selectedRegion = path.getAttribute('data-district') === snapshot.focusedRegion; path.setAttribute('fill', selectedRegion ? '#dfbd7030' : 'none'); path.setAttribute('stroke', selectedRegion ? '#aa8040' : '#728c77'); path.setAttribute('opacity', selectedRegion ? 1 : .55); }
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
    const signature = `${selected}|${snapshot?.focusedRegion}|${detail()}`;
    if (!force && signature === inspectorSignature) return; inspectorSignature = signature;
    if (!selected) return;
    const feature = featureMap.get(selected); if (!feature) return;
    const source = safeLink(feature.sourceUrl);
    $('.atlas-place-card').hidden = false;
    $('.atlas-place-card').innerHTML = `<button type="button" data-act="close-card" aria-label="Закрыть">×</button><span class="atlas-eyebrow">${html(kindNames[feature.category] || 'Место')}</span><h3>${html(feature.label)}</h3><button type="button" data-place="${html(feature.id)}">Приблизить</button>${source ? `<a href="${html(source)}" target="_blank" rel="noopener noreferrer">Источник</a>` : ''}`;
  }

  function sources() {
    $('.atlas-place-card').hidden = false;
    $('.atlas-place-card').innerHTML = `<button type="button" data-act="close-card" aria-label="Закрыть">×</button><span class="atlas-eyebrow">О КАРТЕ</span><h3>Источники карты</h3><p>${map.roads.length.toLocaleString('ru-RU')} дорожных сегментов · ${(map.buildings || []).length.toLocaleString('ru-RU')} выбранных контуров зданий · ${map.landmarks.length} достопримечательностей · ${map.parkAnchors.length} опорных точек парков.</p><p>Координаты объектов — из набора пользователя; пять точек уточнены по именованным объектам OpenStreetMap. Дороги — OpenStreetMap; вода, озеленение и контуры — ${sourceName}. Высота домов и движение транспорта иллюстративны. В прогулке используются игровые декорации; они не обозначают фактические здания. Объекты решений показывают выбранный район, а не адрес строительства. Численность населения и работа транспорта здесь не измеряются.</p><p>Историческая нагрузка не является текущим трафиком. Шесть контуров районов получены из городского GIS; дата их действия не указана. Здания — выборка 2 000 контуров центра, озеленение — выборка источника.</p><a href="https://gis.esaulet.kz/server/rest/services/dop_sloi_geoportal_otkr/MapServer" target="_blank" rel="noopener noreferrer">Муниципальный источник ↗</a>`;
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
  function tick(time) { frame = null; if (!visible()) return; if (lastTime === null) lastTime = time; const dt = Math.min(.1, (time - lastTime) / 1000); if (dt >= 1 / 30) { lastTime = time; if (!context.reducedMotion && snapshot?.playback?.status !== 'paused') movingSeconds += dt;
    if (detail() && mayor) { const dx = Number(pressed.has('ArrowRight') || pressed.has('d')) - Number(pressed.has('ArrowLeft') || pressed.has('a')); const dy = Number(pressed.has('ArrowDown') || pressed.has('s')) - Number(pressed.has('ArrowUp') || pressed.has('w')); if (dx || dy) moveMayor([mayor[0] + dx, mayor[1] + dy], dt * 1.5); else if (destination && !context.reducedMotion) moveMayor(destination, dt * 1.5); }
    effects.step(dt); if (!destroyed) motion(); } schedule(); }

  function action(command) {
    if (command === 'top' || command === 'tilted') onIntent({ type: 'SET_PROJECTION', projection: command });
    if (command === 'zoom-in' || command === 'zoom-out') { camera.zoomAt(command === 'zoom-in' ? 1.4 : 1 / 1.4, [width / 2, height / 2]); render(); }
    if (command === 'center') focusCenter();
    if (command === 'overview') { onIntent({ type: 'SET_VIEW', view: 'overview' }); camera.reset(); render(); }
    if (command === 'sources') sources();
    if (command === 'close-card') { selected = null; inspectorSignature = ''; $('.atlas-place-card').hidden = true; render(); }
    if (command === 'walk' && walkable) { onIntent({ type: 'FOCUS_REGION', regionId: 'nura' }); onIntent({ type: 'SET_VIEW', view: 'district' }); }
  }
  listen(container, 'click', event => {
    const button = event.target.closest('button');
    if (!button || !visible()) return;
    if (button.dataset.act) action(button.dataset.act);
    if (button.dataset.place) focusFeature(button.dataset.place);
    if (button.dataset.layer) { const name = button.dataset.layer; enabled[name] = !enabled[name]; button.setAttribute('aria-pressed', String(enabled[name])); if (name === 'landmarks') renderPlaces(); else layers[name].setAttribute('display', enabled[name] ? '' : 'none'); }
  });
  const point = event => { const box = stage.getBoundingClientRect(); return [event.clientX - box.left, event.clientY - box.top]; };
  listen(stage, 'pointerdown', event => { if (!visible() || event.button !== 0) return; const p = point(event); drag = { id: event.pointerId, start: p, last: p, moved: false, featureId: event.target.closest('[data-feature-id]')?.dataset.featureId, junctionId: event.target.closest('[data-junction-id]')?.dataset.junctionId }; stage.setPointerCapture?.(event.pointerId); stage.focus({ preventScroll: true }); });
  listen(stage, 'pointermove', event => { if (!visible() || !drag || drag.id !== event.pointerId) return; const p = point(event); if (distance(p, drag.start) > 6) drag.moved = true; if (drag.moved) { camera.pan(p[0] - drag.last[0], p[1] - drag.last[1]); render(); } drag.last = p; });
  listen(stage, 'pointerup', event => { if (!visible() || !drag || drag.id !== event.pointerId) return; const last = drag; drag = null; if (stage.hasPointerCapture?.(event.pointerId)) stage.releasePointerCapture(event.pointerId); if (last.moved) return;
    if (last.featureId) { selected = last.featureId; renderInspector(); render(); }
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
  listen(document, 'visibilitychange', () => { container.dataset.motion = visible() && !context.reducedMotion && snapshot?.playback?.status !== 'paused' ? 'running' : 'paused'; pressed.clear(); if (drag && stage.hasPointerCapture?.(drag.id)) stage.releasePointerCapture(drag.id); drag = null; if (snapshot) effects.update({ snapshot, reducedMotion: context.reducedMotion, visible: visible() }); stop(); schedule(); });
  const observer = new ResizeObserver(resize); observer.observe(stage);
  const api = {
    update({ snapshot: next, context: nextContext = {} }) {
      if (destroyed) return; if (next?.contractVersion !== 1) throw new TypeError('Scene contract v1 required.');
      const previous = snapshot;
      snapshot = next; context = nextContext;
      container.dataset.motion = !visible() || context.reducedMotion || snapshot.playback?.status === 'paused' ? 'paused' : 'running';
      if (!visible()) { pressed.clear(); if (drag && stage.hasPointerCapture?.(drag.id)) stage.releasePointerCapture(drag.id); drag = null; stop(); }
      if (lastProjection !== snapshot.projection) { camera.setProjection(snapshot.projection); buildGround(); lastProjection = snapshot.projection; }
      const view = detail() ? 'district' : 'overview';
      const changedView = currentView !== view;
      if (currentView !== view) { pressed.clear(); if (detail() && walkable) camera.focus([walkable.start[0] - 23, walkable.start[1] - 18, 46, 36]); else if (currentView === null || currentView === 'district') focusCenter(); currentView = view; }
      // Show an edited district's upgrade once; ordinary session updates must not
      // pull the camera back after the player pans, replays, or inspects the map.
      if (previous && previous.planRevision !== snapshot.planRevision && visible() && !detail() && !changedView) {
        const oldAssignments = new Map((previous.plan || []).map(decision => [decision.id, decision.district]));
        const target = [...(snapshot.plan || [])].reverse().find(decision => decision.district
          && (!oldAssignments.has(decision.id) || oldAssignments.get(decision.id) !== decision.district)
          && worldRegions.some(region => region.regionId !== 'saraishyk' && districtNames[region.regionId] === decision.district));
        const region = target && worldRegions.find(region => districtNames[region.regionId] === target.district);
        const anchor = region && policyAnchors.get(region.regionId);
        if (anchor) camera.focus([anchor[0] - 68, anchor[1] - 54, 136, 108]);
      }
      for (const button of container.querySelectorAll('[data-act="top"], [data-act="tilted"]')) button.setAttribute('aria-pressed', String(button.dataset.act === snapshot.projection));
      $('.atlas-mode-status').textContent = detail() && walkable ? 'Нура · прогулка' : snapshot.focusedRegion ? districtNames[snapshot.focusedRegion] : 'Астана';
      $('.atlas-status-help').textContent = detail() && walkable ? 'WASD — идти' : 'Перетащи карту';
      $('.atlas-walk').disabled = !walkable; $('.atlas-walk').setAttribute('aria-pressed', String(detail()));
      effects.update({ snapshot, reducedMotion: !!context.reducedMotion, visible: visible() });
      renderInspector(); resize(); if (context.reducedMotion && !pressed.size) stop(); else schedule();
    },
    destroy() { if (destroyed) return; destroyed = true; stop(); pressed.clear(); if (drag && stage.hasPointerCapture?.(drag.id)) stage.releasePointerCapture(drag.id); drag = null; listeners.forEach(fn => fn()); observer.disconnect(); effects.destroy(); mapLife.destroy(); mapFeedback.destroy(); artNodes.clear(); container.remove(); if (mounts.get(root) === api) mounts.delete(root); },
    getDiagnostics() { return { frames, averageMotionRenderMs: frames ? totalRenderMs / frames : 0, actorCount: vehicles.length + mapLife.getDiagnostics().count, mapLife: mapLife.getDiagnostics(), mapFeedback: mapFeedback.getDiagnostics(), visible: visible(), running: frame !== null, destroyed, camera: camera.getState(), mayor: mayor ? [...mayor] : null, selected, effects: effects.getState(), data: { roads: map.roads.length, buildings: (map.buildings || []).length, landmarks: map.landmarks.length, regions: worldRegions.length }, missingAssetIds: [...missingArt], artNodeCount: artNodes.size }; },
  };
  mounts.set(root, api);
  return api;
}
