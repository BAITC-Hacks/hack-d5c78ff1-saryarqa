import { pointInRegion, regionBounds, segmentsCross } from './camera.js';
import { actorArt } from '../game/art.js';

const NS = 'http://www.w3.org/2000/svg';
const LIMIT = 32;
const COLORS = ['#c36b4f', '#477eaa', '#b28b35', '#698553', '#956e9f', '#459a96'];
const SKIN = ['#e7b788', '#bf885f', '#f1c8a4', '#996a49'];
const point = value => Array.isArray(value) && value.every(Number.isFinite) && value.length === 2;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const middle = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const intersects = (a, b, shape) => shape.polygons?.some(polygon => polygon.some(ring =>
  ring.some((p, i) => i > 0 && segmentsCross(a, b, ring[i - 1], p))));
const boundsOverlap = (a, b, bounds) => bounds && Math.max(a[0], b[0]) >= bounds.minX
  && Math.min(a[0], b[0]) <= bounds.maxX && Math.max(a[1], b[1]) >= bounds.minY
  && Math.min(a[1], b[1]) <= bounds.maxY;

/** Decorative routes only: neither real pedestrian activity nor measured footfall. */
export function buildWalkingPaths(map, regions = map.regions || []) {
  const exclusions = [...(map.buildings || []), ...(map.landscape || []).filter(f => /water|river|hydro/.test(f.kind))]
    .map(shape => ({ shape, bounds: regionBounds(shape) })).filter(item => item.bounds);
  const center = point(map.center) ? map.center : [500, 350];
  const candidates = [], raw = [];
  const regionShapes = regions.map(shape => ({ shape, bounds: regionBounds(shape) }));
  function candidate(a, b, source) {
    if (!point(a) || !point(b) || distance(a, b) < .5) return;
    const midpoint = middle(a, b);
    raw.push({ a, b, midpoint, source, centerDistance: distance(midpoint, center) });
  }
  // Short segments beside mapped roads; offset is illustrative, not a sidewalk dataset.
  for (const road of map.roads || []) {
    if (/motorway|trunk/.test(road.kind)) continue;
    for (let i = 1; i < (road.points?.length || 0); i++) {
      const a = road.points[i - 1], b = road.points[i];
      if (!point(a) || !point(b)) continue;
      const length = distance(a, b);
      if (length < 2) continue;
      const unit = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
      const mid = middle(a, b), half = Math.min(4, length * .35);
      for (const side of [-1, 1]) {
        const offset = [-unit[1] * .8 * side, unit[0] * .8 * side];
        candidate(mid.map((v, axis) => v - unit[axis] * half + offset[axis]),
          mid.map((v, axis) => v + unit[axis] * half + offset[axis]), 'roadside');
      }
    }
  }
  // Park anchors receive a few short routes only where a mapped green polygon contains them.
  const parks = (map.landscape || []).filter(f => !/water|river|hydro/.test(f.kind));
  for (const anchor of map.parkAnchors || []) {
    if (!point(anchor.position)) continue;
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      const mid = anchor.position.map((v, axis) => v + (axis ? Math.sin(angle) : Math.cos(angle)) * 4);
      const a = [mid[0] - 1.5, mid[1] - .5], b = [mid[0] + 1.5, mid[1] + .5];
      if (parks.some(park => pointInRegion(a, park) && pointInRegion(b, park) && !intersects(a, b, park))) candidate(a, b, 'park');
    }
  }
  // Bound expensive polygon checks before route selection. Road geometry can contain
  // tens of thousands of vertices; checking every candidate blocked initial paint.
  raw.sort((a, b) => a.centerDistance - b.centerDistance);
  const anchors = [...(map.parkAnchors || []), ...(map.landmarks || [])].filter(anchor => point(anchor.position));
  const pools = regionShapes.map(({ shape, bounds }) => {
    const nearby = anchors.filter(anchor => boundsOverlap(anchor.position, anchor.position, bounds) && pointInRegion(anchor.position, shape))
      .sort((a, b) => distance(a.position, center) - distance(b.position, center));
    const anchor = nearby[0]?.position || shape.labelAnchor || center;
    return raw.filter(item => boundsOverlap(item.midpoint, item.midpoint, bounds))
      .sort((a, b) => distance(a.midpoint, anchor) - distance(b.midpoint, anchor)).slice(0, 48)
      .map(item => ({ ...item, region: shape }));
  });
  const ordered = pools.length ? Array.from({ length: 48 }, (_, index) => pools.map(pool => pool[index]).filter(Boolean)).flat() : raw;
  let checked = 0;
  for (const item of ordered) {
    if (checked >= 256 || candidates.length >= 96) break;
    const { a, b, midpoint } = item;
    if (candidates.some(other => distance(other.midpoint, midpoint) < 3)) continue;
    checked++;
    const region = item.region;
    if (regions.length && (!region || !pointInRegion(midpoint, region) || !pointInRegion(a, region) || !pointInRegion(b, region) || intersects(a, b, region))) continue;
    if (exclusions.some(({ shape, bounds }) => boundsOverlap(a, b, bounds)
      && (pointInRegion(a, shape) || pointInRegion(b, shape) || intersects(a, b, shape)))) continue;
    candidates.push({ a, b, midpoint, source: item.source, regionId: region?.regionId || null });
  }
  const result = [], used = new Set();
  const regionIds = [...new Set(candidates.map(item => item.regionId))];
  // Round robin keeps small districts represented without tying people count to population.
  for (let pass = 0; pass < LIMIT && result.length < LIMIT; pass++) {
    let added = false;
    for (const regionId of regionIds) {
      const item = candidates.find(candidate => candidate.regionId === regionId && !used.has(candidate)
        && result.every(other => distance(other.midpoint, candidate.midpoint) > 6));
      if (!item) continue;
      used.add(item); result.push(item); added = true;
      if (result.length === LIMIT) break;
    }
    if (!added) break;
  }
  return result;
}

