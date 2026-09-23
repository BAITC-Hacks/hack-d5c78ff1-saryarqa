import { createCamera, pointInRegion, regionBounds, polygonsToPath } from './camera.js';
import { createWorld, REGION_COLORS } from './world.js';
import { createActors, ACTOR_CAPS } from './actors.js';
import { createEffects } from './effects.js';
import { createAtlasScene } from './atlas.js';

const NS = 'http://www.w3.org/2000/svg';
const mounted = new WeakMap();
let sceneSequence = 0;
const svg = (tag, attributes = {}, text) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text != null) node.textContent = text;
  return node;
};
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/** Synchronous v1 renderer. The host owns policies, calculations and session state. */
export function createScene({ root, assets, geography, mapData, onIntent = () => {} }) {
  if (!root?.appendChild) throw new TypeError('createScene requires a DOM root.');
  if (mapData) { mounted.get(root)?.destroy(); const atlas = createAtlasScene({ root, mapData, onIntent }); mounted.set(root, atlas); return atlas; }
  const world = createWorld(geography);
  mounted.get(root)?.destroy();
  const unique = `akim-map-${++sceneSequence}`;
  const container = document.createElement('section');
  container.className = 'akim-scene';
  container.setAttribute('aria-label', 'Интерактивная сцена города');
  container.innerHTML = `
    <div class="akim-scene-toolbar">
      <div class="akim-scene-view"><span class="akim-scene-eyebrow">ГОРОД В ТВОИХ РУКАХ</span><strong>Панорама города</strong></div>
      <div class="akim-scene-controls" role="group" aria-label="Вид карты">
        <button type="button" data-action="overview">Весь город</button><button type="button" data-action="detail">Прогулка по Нуре ↗</button>
        <span class="akim-scene-separator"></span><button type="button" data-action="top">Сверху</button><button type="button" data-action="tilted">Объём</button>
      </div>
    </div>
    <nav class="akim-scene-regions" aria-label="Выбрать район"></nav>
    <div class="akim-scene-layout"><div class="akim-scene-map-wrap">
      <div class="akim-scene-map" tabindex="0" role="group" aria-label="Карта. Стрелки перемещают камеру. В прогулке стрелки или WASD перемещают акима." aria-describedby="${unique}-help">
        <svg class="akim-scene-svg" aria-label="Шесть районов города" role="img"><defs><pattern id="${unique}-context" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M-2 2 2-2M0 10 10 0M8 12 12 8" stroke="#a7a49d" stroke-width="1.5"/></pattern></defs></svg>
        <div class="akim-scene-map-note"></div><div class="akim-scene-compass" aria-hidden="true">N<span>↑</span></div>
        <div class="akim-scene-camera" role="group" aria-label="Управление камерой">
          <button type="button" data-action="zoom-in" aria-label="Приблизить">+</button><button type="button" data-action="zoom-out" aria-label="Отдалить">−</button><button type="button" data-action="reset" aria-label="Сбросить камеру">⌂</button>
          <button type="button" data-action="pan-left" aria-label="Камера влево">←</button><button type="button" data-action="pan-up" aria-label="Камера вверх">↑</button><button type="button" data-action="pan-down" aria-label="Камера вниз">↓</button><button type="button" data-action="pan-right" aria-label="Камера вправо">→</button>
        </div>
        <div class="akim-scene-map-caption"><span>● Пять районов модели</span><span>▧ Сарайшық · контекст</span></div>
      </div>
      <div class="akim-scene-timeline" aria-label="Визуальное воспроизведение"><span class="akim-scene-feedback" role="status" aria-live="polite"></span><div class="akim-scene-track"><span></span></div><small>Восемь кварталов · визуальная последовательность, без промежуточного счёта</small></div>
      <p class="akim-scene-help" id="${unique}-help">Потяни карту · Ctrl/⌘ + колесо — масштаб · стрелки — камера · Enter — осмотреть район в центре</p>
    </div><aside class="akim-scene-inspector" aria-label="Информация о районе"></aside></div>`;
  root.appendChild(container);
  const $ = selector => container.querySelector(selector);
  const stage = $('.akim-scene-map');
  const surface = $('.akim-scene-svg');
  const layers = {};
  for (const name of ['regions', 'paths', 'plaza', 'pieces', 'labels', 'actors', 'effects']) {
    layers[name] = svg('g', { class: `akim-scene-layer-${name}` });
    surface.appendChild(layers[name]);
  }
  const camera = createCamera({ viewBox: geography.viewBox, width: 900, height: 600, projection: 'top' });
  const actors = createActors({ geography, walkable: world.walkable });
  const effects = createEffects({ onComplete: planRevision => { if (!destroyed) onIntent({ type: 'PLAYBACK_COMPLETE', planRevision }); } });
  const manifest = new Map((assets?.assets || []).map(asset => [asset.id, asset]));
  const missing = new Set();
  const checkedFiles = new Map();
  const failedImages = new Set();
  const abort = new AbortController();
  const listeners = [];
  const pressed = new Set();
  let destroyed = false, snapshot = null, context = {}, frame = null, lastTime = null;
  let detail = false, previousView = null, previousProjection = null, drag = null, width = 900, height = 600;
  let frames = 0, totalRenderMs = 0, lastFeedback = '';
  const listen = (node, type, handler, options) => { node.addEventListener(type, handler, options); listeners.push(() => node.removeEventListener(type, handler, options)); };
  const visible = () => !destroyed && snapshot?.mode === 'game' && context.visible !== false && !document.hidden;
  const reportMissing = id => { if (!missing.has(id)) { missing.add(id); queueMicrotask(() => { if (!destroyed && snapshot) renderInspector(); }); } };

  function assetView(id) {
    const asset = manifest.get(id);
    const view = asset?.views?.[snapshot?.projection || 'top'] || asset?.views?.shared;
    if (!asset || asset.status === 'missing' || !view || !/^[a-zA-Z0-9_./-]+$/.test(view.path) ||
      view.path.startsWith('/') || view.path.split('/').includes('..') || !Number.isFinite(view.width) || view.width <= 0 ||
      !Number.isFinite(view.height) || view.height <= 0 || !Array.isArray(view.anchor) || !view.anchor.every(Number.isFinite)) {
      reportMissing(id); return null;
    }
    const href = new URL(view.path, new URL('../', import.meta.url)).href;
    if (failedImages.has(href)) { reportMissing(id); return null; }
    if (view.symbolId && !checkedFiles.has(href)) {
      const check = { status: 'loading', ids: new Set() };
      checkedFiles.set(href, check);
      fetch(href, { signal: abort.signal }).then(response => { if (!response.ok) throw new Error('Missing sprite'); return response.text(); })
        .then(source => { if (destroyed) return; const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
          check.ids = new Set([...parsed.querySelectorAll('[id]')].map(node => node.id)); check.status = 'ready'; render(); })
        .catch(error => { if (error.name !== 'AbortError' && !destroyed) { check.status = 'failed'; render(); } });
    }
    const check = checkedFiles.get(href);
    if (view.symbolId && (check?.status === 'failed' || (check?.status === 'ready' && !check.ids.has(view.symbolId)))) { reportMissing(id); return null; }
    return { ...view, href };
  }

  function sprite(id, position, size, label = id) {
    const [x, y] = camera.project(position);
    const group = svg('g', { transform: `translate(${x} ${y})`, 'aria-label': label });
    group.appendChild(svg('title', {}, label));
    const view = assetView(id);
    if (view) {
      const scale = size / Math.max(view.width, view.height);
      const image = svg(view.symbolId ? 'use' : 'image', { href: view.href + (view.symbolId ? `#${view.symbolId}` : ''),
        x: -view.anchor[0] * scale, y: -view.anchor[1] * scale, width: view.width * scale, height: view.height * scale });
      if (!view.symbolId) image.addEventListener('error', () => { if (!destroyed) { failedImages.add(view.href); reportMissing(id); image.replaceWith(fallback(id, size)); } }, { once: true });
      group.appendChild(image);
    } else group.appendChild(fallback(id, size));
    return group;
  }

  function fallback(id, size) {
    const group = svg('g', { 'data-fallback-id': id });
    const person = id.startsWith('unit.');
    const mayor = id === 'unit.mayor';
    const vehicle = id.startsWith('vehicle.');
    const r = Math.max(4, size * .19);
    group.appendChild(svg('ellipse', { cx: 0, cy: 1, rx: r * 1.4, ry: r * .45, fill: '#203e3225' }));
    if (person) {
      group.appendChild(svg('path', { d: `M${-r * .8},0 L${-r * .7},${-r * 2} Q0,${-r * 3} ${r * .7},${-r * 2} L${r * .8},0Z`, fill: mayor ? '#244e40' : '#c8815f', stroke: '#fff6df', 'stroke-width': 1 }));
      group.appendChild(svg('circle', { cx: 0, cy: -r * 2.8, r: r * .7, fill: '#f1cda5' }));
      if (mayor) group.appendChild(svg('text', { x: 0, y: -r * 4, 'text-anchor': 'middle', class: 'akim-scene-mayor-label' }, 'АКИМ'));
    } else {
      group.appendChild(svg('rect', { x: -r * 1.7, y: -r * (vehicle ? 1 : 2), width: r * 3.4, height: r * (vehicle ? 1 : 2), rx: 3, fill: vehicle ? '#e4b474' : '#eed9b9', stroke: '#826f51', 'stroke-width': 1 }));
      if (!vehicle) group.appendChild(svg('text', { x: 0, y: -r * .55, 'text-anchor': 'middle', 'font-size': r, fill: '#6d604a' }, '+'));
    }
    return group;
  }

  function worldScale() { const m = camera.matrix(); return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])); }
  function renderMap() {
    const matrix = `matrix(${camera.matrix().join(' ')})`;
    for (const name of ['regions', 'paths', 'plaza']) { layers[name].setAttribute('transform', matrix); layers[name].replaceChildren(); }
    for (const [index, region] of world.regions.entries()) {
      const selected = snapshot?.focusedRegion === region.regionId;
      const group = svg('g', { 'data-region-id': region.regionId });
      const attrs = { d: polygonsToPath(region), 'fill-rule': 'evenodd', 'vector-effect': 'non-scaling-stroke',
        fill: REGION_COLORS[index], stroke: selected ? '#245141' : '#f7f5ec', 'stroke-width': selected ? 3 : 2,
        opacity: detail && region.regionId !== 'nura' ? .27 : 1 };
      group.appendChild(svg('path', attrs));
      if (region.regionId === 'saraishyk') group.appendChild(svg('path', { ...attrs, fill: `url(#${unique}-context)`, stroke: 'none' }));
      layers.regions.appendChild(group);
    }
    for (const path of world.paths) {
      if (!Array.isArray(path.points) || path.points.length < 2) continue;
      if (!path.illustrative && !(geography.status === 'verified' && path.sourceIds?.length)) continue;
      layers.paths.appendChild(svg('polyline', { points: path.points.map(p => p.join(',')).join(' '), fill: 'none',
        stroke: /lrt|rail/.test(path.kind) ? '#856d56' : '#f7eed9', 'stroke-width': path.kind === 'walking' ? 4 : 7,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': path.illustrative ? '8 5' : 'none' }));
    }
    if (detail) {
      const [x, y, w, h] = world.playBounds;
      layers.plaza.appendChild(svg('rect', { x, y, width: w, height: h, rx: 8, fill: '#e6d8b7', opacity: .78 }));
      layers.plaza.appendChild(svg('path', { d: `M${x + w / 2},${y}v${h} M${x},${y + h / 2}h${w}`, fill: 'none', stroke: '#fff5dc', 'stroke-width': w * .14 }));
    }
    layers.pieces.replaceChildren();
    const scale = worldScale();
    for (const piece of world.pieces.filter(p => detail ? p.detail : !p.detail).sort((a, b) => camera.project(a.position)[1] - camera.project(b.position)[1])) {
      layers.pieces.appendChild(sprite(piece.assetId, piece.position, Math.max(14, piece.size * scale), 'Декоративный объект'));
    }
    layers.labels.replaceChildren();
    if (!detail) for (const [regionIndex, region] of world.regions.entries()) {
      const [x, y] = camera.project(region.labelAnchor);
      const group = svg('g', { transform: `translate(${x} ${y})`, class: 'akim-scene-map-label', 'data-region-id': region.regionId });
      const compact = width < 480;
      const length = compact ? 28 : Math.max(76, region.label.length * 8 + 25);
      group.appendChild(svg('title', {}, region.label));
      group.appendChild(svg('rect', { x: -length / 2, y: -16, width: length, height: 31, rx: 15, fill: '#fffef7', stroke: snapshot?.focusedRegion === region.regionId ? '#245141' : '#fffef7' }));
      group.appendChild(svg('text', { 'text-anchor': 'middle', y: 4 }, compact ? regionIndex + 1 : region.label));
      if (region.regionId === 'saraishyk' && !compact) group.appendChild(svg('text', { 'text-anchor': 'middle', y: 30, class: 'akim-scene-context-label' }, 'вне модели'));
      layers.labels.appendChild(group);
    }
  }

  function renderMotion() {
    const before = performance.now();
    layers.actors.replaceChildren();
    const scale = worldScale();
    const mayor = actors.getMayor();
    for (const actor of [...actors.getActors(), ...(mayor ? [mayor] : [])].sort((a, b) => camera.project(a.position)[1] - camera.project(b.position)[1])) {
      const size = actor.kind === 'mayor' ? 29 : actor.kind === 'person' ? 13 : 27;
      const actorSprite = sprite(actor.assetId, actor.position, Math.max(size * .65, size * Math.min(1.9, scale)), actor.kind === 'mayor' ? 'Аким: декоративное движение без изменения плана' : `Условный объект: ${actor.kind}`);
      if (['car', 'bus', 'lrt'].includes(actor.kind)) {
        const angle = actor.heading * Math.PI / 180, point = camera.project(actor.position);
        const ahead = camera.project([actor.position[0] + Math.cos(angle), actor.position[1] + Math.sin(angle)]);
        const rotation = Math.atan2(ahead[1] - point[1], ahead[0] - point[0]) * 180 / Math.PI;
        actorSprite.lastElementChild?.setAttribute('transform', `rotate(${rotation})`);
      }
      layers.actors.appendChild(actorSprite);
    }
    const state = effects.getState();
    layers.effects.replaceChildren();
    const offsets = new Map();
    for (const marker of state.markers) {
      const region = world.regions.find(r => r.regionId === marker.regionId);
      if (!region || (detail && region.regionId !== 'nura')) continue;
      const offset = offsets.get(region.regionId) || 0;
      offsets.set(region.regionId, offset + 1);
      const [x, y] = camera.project(region.labelAnchor);
      const group = svg('g', { transform: `translate(${x - 35 + offset * 31} ${y + (detail ? 64 : 43)})`, class: `akim-scene-marker akim-scene-marker-${marker.phase}` });
      group.appendChild(svg('title', {}, `${marker.measureId}: ${marker.phase === 'queued' ? 'в плане' : marker.phase === 'construction' ? 'выполнение' : 'завершено'}`));
      group.appendChild(svg('circle', { r: 15 }));
      group.appendChild(svg('text', { 'text-anchor': 'middle', y: 4 }, marker.measureId));
      layers.effects.appendChild(group);
    }
    for (const region of world.regions) {
      if (detail && region.regionId !== 'nura') continue;
      const reactions = state.reactions.filter(r => r.regionId === region.regionId);
      if (!reactions.length) continue;
      const [x, y] = camera.project(region.labelAnchor);
      const positive = reactions.some(r => r.tone === 'positive'), negative = reactions.some(r => r.tone === 'negative');
      const text = positive && negative ? '↑↓ Компромисс' : negative ? '↓ Есть ухудшения' : positive ? '↑ Улучшения' : 'Без изменений';
      const group = svg('g', { transform: `translate(${x} ${y - 42})`, class: 'akim-scene-reaction' });
      group.appendChild(svg('rect', { x: -65, y: -15, width: 130, height: 25, rx: 12, fill: negative ? '#f6dfcb' : '#dfedd6' }));
      group.appendChild(svg('text', { 'text-anchor': 'middle', y: 2 }, text)); layers.effects.appendChild(group);
    }
    const feedback = state.feedback || (snapshot?.plan?.length ? 'Решения отмечены на карте. План можно изменить.' : 'Выбери район и исследуй город.');
    if (feedback !== lastFeedback) { $('.akim-scene-feedback').textContent = feedback; lastFeedback = feedback; }
    $('.akim-scene-track > span').style.width = `${Math.max(0, Math.min(1, state.progress || 0)) * 100}%`;
    frames += 1; totalRenderMs += performance.now() - before;
  }

  function renderInspector() {
    const region = world.regions.find(r => r.regionId === snapshot?.focusedRegion);
    const observations = (context.cityData?.observations || []).filter(o => o.regionId === (region?.regionId || 'city'));
    const sources = context.cityData?.sources || [];
    const observationHtml = observations.map(o => {
      const source = sources.find(s => s.id === o.sourceId);
      const url = source?.url && /^https?:\/\//.test(source.url) ? source.url : null;
      const value = o.value === null || !Number.isFinite(o.value) ? 'Нет данных' : `${o.value.toLocaleString('ru-RU')} ${escape(o.unit)}`;
      return `<div class="akim-scene-observation"><strong>${value}</strong><span>${escape(o.definition || o.metric)}</span><small>${escape(o.asOf || 'Дата не установлена')} · ${o.status === 'verified' ? 'проверено' : 'не подтверждено'}</small>${url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(source.publisher || 'Источник')} ↗</a>` : ''}<small>${escape(o.note)}</small></div>`;
    }).join('');
    const sourceLabel = geography.status === 'verified' ? 'Геометрия: проверенный набор' : geography.status === 'fixture' ? 'Схема для разработки' : 'Геометрия не подтверждена';
    const name = region?.label || 'Город целиком';
    const metadata = actors.getMetadata();
    const sampling = (metadata.mappings || []).map(mapping => {
      const labels = { people: 'Жители', cars: 'Машины', buses: 'Автобусы', lrt: 'LRT' };
      return `<p><strong>${labels[mapping.group] || escape(mapping.group)}</strong>: ${mapping.renderedCount ?? mapping.count} условных объектов, предел ${mapping.cap}. ${escape(mapping.observation?.asOf || 'Дата не установлена')}. ${mapping.observedCount == null ? 'Количество неизвестно; декоративная выборка.' : `Наблюдение: ${mapping.observedCount.toLocaleString('ru-RU')}. Один значок на ${mapping.unitsPerSprite.toLocaleString('ru-RU')} единиц, с ограничением.`} Охват: ${mapping.scope === 'city' ? 'весь город' : 'Нура'}.</p>`;
    }).join('');
    $('.akim-scene-inspector').innerHTML = `<span class="akim-scene-eyebrow">${region ? 'РАЙОН' : 'ОБЗОР'}</span><h2>${escape(name)}</h2>
      <span class="akim-scene-badge">${region?.regionId === 'saraishyk' ? 'Контекст · без оценки' : region ? 'Участвует в модели' : '6 районов · 5 в модели'}</span>
      <p>${region?.regionId === 'saraishyk' ? 'Сарайшық доступен для осмотра. Назначение мер и общегородские эффекты сценария на него не распространяются.' : region ? 'Выбор района открывает его информацию. Решения и назначение мер выполняются в панели плана.' : 'Выбери район на карте или в списке. Начни с Нуры, чтобы прогуляться по миниатюрному кварталу.'}</p>
      ${region && region.regionId !== 'nura' ? '<p class="akim-scene-subtle">Детальная сцена пока доступна только для Нуры.</p>' : '<button type="button" data-action="detail" class="akim-scene-primary">Прогулка по Нуре ↗</button>'}
      <div class="akim-scene-divider"></div><h3>Город в цифрах</h3>${observationHtml || '<p class="akim-scene-subtle">Подтверждённые данные для выбранного района не переданы. Неизвестные значения не заменяются нулями.</p>'}
      ${region ? '<button type="button" data-action="city-context">Данные всего города</button>' : ''}
      <details><summary>Масштаб и источники</summary><p>Люди и транспорт — условные представители. Максимум: ${ACTOR_CAPS.people} жителей, ${ACTOR_CAPS.cars} машин, ${ACTOR_CAPS.buses} автобусов и ${ACTOR_CAPS.lrt} LRT. Это не численность населения или парка.</p><p>${escape(sourceLabel)}${geography.boundaryDate ? ` · ${escape(geography.boundaryDate)}` : ''}. Декоративные пути и размещение построек не подтверждают реальные адреса. Сценарная линия LRT не означает действующий маршрут.</p>${sampling}</details>
      ${missing.size ? `<details class="akim-scene-missing"><summary>Условные значки: ${missing.size}</summary><p>Нет подходящего изображения для текущего вида; показана подписанная замена.</p><small>${[...missing].map(escape).join(', ')}</small></details>` : ''}`;
  }

  function render() { if (destroyed || !snapshot) return; renderMap(); renderMotion(); }
  function resize() {
    const bounds = stage.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    width = bounds.width; height = bounds.height;
    surface.setAttribute('viewBox', `0 0 ${width} ${height}`);
    camera.setViewport(width, height); render();
  }
  function activeWork() { return visible() && (!context.reducedMotion || pressed.size > 0); }
  function schedule() { if (activeWork() && frame === null) frame = requestAnimationFrame(tick); }
  function stop() { if (frame !== null) cancelAnimationFrame(frame); frame = null; lastTime = null; }
  function tick(time) {
    frame = null;
    if (!activeWork()) { lastTime = null; return; }
    if (lastTime === null) lastTime = time;
    const elapsed = (time - lastTime) / 1000;
    if (elapsed >= 1 / 30) {
      const dt = Math.min(.1, elapsed); lastTime = time;
      const dx = Number(pressed.has('ArrowRight') || pressed.has('d')) - Number(pressed.has('ArrowLeft') || pressed.has('a'));
      const dy = Number(pressed.has('ArrowDown') || pressed.has('s')) - Number(pressed.has('ArrowUp') || pressed.has('w'));
      if (detail && (dx || dy)) actors.moveMayor(dx, dy, dt);
      actors.step(dt); effects.step(dt); if (!destroyed) renderMotion();
    }
    schedule();
  }
  function updateEffects() { effects.update({ snapshot, reducedMotion: !!context.reducedMotion, visible: visible() }); }
  function focusRegion(regionId) { onIntent({ type: 'FOCUS_REGION', regionId }); }
  function action(command) {
    if (!snapshot) return;
    if (command === 'top' || command === 'tilted') onIntent({ type: 'SET_PROJECTION', projection: command });
    else if (command === 'overview') onIntent({ type: 'SET_VIEW', view: 'overview' });
    else if (command === 'detail') { focusRegion('nura'); onIntent({ type: 'SET_VIEW', view: 'district' }); }
    else if (command === 'city-context') focusRegion(null);
    else {
      if (command === 'reset') { camera.reset(); if (detail) camera.focus(regionBounds(world.detailedRegion)); }
      if (command === 'zoom-in') camera.zoomAt(1.25, [width / 2, height / 2]);
      if (command === 'zoom-out') camera.zoomAt(.8, [width / 2, height / 2]);
      const pan = { 'pan-left': [80, 0], 'pan-right': [-80, 0], 'pan-up': [0, 80], 'pan-down': [0, -80] }[command];
      if (pan) camera.pan(...pan); render();
    }
  }
  listen(container, 'click', event => {
    const button = event.target.closest('button');
    if (!button || !container.contains(button)) return;
    if (button.dataset.region) focusRegion(button.dataset.region); else if (button.dataset.action) action(button.dataset.action);
  });
  const localPoint = event => { const rect = stage.getBoundingClientRect(); return [event.clientX - rect.left, event.clientY - rect.top]; };
  listen(stage, 'pointerdown', event => {
    if (!visible() || event.button !== 0 || event.target.closest('button')) return;
    stage.focus({ preventScroll: true });
    const point = localPoint(event); drag = { id: event.pointerId, start: point, last: point, moved: false };
    stage.setPointerCapture?.(event.pointerId);
  });
  listen(stage, 'pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const point = localPoint(event);
    if (Math.hypot(point[0] - drag.start[0], point[1] - drag.start[1]) > 6) drag.moved = true;
    if (drag.moved) { camera.pan(point[0] - drag.last[0], point[1] - drag.last[1]); render(); }
    drag.last = point;
  });
  listen(stage, 'pointerup', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const clicked = !drag.moved; drag = null;
    if (stage.hasPointerCapture?.(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    if (!clicked) return;
    const point = camera.unproject(localPoint(event));
    if (detail) { actors.setDestination(point); renderMotion(); schedule(); }
    else { const region = world.regions.find(r => pointInRegion(point, r)); if (region) focusRegion(region.regionId); }
  });
  listen(stage, 'pointercancel', () => { drag = null; });
  listen(stage, 'wheel', event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault(); camera.zoomAt(Math.exp(-event.deltaY * .003), localPoint(event)); render();
  }, { passive: false });
  listen(stage, 'keydown', event => {
    if (!visible() || event.target !== stage || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] }[key];
    if (direction) {
      event.preventDefault();
      if (detail && !event.shiftKey) { if (!pressed.has(key)) actors.moveMayor(...direction, 1 / 30); pressed.add(key); renderMotion(); schedule(); }
      else { camera.pan(-direction[0] * 36, -direction[1] * 36); render(); }
    } else if (key === '+' || key === '=') { event.preventDefault(); action('zoom-in'); }
    else if (key === '-') { event.preventDefault(); action('zoom-out'); }
    else if (key === 'Home') { event.preventDefault(); action('reset'); }
    else if (key === 'Enter') { const point = camera.unproject([width / 2, height / 2]); const region = world.regions.find(r => pointInRegion(point, r)); if (region) focusRegion(region.regionId); }
  });
  listen(stage, 'keyup', event => pressed.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
  listen(stage, 'blur', () => pressed.clear());
  listen(document, 'visibilitychange', () => { if (!snapshot) return; pressed.clear(); updateEffects(); stop(); schedule(); });
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  observer?.observe(stage);
  if (!observer) listen(window, 'resize', resize);
  const api = {
    update(input) {
      if (destroyed) return;
      if (input?.snapshot?.contractVersion !== 1) throw new TypeError('Unsupported scene contract version.');
      snapshot = input.snapshot; context = input.context || {};
      detail = snapshot.view === 'district' && snapshot.focusedRegion === 'nura';
      actors.update({ cityData: context.cityData, reducedMotion: !!context.reducedMotion, view: detail ? 'district' : 'overview', focusedRegion: snapshot.focusedRegion });
      const nextView = detail ? 'nura' : 'overview';
      if (!visible() || nextView !== previousView) pressed.clear();
      if (snapshot.projection !== previousProjection) { camera.setProjection(snapshot.projection); previousProjection = snapshot.projection; }
      if (nextView !== previousView) { if (detail) camera.focus(regionBounds(world.detailedRegion)); else camera.reset(); previousView = nextView; }
      container.dataset.reducedMotion = String(!!context.reducedMotion);
      container.dataset.visible = String(visible());
      $('.akim-scene-view strong').textContent = detail ? 'Нура · прогулка по кварталу' : 'Панорама города';
      if (!$('.akim-scene-regions').children.length) $('.akim-scene-regions').innerHTML = world.regions.map((region, index) => `<button type="button" data-region="${region.regionId}"><span class="akim-scene-region-number" aria-hidden="true">${index + 1}</span>${escape(region.label)}${region.regionId === 'saraishyk' ? '<span>контекст</span>' : ''}</button>`).join('');
      for (const button of container.querySelectorAll('[data-region]')) button.setAttribute('aria-pressed', String(snapshot.focusedRegion === button.dataset.region));
      for (const button of container.querySelectorAll('[data-action="top"], [data-action="tilted"]')) button.setAttribute('aria-pressed', String(button.dataset.action === snapshot.projection));
      $('.akim-scene-map-note').textContent = geography.status === 'verified' ? 'Миниатюрная сцена · декоративные объекты' : 'Тестовая схема · не реальные границы Астаны';
      $('.akim-scene-help').textContent = detail ? 'Клик / касание — идти · стрелки / WASD — аким · Shift + стрелки — камера · движение не меняет план' : 'Потяни карту · Ctrl/⌘ + колесо — масштаб · стрелки — камера · Enter — осмотреть район в центре';
      if (!activeWork()) stop();
      updateEffects(); renderInspector(); resize(); schedule();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; stop(); pressed.clear(); drag = null; abort.abort(); observer?.disconnect();
      listeners.forEach(remove => remove()); actors.destroy(); effects.destroy(); container.remove();
      if (mounted.get(root) === api) mounted.delete(root);
    },
    // Read-only diagnostics for acceptance/performance checks; no session mutation.
    getDiagnostics() { return { frames, averageMotionRenderMs: frames ? totalRenderMs / frames : 0, actorCount: actors.getActors().length,
      missingAssetIds: [...missing], visible: visible(), running: frame !== null, destroyed, camera: camera.getState(),
      mayor: actors.getMayor(), effects: effects.getState(), metadata: actors.getMetadata() }; },
  };
  mounted.set(root, api);
  return api;
}
