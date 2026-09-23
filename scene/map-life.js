import { regionBounds, segmentsCross } from './camera.js';
import { actorArt } from '../game/art.js';

const NS = 'http://www.w3.org/2000/svg';
export const CITIZEN_LIMITS = Object.freeze({ paths: 1800, desktop: 320, mobile: 140, minSize: 8, maxSize: 18 });
const LIMIT = CITIZEN_LIMITS.paths;
const point = value => Array.isArray(value) && value.every(Number.isFinite) && value.length === 2;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const middle = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const indexedShapes = new WeakMap();
// Reuse vertical edge buckets for dense source polygons. Point tests remain exact;
// no simplified coastline or approximate district geometry enters collision checks.
function contains(point, shape) {
  let polygons = indexedShapes.get(shape);
  if (!polygons) {
    polygons = (shape.polygons || []).map(polygon => polygon.map(ring => {
      const minY = Math.min(...ring.map(p => p[1])), maxY = Math.max(...ring.map(p => p[1]));
      const height = Math.max(maxY - minY, 1e-9), buckets = Array.from({ length: 64 }, () => []);
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j], b = ring[i], from = Math.max(0, Math.floor((Math.min(a[1], b[1]) - minY) / height * 63));
        const to = Math.min(63, Math.floor((Math.max(a[1], b[1]) - minY) / height * 63));
        for (let bucket = from; bucket <= to; bucket++) buckets[bucket].push([a, b]);
      }
      return { minY, maxY, height, buckets };
    }));
    indexedShapes.set(shape, polygons);
  }
  const [x, y] = point;
  const inRing = ring => {
    if (y < ring.minY || y > ring.maxY) return false;
    let inside = false;
    for (const [a, b] of ring.buckets[Math.max(0, Math.min(63, Math.floor((y - ring.minY) / ring.height * 63)))]) {
      const dx = b[0] - a[0], dy = b[1] - a[1], cross = (x - a[0]) * dy - (y - a[1]) * dx;
      if (Math.abs(cross) <= 1e-9 * Math.max(1, Math.abs(dx), Math.abs(dy)) && x >= Math.min(a[0], b[0]) - 1e-9 && x <= Math.max(a[0], b[0]) + 1e-9 && y >= Math.min(a[1], b[1]) - 1e-9 && y <= Math.max(a[1], b[1]) + 1e-9) return true;
      if ((a[1] > y) !== (b[1] > y) && x < a[0] + (y - a[1]) * dx / dy) inside = !inside;
    }
    return inside;
  };
  return polygons.some(([outer, ...holes]) => outer && inRing(outer) && !holes.some(inRing));
}
const intersects = (a, b, shape) => shape.polygons?.some(polygon => polygon.some(ring =>
  ring.some((p, i) => i > 0 && Math.max(a[0], b[0]) >= Math.min(p[0], ring[i - 1][0])
    && Math.min(a[0], b[0]) <= Math.max(p[0], ring[i - 1][0])
    && Math.max(a[1], b[1]) >= Math.min(p[1], ring[i - 1][1])
    && Math.min(a[1], b[1]) <= Math.max(p[1], ring[i - 1][1])
    && segmentsCross(a, b, ring[i - 1], p))));
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
    if (!point(a) || !point(b) || distance(a, b) < .2) return;
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
      if (length < .6) continue;
      const unit = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
      const mid = middle(a, b), half = Math.min(1.1, length * .35);
      for (const side of [-1, 1]) {
        const offset = [-unit[1] * .18 * side, unit[0] * .18 * side];
        candidate(mid.map((v, axis) => v - unit[axis] * half + offset[axis]),
          mid.map((v, axis) => v + unit[axis] * half + offset[axis]), 'roadside');
      }
    }
  }
  // Park anchors receive a few short routes only where a mapped green polygon contains them.
  const parks = (map.landscape || []).filter(f => !/water|river|hydro/.test(f.kind)).map(shape => ({ shape, bounds: regionBounds(shape) }));
  for (const anchor of map.parkAnchors || []) {
    if (!point(anchor.position)) continue;
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      const mid = anchor.position.map((v, axis) => v + (axis ? Math.sin(angle) : Math.cos(angle)) * 4);
      const a = [mid[0] - 1.5, mid[1] - .5], b = [mid[0] + 1.5, mid[1] + .5];
      if (parks.some(({shape, bounds}) => boundsOverlap(a, b, bounds) && contains(a, shape) && contains(b, shape) && !intersects(a, b, shape))) candidate(a, b, 'park');
    }
  }
  // Bound expensive polygon checks before route selection. Road geometry can contain
  // tens of thousands of vertices; checking every candidate blocked initial paint.
  raw.sort((a, b) => a.centerDistance - b.centerDistance);
  const anchors = [...(map.parkAnchors || []), ...(map.landmarks || [])].filter(anchor => point(anchor.position));
  const pools = regionShapes.map(({ shape, bounds }) => {
    const nearby = anchors.filter(anchor => boundsOverlap(anchor.position, anchor.position, bounds) && contains(anchor.position, shape))
      .sort((a, b) => distance(a.position, center) - distance(b.position, center));
    const anchor = nearby[0]?.position || shape.labelAnchor || center;
    return raw.filter(item => boundsOverlap(item.midpoint, item.midpoint, bounds))
      .sort((a, b) => distance(a.midpoint, anchor) - distance(b.midpoint, anchor)).slice(0, 1800)
      .map(item => ({ ...item, region: shape }));
  });
  const ordered = pools.length ? Array.from({ length: 1800 }, (_, index) => pools.map(pool => pool[index]).filter(Boolean)).flat() : raw;
  const cells = new Set();
  let checked = 0;
  for (const item of ordered) {
    if (checked >= 9000 || candidates.length >= LIMIT) break;
    const { a, b, midpoint } = item;
    const cell = `${Math.floor(midpoint[0] * 3)}:${Math.floor(midpoint[1] * 3)}`;
    if (cells.has(cell)) continue;
    checked++;
    const region = item.region;
    if (regions.length && (!region || !contains(midpoint, region) || !contains(a, region) || !contains(b, region) || intersects(a, b, region))) continue;
    if (exclusions.some(({ shape, bounds }) => boundsOverlap(a, b, bounds)
      && (contains(a, shape) || contains(b, shape) || intersects(a, b, shape)))) continue;
    cells.add(cell);
    candidates.push({ a, b, midpoint, source: item.source, regionId: region?.regionId || null });
  }
  // The pool remains round-robin across regions; the renderer selects the current viewport.
  return candidates;
}