/** React to authoritative indicator deltas only; never infer scores or economic outcomes. */
export function getCitizenReaction(effects = {}) {
  const deltas = Object.values(effects).filter(value => Number.isFinite(value));
  const positive = deltas.some(value => value > 0), negative = deltas.some(value => value < 0);
  return positive && negative ? 'mixed' : positive ? 'positive' : negative ? 'negative' : 'neutral';
}

/** Owns a bounded, persistent SVG subtree. The atlas owns timing and visibility. */
export function createMapLife({ layer, map, regions = map.regions || [] }) {
  const doc = layer.ownerDocument || document;
  const el = (tag, attributes = {}) => {
    const node = doc.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  };
  const root = el('g', { class: 'atlas-citizens', 'aria-hidden': 'true', 'pointer-events': 'none' });
  layer.appendChild(root);
  const paths = buildWalkingPaths(map, regions);
  let destroyed = false, visibleCount = 0, movingCount = 0;
  const people = paths.map((path, index) => {
    const node = el('g', { class: 'atlas-citizen', 'data-region-id': path.regionId || '', 'data-reaction': 'neutral' });
    const shadow = el('ellipse', { cy: .5, rx: 3.5, ry: 1.2, fill: '#304b45', opacity: .2 });
    const figure = el('g');
    const legs = el('path', { d: 'M-1 -4L-1.4 0M1 -4L1.4 0', fill: 'none', stroke: '#344c59', 'stroke-width': 1.5, 'stroke-linecap': 'round' });
    const arms = el('path', { d: 'M-2 -8L-3 -4M2 -8L3 -4', fill: 'none', stroke: SKIN[index % SKIN.length], 'stroke-width': 1.2, 'stroke-linecap': 'round' });
    const body = el('path', { d: index % 3 ? 'M-2 -9Q0 -10 2 -9L2 -4L-2 -4Z' : 'M-1.7 -9Q0 -10 1.7 -9L2.8 -3.5L-2.8 -3.5Z', fill: COLORS[index % COLORS.length], stroke: '#fffae8', 'stroke-width': .4 });
    const head = el('circle', { cy: -11, r: 2, fill: SKIN[index % SKIN.length] });
    const hair = el('path', { d: 'M-2 -11Q-2.4 -14 0 -13.3Q2.4 -13.2 2 -10.8L1 -12L-1.2 -11.7Z', fill: index % 5 === 0 ? '#bdad91' : '#4b4138' });
    const art = actorArt(`citizen-0${index % 3 + 1}`, 'tilted');
    const sprite = el('image', { href: art.href, x: -21, y: -40.6875, width: 42, height: 42,
      preserveAspectRatio: 'xMidYMid meet', display: 'none', class: 'atlas-citizen-art' });
    const bubble = el('g', { display: 'none', transform: 'translate(5 -15)' });
    const bubbleBody = el('path', { d: 'M-4 -4H4Q6 -4 6 -2V2Q6 4 4 4H0L-3 6V4H-4Q-6 4 -6 2V-2Q-6 -4 -4 -4Z', fill: '#faf8e7', stroke: '#6b8e79', 'stroke-width': .8 });
    const symbol = el('path', { d: '', fill: 'none', stroke: '#4e8664', 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    bubble.appendChild(bubbleBody); bubble.appendChild(symbol);
    for (const child of [legs, arms, body, head, hair]) figure.appendChild(child);
    for (const child of [shadow, figure, sprite, bubble]) node.appendChild(child);
    root.appendChild(node);
    return { node, figure, sprite, legs, arms, bubble, bubbleBody, symbol, path, phase: index * .61803398875 % 1, reaction: 'neutral' };
  });
  return {
    render({ camera, width, height, seconds = 0, reducedMotion = false, visualState } = {}) {
      if (destroyed || !camera) return;
      const time = reducedMotion || !Number.isFinite(seconds) ? 0 : seconds;
      const regionEffects = new Map((visualState?.regions || []).map(region => [region.regionId, region.effects]));
      visibleCount = 0; movingCount = 0;
      const scale = Math.min(1.35, Math.max(.86, .8 + (camera.getState?.().zoom || 1) * .06));
      const useArt = (camera.getState?.().zoom || 1) >= 5;
      for (const person of people) {
        const { node, path, phase } = person;
        const cycle = (phase + time / (24 + phase * 14)) % 1;
        const fraction = cycle < .5 ? cycle * 2 : (1 - cycle) * 2;
        const position = path.a.map((value, axis) => value + (path.b[axis] - value) * fraction);
        const [x, y] = camera.project(position);
        const visible = x > -15 && x < width + 15 && y > -15 && y < height + 25;
        node.setAttribute('display', visible ? '' : 'none');
        if (!visible) continue;
        visibleCount++;
        if (!reducedMotion) movingCount++;
        node.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(2)})`);
        const gait = reducedMotion ? 0 : Math.sin(time * 5 + phase * 6.28);
        person.figure.setAttribute('display', useArt ? 'none' : '');
        person.sprite.setAttribute('display', useArt ? '' : 'none');
        person.sprite.setAttribute('transform', `translate(0 ${(-Math.abs(gait) * .5).toFixed(2)})`);
        person.bubble.setAttribute('transform', useArt ? 'translate(10 -39)' : 'translate(5 -15)');
        person.figure.setAttribute('transform', `translate(0 ${(-Math.abs(gait) * .35).toFixed(2)})`);
        person.legs.setAttribute('d', `M-1 -4L${(-1.3 + gait).toFixed(2)} 0M1 -4L${(1.3 - gait).toFixed(2)} 0`);
        person.arms.setAttribute('d', `M-2 -8L-3 ${(-4 - gait).toFixed(2)}M2 -8L3 ${(-4 + gait).toFixed(2)}`);
        const reaction = getCitizenReaction(regionEffects.get(path.regionId));
        if (reaction !== person.reaction) {
          person.reaction = reaction; node.setAttribute('data-reaction', reaction);
          person.bubble.setAttribute('display', reaction === 'neutral' ? 'none' : '');
          const color = reaction === 'positive' ? '#488269' : '#b38347';
          person.symbol.setAttribute('stroke', color); person.bubbleBody.setAttribute('stroke', color);
          person.symbol.setAttribute('d', reaction === 'positive' ? 'M-2 0L-.5 1.5L2.5 -1.5'
            : reaction === 'mixed' ? 'M-3 0H0M-1.5 -1.5V1.5M2 -1V.5M2 2V2.1' : 'M0 -2V.5M0 2V2.1');
        }
      }
    },
    destroy() { if (!destroyed) { root.remove(); destroyed = true; visibleCount = 0; movingCount = 0; } },
    getDiagnostics() { return { count: people.length, actorCount: people.length, visibleCount, movingCount, destroyed, representative: true,
      reactions: Object.fromEntries(['neutral', 'positive', 'negative', 'mixed'].map(reaction => [reaction, people.filter(person => person.reaction === reaction).length])) }; },
  };
}
