import { createCamera, pointInRegion, regionBounds, polygonsToPath, segmentsCross } from './camera.js';
import { createLandmarkSymbol } from './landmarks.js';
import { createEffects } from './effects.js';
import { iconMarkup, categoryIcon } from './icons.js';
import { createVegetation } from './vegetation.js';
import { buildBuildings, selectVisibleBuildings } from './buildings.js';
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
// Nonzero winding unions overlapping green sources while retaining interior rings.
const greenPath = feature => feature.polygons.map(polygon => polygon.map((ring,index) => {
  const area = ring.reduce((sum,p,i) => { const q=ring[(i+1)%ring.length]; return sum+p[0]*q[1]-q[0]*p[1]; },0);
  return `${linePath((area>0)===(index===0) ? ring : [...ring].reverse())}Z`;
}).join('')).join('');
function createParkSymbol(size, projection) {
  const group = el('g', {transform:`scale(${size/88})`, 'data-illustrative':'true'});
  group.appendChild(el('ellipse',{cx:2,cy:4,rx:30,ry:11,fill:'#234b4224'}));
  group.appendChild(el('path',{d:'M-29 0Q-33-14-8-19L25-10Q39 0 17 10L-15 12Z',fill:'#b5cf97',stroke:'#dce9c5','stroke-width':2}));
  group.appendChild(el('path',{d:'M-23 5Q-5-12 25-4',fill:'none',stroke:'#edf0d1','stroke-width':5}));
  for (const [x,y,r,color] of [[-16,-5,10,'#5f9266'],[10,-8,13,'#3e7860'],[23,2,8,'#84a768']]) {
    const h=projection==='top'?13:22;
    group.appendChild(el('ellipse',{cx:x+4,cy:y+3,rx:r*.9,ry:4,fill:'#325c4230'}));
    group.appendChild(el('path',{d:`M${x} ${y}v-${h*.8}`,stroke:'#756849','stroke-width':3,'stroke-linecap':'round'}));
    group.appendChild(el('circle',{cx:x,cy:y-h,r,fill:color}));
    group.appendChild(el('circle',{cx:x-r*.22,cy:y-h-r*.22,r:r*.68,fill:'#b7d58a',opacity:.5}));
  }
  return group;
}

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
      <details class="atlas-layer-menu"><summary>Слои</summary><div class="atlas-layer-tools"><button type="button" data-layer="buildings" aria-pressed="true">Здания</button><button type="button" data-layer="landmarks" aria-pressed="true">Места</button><button type="button" data-layer="vegetation" aria-pressed="true">Зелень</button><button type="button" data-layer="labels" aria-pressed="true">Подписи</button><button type="button" data-layer="traffic" aria-pressed="false">Нагрузка</button></div></details>
      <button data-act="sources" type="button" aria-label="Источники карты" class="atlas-info">i</button>
    </div>
    <div class="atlas-stage" tabindex="0" role="group" aria-label="Карта Астаны. Стрелки перемещают камеру. В Нуре стрелки или WASD перемещают акима."><svg class="atlas-svg" aria-label="Карта районов Астаны" role="img"></svg></div>
    <div class="atlas-place-card" hidden></div><button class="atlas-building-status" data-act="retry-buildings" type="button" hidden></button>
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
  for (const name of ['districts', 'parks', 'water', 'road-casing', 'roads', 'vegetation', 'buildings', 'traffic', 'intersections']) { layers[name] = el('g', { class: `atlas-layer-${name}` }); ground.appendChild(layers[name]); }
  for (const name of ['decoration', 'vehicles', 'landmarks', 'citizens', 'labels', 'policy-world', 'effects', 'mayor']) { layers[name] = el('g', { class: `atlas-layer-${name}` }); surface.appendChild(layers[name]); }
  const camera = createCamera({ viewBox: map.viewBox, width: 1000, height: 700, projection: 'tilted', maxZoom: 40 });
  const features = [...map.landmarks, ...map.parkAnchors.map(p => ({ ...p, category: 'park_anchor' }))];
  const featureMap = new Map(features.map(p => [p.id, p]));
  const enabled = { buildings: true, landmarks: true, traffic: false, labels: true, vegetation: true };
  let policyCards = [];
  const greenAreas = (map.landscape || []).filter(f => /park|green|forest|wood/.test(f.kind));
  const waterAreas = (map.landscape || []).filter(f => /water|river|hydro/.test(f.kind));
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
  let buildingTimer = null, buildingSignature = '', greenerySignature = '', renderedBuildingCount = 0;
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
    for (const name of ['districts', 'parks', 'water', 'road-casing', 'roads', 'vegetation', 'buildings', 'traffic', 'intersections']) layers[name].replaceChildren();
    for (const region of worldRegions) {
      const path = el('path', { d: polygonsToPath(region), fill: 'none', stroke: '#728c77', 'stroke-width': 1, 'stroke-dasharray': '6 6', 'vector-effect': 'non-scaling-stroke', opacity: .55, 'fill-rule': 'evenodd', 'data-district': region.regionId });
      layers.districts.appendChild(path);
    }
    for (const feature of waterAreas) {
      layers.water.appendChild(el('path', { d: polygonsToPath(feature), fill: '#8dbfcc', stroke: '#609bad', 'stroke-width': .25, 'fill-rule': 'evenodd', class: 'atlas-water-polygon' }));
    }
    roadNodes.clear();
    for (const road of map.roads) {
      const d = linePath(road.points); if (!d) continue;
      const major = /motorway|trunk|primary/.test(road.kind) || road.importance >= 4;
      layers['road-casing'].appendChild(el('path', { d, fill: 'none', stroke: '#b5bda8', 'stroke-width': major ? 5 : 3, 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      const path = el('path', { d, fill: 'none', stroke: major ? '#fff9e8' : '#f8f5e9', 'stroke-width': major ? 3.2 : 1.65, 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-road-id': road.id });
      layers.roads.appendChild(path); roadNodes.set(road.id, path);
    }
    buildingSignature = ''; greenerySignature = '';
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
    if (destroyed || !snapshot) return;
    const corners = [[-35,-35],[width+35,-35],[-35,height+35],[width+35,height+35]].map(p => camera.unproject(p));
    const bounds = [Math.min(...corners.map(p=>p[0])), Math.min(...corners.map(p=>p[1])), Math.max(...corners.map(p=>p[0])), Math.max(...corners.map(p=>p[1]))];
    // The affine world uses the complete seed bbox. Unclamped conversion is needed
    // when the camera's corners extend outside it.
    const [west,south,east,north] = map.bounds, worldWidth = map.viewBox[2], worldHeight = map.viewBox[3];
    buildingSource?.request([west+bounds[0]/worldWidth*(east-west), north-bounds[3]/worldHeight*(north-south), west+bounds[2]/worldWidth*(east-west), north-bounds[1]/worldHeight*(north-south)]);
    refreshGreenery(bounds);
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
  function refreshGreenery(bounds) {
    const scale = camera.getState().scale;
    const parks = selectVisibleBuildings(greenAreas, { viewBounds: bounds, pixelsPerWorldUnit: scale, maxCount: 2600 });
    const signature = `${snapshot.projection}|${scale.toFixed(2)}|${bounds.map(n=>n.toFixed(1)).join(',')}|${allBuildings().length}|${parks.map(p=>p.id).join(',')}`;
    if (signature === greenerySignature) return;
    greenerySignature = signature;
    // Keep holes and all multipart geometry in four consolidated source-fill paths.
    const colors = ['#b8d5a4','#c5dda9','#aaca99','#bdd7b2'];
    const paths = colors.map(()=>[]);
    for (const park of parks) { let hash=0; for (const c of park.id) hash=(hash*31+c.charCodeAt(0))>>>0; paths[hash%colors.length].push(greenPath(park)); }
    layers.parks.replaceChildren(...paths.flatMap((parts,index)=>parts.length ? [el('path',{d:parts.join(' '),fill:colors[index],'fill-rule':'nonzero',stroke:'#91b584','stroke-width':.4,'vector-effect':'non-scaling-stroke','stroke-linejoin':'round'})] : []));
    layers.vegetation.replaceChildren(createVegetation({ landscape: [...parks,...waterAreas], buildings: allBuildings(), roads: map.roads,
      viewBounds: bounds, pixelsPerWorldUnit: scale, projection: snapshot.projection, maxCount: width < 600 ? 220 : 450 }));
    layers.vegetation.setAttribute('display', enabled.vegetation ? '' : 'none');
    layers.parks.setAttribute('display', enabled.vegetation ? '' : 'none');
  }

  function scheduleBuildings() {
    clearTimeout(buildingTimer);
    if (!buildingSignature) refreshBuildings();
    else buildingTimer = setTimeout(refreshBuildings, 90);
  }

  function highlightRoads() {
    const ids = new Set(map.corridors?.find(c => c.id === selectedCorridor)?.roadIds || []);
    for (const [id, path] of roadNodes) path.setAttribute('stroke', ids.has(id) ? '#d28a47' : '#ffffff');
  }
  function showJunction(id) {
    const junction = map.intersections?.find(j => j.id === id); if (!junction) return;
    $('.atlas-place-card').hidden = false;
    $('.atlas-place-card').innerHTML = `<button type="button" data-act="close-card" aria-label="Закрыть">${iconMarkup('close',18)}</button><span class="atlas-eyebrow">УЗЕЛ ДОРОЖНОЙ СЕТИ</span><h3>${html(junction.roads.filter(r => !r.startsWith('osm_way_')).join(' / ') || 'Соединение улиц')}</h3><p>${junction.coordinates.map(n => n.toFixed(5)).join(', ')} · OpenStreetMap</p><p>Общая точка дорожных линий в данных. Это не измерение потока транспорта.</p>`;
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
    const modelBoxes = [];
    const sortedLabels = [...items].sort((x, y) => Number(y.feature.id === selected) - Number(x.feature.id === selected) || y.feature.importance - x.feature.importance);
    for (const { feature, point: [x, y] } of items) {
      const active = feature.id === selected;
      const size = Math.min(98, Math.max(34, camera.getState().zoom * 10)) * (active ? 1.2 : 1);
      const group = el('g', { transform: `translate(${x} ${y})`, 'data-feature-id': feature.id, class: `atlas-landmark ${active ? 'is-selected' : ''}`, role: 'button', tabindex: '0', 'aria-label': feature.label });
      group.appendChild(el('title', {}, feature.label));
      if (feature.category === 'park_anchor') group.appendChild(createParkSymbol(size, snapshot?.projection));
      else group.appendChild(createLandmarkSymbol(feature.id, { projection: snapshot?.projection || 'tilted', size, selected: active }));
      layers.landmarks.appendChild(group);
      const bounds = group.getBBox?.();
      modelBoxes.push({id:feature.id,x:x+(bounds?.x ?? -size*.65)-4,y:y+(bounds?.y ?? -size*1.1)-4,w:(bounds?.width ?? size*1.3)+8,h:(bounds?.height ?? size*1.35)+8});
    }
    for (const { feature, point: [x, y] } of sortedLabels) {
      const active = feature.id === selected;
      let text = feature.label;
      if (text.length > 28) text = text.slice(0, 27) + '…';
      const labelWidth = text.length*6+22, labelHeight = 26;
      const model = modelBoxes.find(b=>b.id===feature.id);
      const candidates = [ {x:x-labelWidth/2,y:model.y+model.h+5}, {x:model.x+model.w+6,y:y-8}, {x:model.x-labelWidth-6,y:y-8}, {x:x-labelWidth/2,y:model.y-labelHeight-5} ];
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
    scheduleBuildings();
    layers.intersections.setAttribute('display', camera.getState().zoom >= 5 ? '' : 'none');
    policyCards = placePolicyCards(effects.getState());
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
    selected = id; selectedCorridor = null; highlightRoads(); const radius = feature.category === 'park_anchor' ? 34 : 68;
    camera.focus([feature.position[0] - radius, feature.position[1] - radius * .794, radius * 2, radius * 1.588]);
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
    $('.atlas-place-card').innerHTML = `<button type="button" data-act="close-card" aria-label="Закрыть">${iconMarkup('close',18)}</button><span class="atlas-eyebrow">О КАРТЕ</span><h3>География с источником</h3><p>${map.roads.length.toLocaleString('ru-RU')} дорожных сегментов · ${(map.buildingCount || (map.buildings || []).length).toLocaleString('ru-RU')} контуров зданий · ${map.landmarks.length} достопримечательностей · ${map.parkAnchors.length} опорных точек парков.</p><p>Координаты объектов — из набора пользователя; пять точек уточнены по именованным объектам OpenStreetMap. Дороги — OpenStreetMap; вода и контуры зданий — ${sourceName}; зелёные зоны — OpenStreetMap и городской геопортал. Высота домов и движение транспорта иллюстративны. Численность населения и работа транспорта здесь не измеряются.</p><p>Историческая нагрузка не является текущим трафиком. Шесть контуров районов получены из городского GIS; дата их действия не указана. Здания загружаются участками по всей рабочей территории; при отдалении мелкие контуры скрываются. Зелёные участки взяты из картографических источников. Деревья показаны условно внутри этих участков: это визуализация озеленения, не поштучный реестр посадок.</p><a href="https://gis.esaulet.kz/server/rest/services/dop_sloi_geoportal_otkr/MapServer" target="_blank" rel="noopener noreferrer">Муниципальный источник ${iconMarkup('external',13)}</a>`;
  }

  function setupWalkable() {
    const nura = worldRegions.find(r => r.regionId === 'nura'); if (!nura) return;
    const exclusions = [...allBuildings(), ...(map.landscape || []).filter(f => /water|river|hydro/.test(f.kind))];
    const candidates = [...map.parkAnchors, ...map.landmarks].filter(f => pointInRegion(f.position, nura)).map(f => f.position);
    if (walkable?.start) candidates.unshift(walkable.start);
    candidates.push(nura.labelAnchor);
    let start = null;
    for (const candidate of candidates) { for (let i = 0; i < 40; i++) { const p = [candidate[0] + Math.cos(i * 2.4) * i * .35, candidate[1] + Math.sin(i * 2.4) * i * .35]; if (pointInRegion(p, nura) && !exclusions.some(f => pointInRegion(p, f))) { start = p; break; } } if (start) break; }
    if (!start) return;
    const localExclusions = exclusions.filter(f => { const b = regionBounds(f); return b && b.maxX > start[0] - 22 && b.minX < start[0] + 22 && b.maxY > start[1] - 22 && b.minY < start[1] + 22; });
    walkable = { start, contains: p => Math.abs(p[0] - start[0]) <= 20 && Math.abs(p[1] - start[1]) <= 20 && pointInRegion(p, nura) && !localExclusions.some(f => pointInRegion(p, f)) };
    const rings = [nura, ...localExclusions].flatMap(shape => shape.polygons.flat());
    walkable.canTraverse = (from, to) => walkable.contains(from) && walkable.contains(to) && !rings.some(ring => ring.some((p, i) => i > 0 && segmentsCross(from, to, ring[i - 1], p)));
    mayor = mayor && walkable.contains(mayor) ? mayor : [...start];
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
  function tick(time) { frame = null; if (!visible()) return; if (lastTime === null) lastTime = time; const elapsed = (time - lastTime) / 1000; const dt = Math.min(.1, elapsed); if (elapsed >= 1 / 30) { lastTime = time; if (!context.reducedMotion && snapshot?.playback?.status !== 'paused') movingSeconds += dt;
    if (detail() && mayor) { const dx = Number(pressed.has('ArrowRight') || pressed.has('d')) - Number(pressed.has('ArrowLeft') || pressed.has('a')); const dy = Number(pressed.has('ArrowDown') || pressed.has('s')) - Number(pressed.has('ArrowUp') || pressed.has('w')); if (dx || dy) moveMayor([mayor[0] + dx, mayor[1] + dy], dt * 1.5); else if (destination && !context.reducedMotion) moveMayor(destination, dt * 1.5); }
    // Keep playback on wall time; only actor movement is capped to avoid jumps.
    effects.step(elapsed); if (!destroyed) motion(); } schedule(); }

  function action(command) {
    if (command === 'top' || command === 'tilted') onIntent({ type: 'SET_PROJECTION', projection: command });
    if (command === 'zoom-in' || command === 'zoom-out') { camera.zoomAt(command === 'zoom-in' ? 1.4 : 1 / 1.4, [width / 2, height / 2]); render(); }
    if (command === 'center') focusCenter();
    if (command === 'overview') { onIntent({ type: 'SET_VIEW', view: 'overview' }); camera.reset(); render(); }
    if (command === 'sources') sources();
    if (command === 'close-card') { selected = null; inspectorSignature = ''; $('.atlas-place-card').hidden = true; render(); }
    if (command === 'retry-buildings') { buildingSource?.retry(); refreshBuildings(); }
    if (command === 'walk' && walkable) { onIntent({ type: 'FOCUS_REGION', regionId: 'nura' }); onIntent({ type: 'SET_VIEW', view: 'district' }); }
  }
  listen(container, 'click', event => {
    const button = event.target.closest('button');
    if (!button || !visible()) return;
    if (button.dataset.act) action(button.dataset.act);
    if (button.dataset.place) focusFeature(button.dataset.place);
    if (button.dataset.layer) { const name = button.dataset.layer; enabled[name] = !enabled[name]; button.setAttribute('aria-pressed', String(enabled[name])); if (name === 'landmarks') renderPlaces(); else layers[name].setAttribute('display', enabled[name] ? '' : 'none'); if (name === 'vegetation') { layers.parks.setAttribute('display', enabled[name] ? '' : 'none'); } if (name === 'buildings') { if (enabled.buildings) refreshBuildings(); else $('.atlas-building-status').hidden = true; } }
  });
  const point = event => { const box = stage.getBoundingClientRect(); return [event.clientX - box.left, event.clientY - box.top]; };
  listen(stage, 'pointerdown', event => { if (!visible() || event.button !== 0) return; const p = point(event); drag = { id: event.pointerId, start: p, last: p, moved: false, featureId: event.target.closest('[data-feature-id]')?.dataset.featureId, junctionId: event.target.closest('[data-junction-id]')?.dataset.junctionId }; stage.setPointerCapture?.(event.pointerId); stage.focus({ preventScroll: true }); });
  listen(stage, 'pointermove', event => { if (!visible() || !drag || drag.id !== event.pointerId) return; const p = point(event); if (distance(p, drag.start) > 6) drag.moved = true; if (drag.moved) { camera.pan(p[0] - drag.last[0], p[1] - drag.last[1]); render(); } drag.last = p; });
  listen(stage, 'pointerup', event => { if (!visible() || !drag || drag.id !== event.pointerId) return; const last = drag; drag = null; if (stage.hasPointerCapture?.(event.pointerId)) stage.releasePointerCapture(event.pointerId); if (last.moved) return;
    if (last.featureId) { selectedCorridor = null; highlightRoads(); selected = last.featureId; renderInspector(); render(); }
    else if (last.junctionId) showJunction(last.junctionId);
    else if (detail() && walkable) { const p = camera.unproject(point(event)); if (walkable.contains(p)) { destination = p; if (context.reducedMotion) moveMayor(p, distance(mayor, p)); motion(); } }
    else { const p = camera.unproject(point(event)), region = worldRegions.find(r => pointInRegion(p, r)); if (region) onIntent({ type: 'FOCUS_REGION', regionId: region.regionId }); }
  });
  listen(stage, 'pointercancel', () => { drag = null; });
  listen(stage, 'wheel', event => { if (!visible() || (!event.ctrlKey && !event.metaKey)) return; event.preventDefault(); camera.zoomAt(Math.exp(-event.deltaY * .003), point(event)); render(); }, { passive: false });
  listen(container, 'keydown', event => { if (event.key === 'Escape') { $('.atlas-place-card').hidden = true; selected = null; inspectorSignature = ''; } });
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
      const hud = $('.atlas-game-hud'); if (hud) observer.observe(hud);
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
    destroy() { if (destroyed) return; destroyed = true; stop(); clearTimeout(buildingTimer); buildingSource?.destroy(); pressed.clear(); if (drag && stage.hasPointerCapture?.(drag.id)) stage.releasePointerCapture(drag.id); drag = null; listeners.forEach(fn => fn()); observer.disconnect(); effects.destroy(); mapLife.destroy(); mapFeedback.destroy(); artNodes.clear(); container.remove(); if (mounts.get(root) === api) mounts.delete(root); },
    getDiagnostics() { return { frames, averageMotionRenderMs: frames ? totalRenderMs / frames : 0, actorCount: vehicles.length + mapLife.getDiagnostics().count, mapLife: mapLife.getDiagnostics(), mapFeedback: mapFeedback.getDiagnostics(), visible: visible(), running: frame !== null, destroyed, camera: camera.getState(), mayor: mayor ? [...mayor] : null, selected, loadedBuildings: allBuildings().length, renderedBuildings: renderedBuildingCount, buildingTiles: buildingSource?.getState(), effects: effects.getState(), data: { roads: map.roads.length, buildings: map.buildingCount || (map.buildings || []).length, landmarks: map.landmarks.length, regions: worldRegions.length }, missingAssetIds: [...missingArt], artNodeCount: artNodes.size }; },
  };
  mounts.set(root, api);
  return api;
}