/** React to authoritative indicator deltas only; never infer scores or economic outcomes. */
export function getCitizenReaction(effects = {}) {
  const deltas = Object.values(effects).filter(value => Number.isFinite(value));
  const positive = deltas.some(value => value > 0), negative = deltas.some(value => value < 0);
  return positive && negative ? 'mixed' : positive ? 'positive' : negative ? 'negative' : 'neutral';
}

/** A reusable node pool: viewport selection controls density; no census correspondence. */
export function createMapLife({ layer, map, regions = map.regions || [] }) {
  const doc = layer.ownerDocument || document;
  const el = (tag, attributes = {}) => {
    const node = doc.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  };
  const root = el('g', { class: 'atlas-citizens', 'aria-hidden': 'true', 'pointer-events': 'none', 'data-illustrative': 'true' });
  layer.appendChild(root);
  const paths = buildWalkingPaths(map, regions);
  let destroyed = false, visibleCount = 0, movingCount = 0, signature = '', selected = [], spriteSize = 8;
  const people = Array.from({ length: Math.min(paths.length, CITIZEN_LIMITS.desktop) }, (_, index) => {
    const node = el('g', { class: 'atlas-citizen', 'data-reaction': 'neutral', display: 'none' });
    const kind = index % 29 === 28 ? 'emergency' : index % 13 === 12 ? 'worker' : `citizen-0${index % 3 + 1}`;
    const sprite = el('image', { href: actorArt(kind).href, x: -8, y: -15.5, width: 16, height: 16,
      preserveAspectRatio: 'xMidYMid meet', class: 'atlas-citizen-art', display: '' });
    // Only a few representative reactions appear, keeping streets and labels readable.
    const bubble = el('g', { display: 'none', transform: 'translate(5 -19) scale(.65)' });
    const bubbleBody = el('path', { d: 'M-4 -4H4Q6 -4 6 -2V2Q6 4 4 4H0L-3 6V4H-4Q-6 4 -6 2V-2Q-6 -4 -4 -4Z', fill: '#faf8e7', stroke: '#6b8e79', 'stroke-width': .8 });
    const symbol = el('path', { d: '', fill: 'none', stroke: '#4e8664', 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    bubble.appendChild(bubbleBody); bubble.appendChild(symbol);
    node.appendChild(sprite); node.appendChild(bubble); root.appendChild(node);
    return { node, sprite, bubble, bubbleBody, symbol, phase: index * .61803398875 % 1, reaction: 'neutral' };
  });
  return {
    render({ camera, width, height, seconds = 0, reducedMotion = false, visualState, exclusions = [] } = {}) {
      if (destroyed || !camera) return;
      const time = reducedMotion || !Number.isFinite(seconds) ? 0 : seconds;
      const zoom = camera.getState?.().zoom || 1;
      spriteSize = Math.min(CITIZEN_LIMITS.maxSize, Math.max(CITIZEN_LIMITS.minSize, 6 + Math.sqrt(zoom) * 1.5));
      const nextSignature = `${camera.matrix?.().join(',') || JSON.stringify(camera.getState?.())}|${width}|${height}|${exclusions.map(b => [b.x,b.y,b.w,b.h].join(',')).join(';')}`;
      if (signature !== nextSignature) {
        signature = nextSignature;
        const limit = Math.min(width < 600 ? CITIZEN_LIMITS.mobile : CITIZEN_LIMITS.desktop, Math.max(20, Math.floor(width * height / 1600)));
        const cells = new Set(); selected = [];
        for (const path of paths) {
          if (selected.length >= limit) break;
          const [x, y] = camera.project(path.midpoint);
          const cell = `${Math.floor(x / (spriteSize * 1.35))}:${Math.floor(y / (spriteSize * 1.35))}`;
          if (x < 4 || x > width - 4 || y < spriteSize || y > height - 25 || cells.has(cell)) continue;
          if (exclusions.some(b => x >= b.x - 5 && x <= b.x + b.w + 5 && y >= b.y && y <= b.y + b.h + spriteSize)) continue;
          cells.add(cell); selected.push(path);
        }
        for (let i = 0; i < people.length; i++) {
          people[i].path = selected[i];
          people[i].node.setAttribute('data-region-id', selected[i]?.regionId || '');
          if (!selected[i]) people[i].node.setAttribute('display', 'none');
        }
      }
      const regionEffects = new Map((visualState?.regions || []).map(region => [region.regionId, region.effects]));
      visibleCount = 0; movingCount = 0;
      for (const [index, person] of people.entries()) {
        const { node, path, phase } = person;
        if (!path) continue;
        const cycle = (phase + time / (24 + phase * 14)) % 1;
        const fraction = cycle < .5 ? cycle * 2 : (1 - cycle) * 2;
        const position = path.a.map((value, axis) => value + (path.b[axis] - value) * fraction);
        const [x, y] = camera.project(position);
        const visible = x > 0 && x < width && y > spriteSize && y < height - 25
          && !exclusions.some(b => x >= b.x - 3 && x <= b.x + b.w + 3 && y >= b.y && y <= b.y + b.h + spriteSize);
        node.setAttribute('display', visible ? '' : 'none');
        if (!visible) continue;
        visibleCount++; if (!reducedMotion) movingCount++;
        const scale = spriteSize / 16;
        node.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(3)})`);
        const reaction = getCitizenReaction(regionEffects.get(path.regionId));
        person.bubble.setAttribute('display', reaction !== 'neutral' && index % 16 === 0 && zoom >= 5 ? '' : 'none');
        if (reaction !== person.reaction) {
          person.reaction = reaction; node.setAttribute('data-reaction', reaction);
          const color = reaction === 'positive' ? '#488269' : '#b38347';
          person.symbol.setAttribute('stroke', color); person.bubbleBody.setAttribute('stroke', color);
          person.symbol.setAttribute('d', reaction === 'positive' ? 'M-2 0L-.5 1.5L2.5 -1.5'
            : reaction === 'mixed' ? 'M-3 0H0M-1.5 -1.5V1.5M2 -1V.5M2 2V2.1' : 'M0 -2V.5M0 2V2.1');
        }
      }
    },
    destroy() { if (!destroyed) { root.remove(); destroyed = true; visibleCount = 0; movingCount = 0; } },
    getDiagnostics() { return { count: selected.length, actorCount: selected.length, capacity: people.length, pathCount: paths.length, spriteSize, visibleCount, movingCount, destroyed, representative: true,
      reactions: Object.fromEntries(['neutral', 'positive', 'negative', 'mixed'].map(reaction => [reaction, people.filter(person => person.path && person.reaction === reaction).length])) }; },
  };
}
