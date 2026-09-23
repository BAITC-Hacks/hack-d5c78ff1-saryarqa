/**
 * Bounded illustrative activity, driven exclusively by the scene's clock.
 * Nothing in this module reads or changes policies, engine data, or scores.
 */
export const ACTOR_CAPS = Object.freeze({ people: 24, cars: 10, buses: 4, lrt: 1 });

const DEFINITIONS = Object.freeze({
  people: { kind: 'person', metric: 'population', divisor: 25000, fallback: 8,
    speed: 0.027, paths: ['walking', 'pedestrian', 'footpath'],
    assets: ['unit.citizen.01', 'unit.citizen.02', 'unit.citizen.03'] },
  cars: { kind: 'car', metric: 'registered_cars', divisor: 10000, fallback: 4,
    speed: 0.075, paths: ['road', 'car', 'traffic'], assets: ['vehicle.car'] },
  buses: { kind: 'bus', metric: 'daily_active_buses', divisor: 100, fallback: 2,
    speed: 0.06, paths: ['bus', 'bus-route'], assets: ['vehicle.bus'] },
  lrt: { kind: 'lrt', metric: null, divisor: null, fallback: 1,
    speed: 0.085, paths: ['lrt', 'lrt-scenario', 'rail'], assets: ['vehicle.lrt'] },
});

const finitePoint = (point) => Array.isArray(point) && point.length >= 2
  && Number.isFinite(point[0]) && Number.isFinite(point[1]);
const copyPoint = (point) => [point[0], point[1]];
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const clamp = (number, min, max) => Math.max(min, Math.min(max, number));
const heading = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI;
const snapshotActor = ({ id, assetId, kind, position, heading: rotation }) => ({
  id, assetId, kind, position: copyPoint(position), heading: rotation,
});

function hashFraction(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    if (!finitePoint(a) || !finitePoint(b)) continue;
    const cross = (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0]);
    if (Math.abs(cross) < 1e-7
      && point[0] >= Math.min(a[0], b[0]) && point[0] <= Math.max(a[0], b[0])
      && point[1] >= Math.min(a[1], b[1]) && point[1] <= Math.max(a[1], b[1])) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1])
      && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function inRegion(point, region) {
  return Array.isArray(region?.polygons) && region.polygons.some((polygon) => (
    Array.isArray(polygon) && polygon.length > 0 && pointInRing(point, polygon[0])
      && !polygon.slice(1).some((ring) => pointInRing(point, ring))
  ));
}

function preparePath(path, geography) {
  if (!path || typeof path.id !== 'string' || !Array.isArray(path.points)
    || path.points.length < 2 || !path.points.every(finitePoint)) return null;
  // The boolean is explicit: omitted metadata cannot silently become a real route.
  const sourceIds = Array.isArray(path.sourceIds) ? path.sourceIds.filter((id) => typeof id === 'string') : [];
  const sourced = path.illustrative === false && geography.status === 'verified' && sourceIds.length > 0;
  if (path.illustrative !== true && !sourced) return null;
  const points = path.points.map(copyPoint);
  const segments = [];
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const segmentLength = distance(points[index - 1], points[index]);
    if (segmentLength === 0) continue;
    segments.push({ from: points[index - 1], to: points[index], start: length, length: segmentLength });
    length += segmentLength;
  }
  if (!length) return null;
  return { id: path.id, kind: path.kind, sourceIds, illustrative: path.illustrative === true,
    points, segments, length, closed: distance(points[0], points.at(-1)) < 1e-7 };
}

function samplePath(path, progress) {
  const period = path.closed ? path.length : 2 * path.length;
  const wrapped = ((progress % period) + period) % period;
  const backwards = !path.closed && wrapped > path.length;
  const along = backwards ? period - wrapped : wrapped;
  const segment = path.segments.find((entry) => along <= entry.start + entry.length) || path.segments.at(-1);
  const fraction = clamp((along - segment.start) / segment.length, 0, 1);
  return {
    position: [segment.from[0] + (segment.to[0] - segment.from[0]) * fraction,
      segment.from[1] + (segment.to[1] - segment.from[1]) * fraction],
    heading: heading(segment.from, segment.to) + (backwards ? 180 : 0),
  };
}

function matchingObservation(cityData, metric, regionId) {
  if (!metric || !Array.isArray(cityData?.observations)) return null;
  const candidates = cityData.observations.filter((observation) => observation.metric === metric
    && observation.regionId === regionId).slice().sort((a, b) => String(b.asOf || '').localeCompare(String(a.asOf || '')));
  // Preserve the most recent observation even when it is unknown: do not substitute stale certainty.
  const observation = candidates[0];
  if (!observation) return null;
  const source = cityData.sources?.find((entry) => entry.id === observation.sourceId);
  const usable = observation.status === 'verified' && Number.isFinite(observation.value)
    && observation.value >= 0 && typeof observation.asOf === 'string' && observation.asOf.length > 0
    && typeof observation.definition === 'string' && observation.definition.length > 0
    && source && typeof source.url === 'string' && /^https?:\/\//.test(source.url);
  return {
    id: observation.id ?? null, metric, regionId, value: usable ? observation.value : null,
    reportedValue: Number.isFinite(observation.value) ? observation.value : null,
    unit: observation.unit ?? null, asOf: observation.asOf ?? null,
    status: observation.status ?? 'unavailable', usable: Boolean(usable),
    sourceId: observation.sourceId ?? null, definition: observation.definition ?? null,
    note: observation.note ?? null,
    source: source ? { id: source.id, publisher: source.publisher ?? null, url: source.url ?? null } : null,
  };
}

