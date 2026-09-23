import { createCamera, pointInRegion, regionBounds, polygonsToPath, segmentsCross } from './camera.js';
import { createLandmarkSymbol } from './landmarks.js';
import { createEffects } from './effects.js';
import { buildBuildings, selectVisibleBuildings } from './buildings.js';

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
  container.innerHTML = `<header class="atlas-header"><div class="atlas-brand"><span>а</span><strong>Аким<small>Астана</small></strong></div><div class="atlas-breadcrumb">Город, который меняешь ты <span>/</span> <b>Астана</b></div><div class="atlas-header-end"><span class="atlas-live-dot"></span>Городская лаборатория <button data-act="sources" type="button" aria-label="Источники данных">ⓘ</button></div></header>
  <div class="atlas-body"><aside class="atlas-sidebar"><div class="atlas-sidebar-head"><h1>Твоя Астана</h1><p>Исследуй город.<br>Выбирай, что изменить.</p></div>
    <div class="atlas-search-wrap"><label class="atlas-search"><span>⌕</span><input aria-label="Найти место в Астане" placeholder="Найти место в Астане…" autocomplete="off"></label><div class="atlas-search-results" hidden></div></div>
    <div class="atlas-tabs" role="tablist" aria-label="Содержание карты"><button data-tab="places" role="tab" aria-selected="true">Места</button><button data-tab="roads" role="tab" aria-selected="false">Дороги</button><button data-tab="districts" role="tab" aria-selected="false">Районы</button></div>
    <div class="atlas-sidebar-content"></div><div class="atlas-sidebar-bottom"><span>⌁</span><p>Приближай знакомые места.<br>Решения добавляй в свой план.</p></div></aside>
    <div class="atlas-map-shell"><div class="atlas-map-top"><div class="atlas-map-title"><span class="atlas-pill">ASTANA</span><span>6 районов на одной карте</span></div><div class="atlas-projections"><button type="button" data-act="top">Карта</button><button type="button" data-act="tilted">2.5D</button></div></div>
      <div class="atlas-stage" tabindex="0" role="group" aria-label="Карта Астаны. Стрелки перемещают камеру, плюс и минус меняют масштаб."><svg class="atlas-svg" aria-label="Реальная география Астаны" role="img"></svg></div>
      <div class="atlas-layer-tools" role="group" aria-label="Слои карты"><button type="button" data-layer="buildings" aria-pressed="true">▥ <span>Здания</span></button><button type="button" data-layer="landmarks" aria-pressed="true">◈ <span>Места</span></button><button type="button" data-layer="traffic" aria-pressed="false">⇄ <span>Нагрузка</span></button><button type="button" data-layer="labels" aria-pressed="true">Aa <span>Подписи</span></button></div>
      <div class="atlas-place-card" hidden></div><button class="atlas-building-status" data-act="retry-buildings" type="button" hidden></button><div class="atlas-camera-tools"><button type="button" data-act="zoom-in" aria-label="Приблизить">+</button><button type="button" data-act="zoom-out" aria-label="Отдалить">−</button><button type="button" data-act="center" aria-label="Центр Астаны">⌾</button><button type="button" data-act="overview" aria-label="Вся территория">⤢</button></div>
      <div class="atlas-compass" aria-hidden="true"><span>С</span>↑</div><div class="atlas-scale"><i></i><span></span></div>
      <div class="atlas-map-credit"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> <button data-act="sources" type="button" aria-label="Источники карты">ⓘ</button></div>
      <div class="atlas-status-bar"><span class="atlas-mode-status">Обзор Астаны</span><span class="atlas-status-help">Перетаскивай карту · Ctrl/⌘ + колесо — масштаб</span><span class="atlas-object-count"></span></div>
    </div></div><div class="atlas-playback"><span class="atlas-feedback" role="status"></span><div><i></i></div><small>Восемь кварталов · визуализация рассчитанного результата</small></div>`;
  root.appendChild(container);
  const $ = selector => container.querySelector(selector);
  const stage = $('.atlas-stage'), surface = $('.atlas-svg');
  const ground = el('g', { class: 'atlas-ground' }); surface.appendChild(ground);
  const layers = {};
  for (const name of ['districts', 'parks', 'water', 'road-casing', 'roads', 'buildings', 'traffic', 'intersections']) { layers[name] = el('g', { class: `atlas-layer-${name}` }); ground.appendChild(layers[name]); }
  for (const name of ['vehicles', 'landmarks', 'labels', 'effects', 'mayor']) { layers[name] = el('g', { class: `atlas-layer-${name}` }); surface.appendChild(layers[name]); }
  const camera = createCamera({ viewBox: map.viewBox, width: 1000, height: 700, projection: 'tilted', maxZoom: 40 });
  const features = [...map.landmarks, ...map.parkAnchors.map(p => ({ ...p, category: 'park_anchor' }))];
  const featureMap = new Map(features.map(p => [p.id, p]));
  const enabled = { buildings: true, landmarks: true, traffic: false, labels: true };
  let policyCards = [];
  const listeners = [];
  // Accept the six attributed source polygons without claiming their effective date is verified.
  const sourcedSix = Object.keys(districtNames).every(id => map.regions?.some(r => r.regionId === id && r.status !== 'historical' && r.sourceIds?.includes('astana-municipal-six-districts')));
  const worldRegions = (map.regions || []).filter(r => r.regionId && (r.status === 'verified' || (sourcedSix && r.status !== 'historical' && Object.hasOwn(districtNames, r.regionId) && r.sourceIds?.includes('astana-municipal-six-districts'))));
  const policyNames = {M1:'Автобусы',M2:'Светофоры',M3:'ЛРТ',M4:'Парк',M5:'Топливо',M6:'Озеленение',M7:'Школа',M8:'Медицина',M9:'Спорт',M10:'Освещение',M11:'Переходы',M12:'Обращения',M13:'Сети',M14:'Службы'};
  const policyAnchors = new Map(worldRegions.map(region => [region.regionId, features.filter(f => pointInRegion(f.position, region)).sort((a,b) => distance(a.position,map.center)-distance(b.position,map.center))[0]?.position || region.labelAnchor]));
  const roadNodes = new Map();
  let snapshot = null, context = {}, destroyed = false, frame = null, lastTime = null, frames = 0, totalRenderMs = 0;
  let width = 1000, height = 700, selected = 'baiterek', currentTab = 'places', drag = null, lastProjection = null, currentView = null;
  let movingSeconds = 0, destination = null, mayor = null, walkable = null, selectedCorridor = null, inspectorSignature = '';
  let buildingTimer = null, buildingSignature = '', renderedBuildingCount = 0;
  const buildingSource = map.createBuildingSource?.({ onChange: () => {
    if (destroyed) return;
    buildingSignature = ''; setupWalkable(); refreshBuildings();
  } });
  const allBuildings = () => buildingSource?.getBuildings() || map.buildings || [];
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
      (water ? layers.water : layers.parks).appendChild(el('path', { d: polygonsToPath(feature), fill: water ? '#8dbfcc' : '#b4cda7', stroke: water ? '#609bad' : '#94b989', 'stroke-width': .25, 'fill-rule': 'evenodd', class: water ? 'atlas-water-polygon' : 'atlas-park-polygon' }));
    }
    roadNodes.clear();
    for (const road of map.roads) {
      const d = linePath(road.points); if (!d) continue;
      const major = /motorway|trunk|primary/.test(road.kind) || road.importance >= 4;
      layers['road-casing'].appendChild(el('path', { d, fill: 'none', stroke: '#b5bda8', 'stroke-width': major ? 5 : 3, 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      const path = el('path', { d, fill: 'none', stroke: major ? '#fff9e8' : '#f8f5e9', 'stroke-width': major ? 3.2 : 1.65, 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-road-id': road.id });
      layers.roads.appendChild(path); roadNodes.set(road.id, path);
    }
    buildingSignature = '';
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

  function refreshBuildings() {
    if (destroyed || !snapshot || !enabled.buildings) return;
    const corners = [[-35,-35],[width+35,-35],[-35,height+35],[width+35,height+35]].map(p => camera.unproject(p));
    const bounds = [Math.min(...corners.map(p=>p[0])), Math.min(...corners.map(p=>p[1])), Math.max(...corners.map(p=>p[0])), Math.max(...corners.map(p=>p[1]))];
    // The affine world uses the complete seed bbox. Unclamped conversion is needed
    // when the camera's corners extend outside it.
    const [west,south,east,north] = map.bounds, worldWidth = map.viewBox[2], worldHeight = map.viewBox[3];
    buildingSource?.request([west+bounds[0]/worldWidth*(east-west), north-bounds[3]/worldHeight*(north-south), west+bounds[2]/worldWidth*(east-west), north-bounds[1]/worldHeight*(north-south)]);
    const selectedBuildings = selectVisibleBuildings(allBuildings(), { viewBounds: bounds, pixelsPerWorldUnit: camera.getState().scale, maxCount: width < 600 ? 1200 : 2200 });
    const signature = `${snapshot.projection}|${selectedBuildings.map(b=>b.id).join(',')}`;
    if (signature !== buildingSignature) {
      layers.buildings.replaceChildren(buildBuildings({ buildings: selectedBuildings, projection: snapshot.projection }));
      buildingSignature = signature; renderedBuildingCount = selectedBuildings.length;
    }
    const state = buildingSource?.getState(), status = $('.atlas-building-status');
    status.hidden = !state || (!state.pending && !state.failed);
    status.textContent = state?.failed ? 'Здания не загрузились · повторить ↻' : 'Загружаем кварталы…';
    status.disabled = !state?.failed;
    layers.buildings.setAttribute('data-visible-count', renderedBuildingCount);
    layers.buildings.setAttribute('data-loading', String(Boolean(state?.pending)));
  }
  function scheduleBuildings() {
    clearTimeout(buildingTimer);
    if (!buildingSignature) refreshBuildings();
    else buildingTimer = setTimeout(refreshBuildings, 90);
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

  const overlaps = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  function overlayBoxes() {
    const stageBox = stage.getBoundingClientRect();
    return ['.atlas-game-hud','.atlas-camera-tools','.atlas-layer-tools','.atlas-map-top','.atlas-map-credit','.atlas-scale','.atlas-compass','.atlas-place-card','.atlas-building-status'].flatMap(selector => {
      const node = $(selector); if (!node || node.hidden) return []; const b = node.getBoundingClientRect();
      return b.width && b.height ? [{x:b.left-stageBox.left-8,y:b.top-stageBox.top-8,w:b.width+16,h:b.height+16}] : [];
    });
  }
  function placePolicyCards(state) {
    const cards = [], blockers = overlayBoxes();
    const groups = new Map();
    for (const marker of state.markers) { if (!groups.has(marker.regionId)) groups.set(marker.regionId,[]); groups.get(marker.regionId).push(marker.id); }
    for (const feature of features) { const [x,y] = camera.project(feature.position); blockers.push({x:x-45,y:y-75,w:90,h:108}); }
    if (mayor && detail()) { const [x,y] = camera.project(mayor); blockers.push({x:x-24,y:y-40,w:48,h:65}); }
    for (const [regionId, ids] of groups) {
      const anchor = policyAnchors.get(regionId); if (!anchor) continue;
      const [x,y] = camera.project(anchor); if (x<0 || x>width || y<0 || y>height) continue;
      const offsets = [[25,-128],[-169,-128],[30,58],[-172,58],[70,-52],[-214,-52],[20,135],[-160,135]];
      const box = offsets.map(([dx,dy])=>({x:x+dx,y:y+dy,w:144,h:52})).find(b=>b.x>10 && b.x+b.w<width-10 && b.y>60 && b.y+b.h<height-45 && !blockers.some(v=>overlaps(b,v)));
      if (box) { cards.push({regionId,ids,box,anchor:[x,y]}); blockers.push(box); }
    }
    return cards;
  }
  function renderPlaces() {
    layers.landmarks.replaceChildren(); layers.labels.replaceChildren();
    if (!enabled.landmarks) return;
    const items = features.map(feature => ({ feature, point: camera.project(feature.position) }))
      .filter(({ point }) => point[0] > -80 && point[0] < width + 80 && point[1] > -90 && point[1] < height + 100)
      .sort((x, y) => x.point[1] - y.point[1]);
    const labelBoxes = [...overlayBoxes(), ...policyCards.map(card=>card.box)];
    const modelBoxes = items.map(({feature,point:[x,y]})=>({id:feature.id,x:x-36,y:y-70,w:72,h:75}));
    const sortedLabels = [...items].sort((x, y) => Number(y.feature.id === selected) - Number(x.feature.id === selected) || y.feature.importance - x.feature.importance);
    for (const { feature, point: [x, y] } of items) {
      const active = feature.id === selected;
      const size = Math.min(98, Math.max(34, camera.getState().zoom * 10)) * (active ? 1.2 : 1);
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
      if (text.length > 28) text = text.slice(0, 27) + '…';
      const labelWidth = text.length*6+22, labelHeight = 26;
      const candidates = [ {x:x-labelWidth/2,y:y+10}, {x:x+34,y:y-8}, {x:x-labelWidth-34,y:y-8}, {x:x-labelWidth/2,y:y-96} ];
      const box = candidates.map(p=>({...p,w:labelWidth,h:labelHeight})).find(b=>b.x>=7 && b.x+b.w<=width-7 && b.y>=5 && b.y+b.h<=height-42 && !labelBoxes.some(v=>overlaps(b,v)) && !modelBoxes.some(v=>v.id!==feature.id && overlaps(b,v)));
      if (!box) continue;
      if (!active && camera.getState().zoom < 3 && feature.importance < 5) continue;
      labelBoxes.push(box);
      const group = el('g', { 'data-feature-id': feature.id, class: 'atlas-map-label', transform: `translate(${box.x+box.w/2} ${box.y})` });
      group.appendChild(el('rect', { x: -box.w / 2, y: 0, width: box.w, height: box.h, rx: 9, fill: active ? '#18513ef0' : '#ffffff8c', stroke: active ? '#18513e' : '#ffffff50', 'stroke-width': .5 }));
      group.appendChild(el('text', { 'text-anchor': 'middle', y: 18, fill: active ? '#fffbea' : '#45634d', 'font-size': 11.5, 'font-weight': active ? 600 : 500 }, text));
      layers.labels.appendChild(group);
    }
    if (camera.getState().zoom >= 6) {
      const names = new Set();
      for (const road of map.roads) {
        if (!road.name || /^(osm[_:-]|way[_:-]|node[_:-])/i.test(road.name) || names.has(road.name) || names.size >= 10 || road.points.length < 2) continue;
        const index = Math.floor((road.points.length - 1) / 2);
        const a = camera.project(road.points[index]), b = camera.project(road.points[index + 1]);
        const x = (a[0]+b[0])/2, y = (a[1]+b[1])/2;
        const title = road.name.length > 30 ? road.name.slice(0,29)+'…' : road.name;
        let angle = Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI; if (angle>90) angle-=180; if(angle<-90) angle+=180;
        const radians=angle*Math.PI/180, rw=Math.abs(Math.cos(radians))*title.length*6+Math.abs(Math.sin(radians))*20, rh=Math.abs(Math.sin(radians))*title.length*6+Math.abs(Math.cos(radians))*20;
        const box = {x:x-rw/2,y:y-rh/2,w:rw,h:rh};
        if (x < 80 || x > width-80 || y < 145 || y > height-100 || [...labelBoxes, ...modelBoxes].some(v => overlaps(box, v))) continue;
        const name = el('text',{x:0,y:0,transform:`translate(${x} ${y}) rotate(${angle})`,'text-anchor':'middle','font-size':10.5,'font-weight':500,fill:'#59745a',stroke:'#eef2e4','stroke-width':3,'paint-order':'stroke','pointer-events':'none'},title);
        layers.labels.appendChild(name); names.add(road.name); labelBoxes.push(box);
      }
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
    for (const card of policyCards) {
      const choices = state.markers.filter(m=>card.ids.includes(m.id)); if (!choices.length) continue;
      const active = choices.every(m=>m.phase === 'active'), progress = choices.reduce((sum,m)=>sum+m.progress,0)/choices.length;
      const {x,y,w,h} = card.box;
      const group = el('g',{transform:`translate(${x} ${y})`,class:'atlas-policy-card'});
      group.appendChild(el('rect',{width:w,height:h,rx:12,fill:active?'#f0f7e9f2':'#fff9eaf2',stroke:active?'#92b084':'#c1af88','stroke-width':.8}));
      group.appendChild(el('text',{x:12,y:19,fill:'#335d40','font-size':12,'font-weight':600},districtNames[card.regionId]));
      const description = choices.length===1 ? policyNames[choices[0].measureId] : `${choices.length} решения`;
      group.appendChild(el('text',{x:12,y:35,fill:'#6c8062','font-size':10.5},`${description}${active?' · готово':''}`));
      group.appendChild(el('rect',{x:12,y:42,width:(w-24)*progress,height:2,rx:1,fill:'#90ac75'}));
      group.appendChild(el('title',{},choices.map(m=>`${policyNames[m.measureId]}: ${m.phase === 'active'?'введено':m.phase === 'queued'?'в плане':'реализуется'}`).join('; ')+' · Маркер района, не адрес строительства'));
      layers.effects.appendChild(group);
    }
    if ($('.atlas-feedback').textContent !== state.feedback) $('.atlas-feedback').textContent = state.feedback;
    if (state.status === 'complete' && state.reactions.length) {
      const negative = state.reactions.some(r => r.tone === 'negative');
      const positive = state.reactions.some(r => r.tone === 'positive');
      const label = negative ? positive ? '↑↓ Есть улучшения и ухудшения' : '↓ Есть ухудшения' : '↑ Изменения показаны в результате';
      const group = el('g', { transform: `translate(${width / 2} ${height - 58})`, class: 'atlas-final-reaction' });
      group.appendChild(el('rect', { x: -140, y: -18, width: 280, height: 29, rx: 14, fill: negative ? '#f2debc' : '#e9f0d7' }));
      group.appendChild(el('text', { 'text-anchor': 'middle', y: 1, fill: '#476243', 'font-size': 11 }, label));
      layers.effects.appendChild(group);
    }
    $('.atlas-playback > div > i').style.width = `${state.progress * 100}%`;
    container.classList.toggle('has-plan', state.markers.length > 0 || state.status !== 'idle');
    frames++; totalRenderMs += performance.now() - begin;
  }

  function render() {
    if (destroyed || !snapshot) return;
    ground.setAttribute('transform', `matrix(${camera.matrix().join(' ')})`);
    scheduleBuildings();
    layers.intersections.setAttribute('display', camera.getState().zoom >= 5 ? '' : 'none');
    policyCards = placePolicyCards(effects.getState()); renderPlaces(); motion();
    const pixelsPerWorld = camera.getState().scale;
    const worldPerKm = 1000 / ((map.bounds[2] - map.bounds[0]) * 111.32 * Math.cos(((map.bounds[1] + map.bounds[3]) / 2) * Math.PI / 180));
    const meters = 90 / (pixelsPerWorld * worldPerKm) * 1000;
    $('.atlas-scale span').textContent = meters >= 1000 ? `${(meters / 1000).toFixed(1)} км` : `${Math.round(meters / 50) * 50} м`;
  }
  function focusCenter() { camera.reset(); camera.focus([map.center[0] - 150, map.center[1] - 110, 300, 220]); render(); }
  function focusFeature(id) {
    const feature = featureMap.get(id); if (!feature) return;
    selected = id; selectedCorridor = null; highlightRoads(); camera.focus([feature.position[0] - 68, feature.position[1] - 54, 136, 108]);
    renderInspector(); $('.atlas-sidebar-content').scrollTop = 0; render();
  }
  function renderInspector(force = false) {
    for (const tab of container.querySelectorAll('[data-tab]')) tab.setAttribute('aria-selected', String(tab.dataset.tab === currentTab));
    const signature = `${currentTab}|${selected}|${snapshot?.focusedRegion}|${selectedCorridor}|${detail()}`;
    if (!force && signature === inspectorSignature) return; inspectorSignature = signature;
    const regionStatus = worldRegions.length === 6 ? 'Шесть контуров городского GIS. Дата действия границ источником не указана.' : 'Актуальные границы шести районов ещё не подтверждены';
    if (currentTab === 'places') {
      const feature = featureMap.get(selected) || features[0];
      const source = safeLink(feature.sourceUrl);
      const placeDescriptions = { baiterek:'Золотая сфера над городом — знакомый ориентир левого берега.', akorda:'Президентская резиденция у набережной Есиля.', khan_shatyr:'Прозрачный шатёр на западном конце главной оси столицы.', astana_opera:'Театр оперы и балета рядом с парком влюблённых.', national_museum:'История и культура страны у площади Независимости.', nur_alem:'Сфера EXPO и пространство науки на юге города.' };
      const description = placeDescriptions[feature.id] || (feature.category === 'park_anchor' ? 'Зелёное место на карте города. Приблизи его, чтобы рассмотреть окрестности.' : 'Знакомое место Астаны. Приблизи карту и исследуй район вокруг.');
      $('.atlas-sidebar-content').innerHTML = `<div class="atlas-feature-hero"><svg viewBox="-70 -110 140 145" class="atlas-selected-model"></svg><span class="atlas-feature-kind">${html(kindNames[feature.category] || 'Объект города')}</span></div>
      <div class="atlas-feature-info"><h2>${html(feature.label)}</h2><p class="atlas-place-description">${html(description)}</p><button type="button" class="atlas-primary" data-place="${feature.id}">Приблизить место <span>↗</span></button><details class="atlas-provenance"><summary>О месте и координатах</summary><p>${feature.category === 'park_anchor' ? 'Опорная точка парка из переданного набора. Площадь парка не восстанавливается по одной точке.' : feature.coordinateCorrection ? `Положение уточнено по ${feature.coordinateCorrection.osmType === 'node' ? 'именованной точке' : 'центру контура'} OpenStreetMap. Исходная точка сохранена; расхождение ${Math.round(feature.coordinateCorrection.differenceMeters)} м.` : 'Объект расположен по координатам из переданного набора. Миниатюра помогает узнать его на карте.'}</p><div class="atlas-coordinates"><span>Широта <b>${feature.coordinates[1].toFixed(5)}°</b></span><span>Долгота <b>${feature.coordinates[0].toFixed(5)}°</b></span></div>${source ? `<a class="atlas-source-link" href="${html(source)}" target="_blank" rel="noopener noreferrer">${html(feature.source || 'Источник координат')} ↗</a>` : ''}</details></div>
      <div class="atlas-list-heading">Ещё в Астане <span>${features.length}</span></div><div class="atlas-place-list">${features.filter(f => f.id !== feature.id).map(f => `<button data-place="${f.id}" type="button"><i>${f.category === 'park_anchor' ? '♧' : '◈'}</i><span>${html(f.label)}<small>${html(kindNames[f.category] || 'Место города')}</small></span><b>↗</b></button>`).join('')}</div>`;
      $('.atlas-selected-model').appendChild(createLandmarkSymbol(feature.id, { size: 100, projection: 'tilted', selected: false }));
    } else if (currentTab === 'roads') {
      $('.atlas-sidebar-content').innerHTML = `<div class="atlas-feature-info"><h2>${map.roads.length.toLocaleString('ru-RU')} сегментов</h2><p>Геометрия улиц — OpenStreetMap. Движущиеся машины — условная анимация.</p><div class="atlas-data-note">Историческая нагрузка<br><span>Нагрузка ниже — исторический показатель, не пробки сейчас. Подсвечивается вся сопоставленная улица; границы отрезка не подтверждены.</span></div></div><div class="atlas-corridor-list">${(map.corridors || []).map((corridor, index) => `<button type="button" data-corridor="${html(corridor.id)}" aria-pressed="${selectedCorridor === corridor.id}"><span class="atlas-rank">${String(index + 1).padStart(2, '0')}</span><span>${html(corridor.road || corridor.name)}<small>${html(corridor.from)} → ${html(corridor.to)}</small><i style="--load:${Math.min(1, corridor.importance_0_1 || corridor.importance || 0) * 100}%"></i></span><b>${Math.round((corridor.importance_0_1 || corridor.importance || 0) * 100)}</b></button>`).join('')}</div>`;
    } else {
      $('.atlas-sidebar-content').innerHTML = `<div class="atlas-feature-info"><h2>Шесть районов.<br>Один город.</h2><p>Пять районов участвуют в расчёте сценария. Сарайшық доступен для просмотра контекста.</p><div class="atlas-data-note">${html(regionStatus)}</div></div><div class="atlas-district-list">${Object.entries(districtNames).map(([id, label], index) => `<button type="button" data-district-id="${id}" aria-pressed="${snapshot?.focusedRegion === id}"><span class="atlas-district-dot"></span><b>${label}<small>${id === 'saraishyk' ? 'Контекст · не участвует в оценке' : id === 'nura' ? 'Прогулка акима и решения' : 'Доступен для решений'}</small></b><i>↗</i></button>`).join('')}</div><div class="atlas-feature-info"><button type="button" class="atlas-primary" data-act="walk">Прогулка акима по Нуре ↗</button><p class="atlas-walk-note">${walkable ? 'Маршрут декоративный; движение не меняет решения, бюджет и результат.' : 'Для прогулки нужна актуальная граница Нуры. На точной карте она не заменяется выдуманным полигоном.'}</p></div>`;
    }
  }

  function sources() {
    $('.atlas-place-card').hidden = false;
    $('.atlas-place-card').innerHTML = `<button type="button" data-act="close-card" aria-label="Закрыть">×</button><span class="atlas-eyebrow">О КАРТЕ</span><h3>География с источником</h3><p>${map.roads.length.toLocaleString('ru-RU')} дорожных сегментов · ${(map.buildingCount || (map.buildings || []).length).toLocaleString('ru-RU')} контуров зданий · ${map.landmarks.length} достопримечательностей · ${map.parkAnchors.length} опорных точек парков.</p><p>Координаты объектов — из набора пользователя; пять точек уточнены по именованным объектам OpenStreetMap. Дороги — OpenStreetMap; вода, озеленение и контуры — ${sourceName}. Высота домов и движение транспорта иллюстративны. Численность населения и работа транспорта здесь не измеряются.</p><p>Историческая нагрузка не является текущим трафиком. Шесть контуров районов получены из городского GIS; дата их действия не указана. Здания загружаются участками по всей рабочей территории; при отдалении мелкие контуры скрываются. Озеленение — выборка источника.</p><a href="https://gis.esaulet.kz/server/rest/services/dop_sloi_geoportal_otkr/MapServer" target="_blank" rel="noopener noreferrer">Муниципальный источник ↗</a>`;
  }

  function setupWalkable() {
    const nura = worldRegions.find(r => r.regionId === 'nura'); if (!nura) return;
    const exclusions = [...allBuildings(), ...(map.landscape || []).filter(f => /water|river|hydro/.test(f.kind))];
    const candidates = [...map.parkAnchors, ...map.landmarks].filter(f => pointInRegion(f.position, nura)).map(f => f.position);
    if (mayor) candidates.unshift(mayor);
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
    if (command === 'close-card') { $('.atlas-place-card').hidden = true; render(); }
    if (command === 'retry-buildings') { buildingSource?.retry(); refreshBuildings(); }
    if (command === 'walk' && walkable) { onIntent({ type: 'FOCUS_REGION', regionId: 'nura' }); onIntent({ type: 'SET_VIEW', view: 'district' }); }
  }
  listen(container, 'click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.act) action(button.dataset.act);
    if (button.dataset.place) { currentTab = 'places'; focusFeature(button.dataset.place); $('.atlas-search-results').hidden = true; }
    if (button.dataset.tab) { currentTab = button.dataset.tab; renderInspector(); }
    if (button.dataset.layer) { const name = button.dataset.layer; enabled[name] = !enabled[name]; button.setAttribute('aria-pressed', String(enabled[name])); if (name === 'landmarks') renderPlaces(); else layers[name].setAttribute('display', enabled[name] ? '' : 'none'); if (name === 'buildings') { if (enabled.buildings) refreshBuildings(); else $('.atlas-building-status').hidden = true; } }
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
    if (last.featureId) { selectedCorridor = null; highlightRoads(); selected = last.featureId; currentTab = 'places'; renderInspector(); render(); }
    else if (last.junctionId) showJunction(last.junctionId);
    else if (detail() && walkable) { const p = camera.unproject(point(event)); if (walkable.contains(p)) { destination = p; if (context.reducedMotion) moveMayor(p, distance(mayor, p)); motion(); } }
    else { const p = camera.unproject(point(event)), region = worldRegions.find(r => pointInRegion(p, r)); if (region) onIntent({ type: 'FOCUS_REGION', regionId: region.regionId }); }
  });
  listen(stage, 'pointercancel', () => { drag = null; });
  listen(stage, 'wheel', event => { if (!visible() || (!event.ctrlKey && !event.metaKey)) return; event.preventDefault(); camera.zoomAt(Math.exp(-event.deltaY * .003), point(event)); render(); }, { passive: false });
  listen(container, 'keydown', event => { if (event.key === 'Escape') { $('.atlas-place-card').hidden = true; $('.atlas-search-results').hidden = true; } });
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
      const hud = $('.atlas-game-hud'); if (hud) observer.observe(hud);
      if (!visible()) { pressed.clear(); if (drag && stage.hasPointerCapture?.(drag.id)) stage.releasePointerCapture(drag.id); drag = null; stop(); }
      if (lastProjection !== snapshot.projection) { camera.setProjection(snapshot.projection); buildGround(); lastProjection = snapshot.projection; }
      const view = detail() ? 'district' : 'overview';
      if (currentView !== view) { pressed.clear(); if (detail() && walkable) camera.focus([walkable.start[0] - 23, walkable.start[1] - 18, 46, 36]); else if (currentView === null || currentView === 'district') focusCenter(); currentView = view; }
      for (const button of container.querySelectorAll('[data-act="top"], [data-act="tilted"]')) button.setAttribute('aria-pressed', String(button.dataset.act === snapshot.projection));
      $('.atlas-compass').style.transform = snapshot.projection === 'tilted' ? 'rotate(28.3deg)' : 'rotate(0deg)';
      $('.atlas-mode-status').textContent = detail() && walkable ? 'Нура • Прогулка акима' : 'Обзор Астаны';
      $('.atlas-status-help').textContent = detail() && walkable ? 'WASD / стрелки — идти · Shift + стрелки — камера' : 'Перетаскивай карту · Ctrl/⌘ + колесо — масштаб';
      $('.atlas-object-count').textContent = `${map.landmarks.length} мест · ${map.roads.length.toLocaleString('ru-RU')} дорог`;
      for (const path of layers.districts.querySelectorAll('[data-district]')) { const active = path.dataset.district === snapshot.focusedRegion; path.setAttribute('fill', active ? '#d4b36316' : 'none'); path.setAttribute('stroke', active ? '#94723a' : '#728c77'); path.setAttribute('stroke-width', active ? '2' : '1'); path.setAttribute('opacity', active ? '.9' : '.4'); }
      effects.update({ snapshot, reducedMotion: !!context.reducedMotion, visible: visible() });
      renderInspector(); resize(); if (context.reducedMotion && !pressed.size) stop(); else schedule();
    },
    destroy() { if (destroyed) return; destroyed = true; stop(); clearTimeout(buildingTimer); buildingSource?.destroy(); pressed.clear(); if (drag && stage.hasPointerCapture?.(drag.id)) stage.releasePointerCapture(drag.id); drag = null; listeners.forEach(fn => fn()); observer.disconnect(); effects.destroy(); container.remove(); if (mounts.get(root) === api) mounts.delete(root); },
    getDiagnostics() { return { frames, averageMotionRenderMs: frames ? totalRenderMs / frames : 0, actorCount: vehicles.length, visible: visible(), running: frame !== null, destroyed, camera: camera.getState(), mayor: mayor ? [...mayor] : null, selected, loadedBuildings: allBuildings().length, renderedBuildings: renderedBuildingCount, buildingTiles: buildingSource?.getState(), effects: effects.getState(), data: { roads: map.roads.length, buildings: map.buildingCount || (map.buildings || []).length, landmarks: map.landmarks.length, regions: worldRegions.length }, missingAssetIds: [] }; },
  };
  mounts.set(root, api);
  return api;
}