/**
 * Units are world coordinates; headings are degrees for SVG rotation.
 * `walkable.contains` describes the decorative Nura navigation mask. The mayor
 * stops at obstacles (there is deliberately no pathfinding or building physics).
 * The host owns requestAnimationFrame and calls step only while visible.
 */
export function createActors({ geography = {}, walkable = {} } = {}) {
  const worldBounds = Array.isArray(geography.viewBox) ? geography.viewBox : [0, 0, 1000, 1000];
  const scale = Math.max(1, Math.min(Number(worldBounds[2]) || 1000, Number(worldBounds[3]) || 1000));
  const paths = (Array.isArray(geography.paths) ? geography.paths : []).map((path) => preparePath(path, geography)).filter(Boolean);
  const detailedRegion = geography.regions?.find((region) => region.regionId === 'nura');
  const bounds = Array.isArray(walkable.bounds) && walkable.bounds.length === 4
    && walkable.bounds.every(Number.isFinite) ? walkable.bounds : worldBounds;
  const movementScale = Math.max(1, Math.min(bounds[2], bounds[3]));
  // Short steps prevent a frame delay or a held key from jumping across buildings.
  const maximumMovementStep = Math.max(0.05, Math.min(0.5, movementScale / 800));
  const mayorSpeed = movementScale * 0.16;
  const contains = (point) => finitePoint(point) && typeof walkable.contains === 'function'
    && point[0] >= bounds[0] && point[0] <= bounds[0] + bounds[2]
    && point[1] >= bounds[1] && point[1] <= bounds[1] + bounds[3]
    && Boolean(walkable.contains(point));
  const start = finitePoint(walkable.start) && contains(walkable.start) ? copyPoint(walkable.start) : null;
  const mayor = start ? { id: 'mayor', assetId: 'unit.mayor', kind: 'mayor', position: start, heading: 0 } : null;
  let destroyed = false;
  let reducedMotion = false;
  let view = 'overview';
  let focusedRegion = null;
  let cityData = null;
  let destination = null;
  let actors = [];
  let mappings = [];
  let signature = '';
  const detailed = () => view === 'district' && focusedRegion === 'nura';

  function rebuild() {
    const scope = detailed() ? 'nura' : 'city';
    const nextMappings = Object.entries(DEFINITIONS).map(([group, definition]) => {
      // LRT is always a scenario sample, even if a real-service observation exists.
      const availablePaths = paths.filter((path) => definition.paths.includes(path.kind)
        && (group !== 'lrt' || path.illustrative)
        && (!detailed() || path.points.some((point) => inRegion(point, detailedRegion))));
      const observation = matchingObservation(cityData, definition.metric, scope);
      const known = Boolean(observation?.usable);
      const eligiblePaths = known ? availablePaths : availablePaths.filter((path) => path.illustrative);
      const count = eligiblePaths.length === 0 ? 0 : known
        ? Math.min(ACTOR_CAPS[group], Math.ceil(observation.value / definition.divisor))
        : Math.min(ACTOR_CAPS[group], definition.fallback);
      return {
        group, kind: definition.kind, scope, metric: definition.metric, observation,
        // City observations are context only in close-up, never district allocations.
        cityObservation: scope === 'nura' ? matchingObservation(cityData, definition.metric, 'city') : null,
        observedCount: known ? observation.value : null,
        count, cap: ACTOR_CAPS[group], unitsPerSprite: definition.divisor,
        densityFunction: definition.metric ? `min(${ACTOR_CAPS[group]}, ceil(value / ${definition.divisor}))` : null,
        mode: known ? 'capped-source-sample' : 'illustrative-unknown-count',
        label: group === 'lrt' ? 'Сценарий LRT: иллюстрация, не действующий маршрут'
          : known ? 'Условная выборка; движение не является наблюдением в реальном времени'
            : 'Декоративная выборка; фактическое количество неизвестно',
        fallbackCount: definition.fallback, paths: eligiblePaths,
      };
    });
    const nextSignature = JSON.stringify(nextMappings.map(({ group, scope, count, paths: selectedPaths }) => (
      [group, scope, count, selectedPaths.map((path) => path.id)]
    )));
    mappings = nextMappings;
    if (nextSignature === signature) return;
    signature = nextSignature;
    const previous = new Map(actors.map((actor) => [actor.id, actor]));
    actors = [];
    for (const mapping of mappings) {
      const definition = DEFINITIONS[mapping.group];
      for (let index = 0; index < mapping.count; index += 1) {
        const path = mapping.paths[index % mapping.paths.length];
        const id = `${mapping.group}:${path.id}:${index}`;
        const old = previous.get(id);
        const progress = old?.progress ?? hashFraction(id) * path.length;
        actors.push({ id, assetId: definition.assets[index % definition.assets.length],
          kind: definition.kind, path, progress, speed: definition.speed * scale,
          ...samplePath(path, progress) });
      }
    }
  }

  function advanceMayor(target, maximumDistance) {
    if (!mayor || !target || maximumDistance <= 0) return false;
    const remaining = distance(mayor.position, target);
    if (remaining < 1e-8) return false;
    const travel = Math.min(remaining, maximumDistance);
    const from = copyPoint(mayor.position);
    const dx = (target[0] - from[0]) / remaining;
    const dy = (target[1] - from[1]) / remaining;
    const steps = Math.ceil(travel / maximumMovementStep);
    let blocked = false;
    for (let index = 1; index <= steps; index += 1) {
      const amount = travel * index / steps;
      const candidate = [from[0] + dx * amount, from[1] + dy * amount];
      if (!contains(candidate)) { blocked = true; break; }
      mayor.position = candidate;
    }
    if (distance(from, mayor.position) > 1e-8) mayor.heading = heading(from, mayor.position);
    if (blocked || distance(mayor.position, target) < 1e-8) destination = null;
    return distance(from, mayor.position) > 1e-8;
  }

  rebuild();
  return {
    update(options = {}) {
      if (destroyed) return;
      if ('cityData' in options) cityData = options.cityData;
      if ('reducedMotion' in options) reducedMotion = Boolean(options.reducedMotion);
      if ('view' in options) view = options.view === 'district' ? 'district' : 'overview';
      if ('focusedRegion' in options) focusedRegion = options.focusedRegion;
      if (!detailed()) destination = null;
      rebuild();
    },
    step(deltaSeconds) {
      if (destroyed || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
      // A resumed tab never advances by the entire hidden interval.
      const delta = Math.min(deltaSeconds, 0.1);
      if (!reducedMotion) {
        for (const actor of actors) {
          actor.progress += actor.speed * delta;
          Object.assign(actor, samplePath(actor.path, actor.progress));
        }
        if (detailed() && destination) advanceMayor(destination, mayorSpeed * delta);
      }
    },
    getActors() {
      if (destroyed) return [];
      return actors.filter((actor) => !detailed() || inRegion(actor.position, detailedRegion)).map(snapshotActor);
    },
    getMayor() {
      return !destroyed && detailed() && mayor ? snapshotActor(mayor) : null;
    },
    setDestination(point) {
      if (destroyed || !detailed() || !mayor || !contains(point)) return false;
      destination = copyPoint(point);
      // With reduced motion, an explicit destination is applied immediately but
      // still checked along the complete segment, so it cannot cross obstacles.
      if (reducedMotion) advanceMayor(destination, distance(mayor.position, destination));
      return true;
    },
    moveMayor(dx, dy, deltaSeconds) {
      if (destroyed || !detailed() || !mayor || !Number.isFinite(dx) || !Number.isFinite(dy)
        || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return false;
      const magnitude = Math.hypot(dx, dy);
      if (magnitude === 0) return false;
      destination = null;
      const travel = mayorSpeed * Math.min(deltaSeconds, 0.1);
      return advanceMayor([mayor.position[0] + dx / magnitude * travel,
        mayor.position[1] + dy / magnitude * travel], travel);
    },
    getMetadata() {
      return {
        schemaVersion: 1, destroyed, caps: { ...ACTOR_CAPS }, headingUnit: 'degrees',
        scope: detailed() ? 'nura' : 'city', reducedMotion,
        representativeSamples: true, liveTraffic: false,
        navigation: { kind: 'illustrative-walkable-mask', district: 'nura',
          available: Boolean(mayor) && !destroyed, obstacleBehavior: 'stop', maximumMovementStep },
        mappings: mappings.map(({ paths: selectedPaths, ...mapping }) => ({
          ...mapping,
          renderedCount: destroyed ? 0 : actors.filter((actor) => actor.kind === mapping.kind
            && (!detailed() || inRegion(actor.position, detailedRegion))).length,
          paths: selectedPaths.map((path) => ({ id: path.id, kind: path.kind,
            illustrative: path.illustrative, sourceIds: [...path.sourceIds] })),
          observation: mapping.observation ? structuredClone(mapping.observation) : null,
          cityObservation: mapping.cityObservation ? structuredClone(mapping.cityObservation) : null,
        })),
      };
    },
    destroy() {
      destroyed = true;
      actors = [];
      destination = null;
    },
  };
}
