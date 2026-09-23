import { pointInRegion, regionBounds } from './camera.js';

// Exact aliases only. Normalization changes case/spacing, never transliterates,
// strips street types or guesses identity from a substring.
const ROAD_ALIASES = {
  turan: ['Тұран даңғылы', 'проспект Туран', 'просп. Туран'],
  kabanbay_batyr: ['Қабанбай Батыр даңғылы', 'проспект Кабанбай Батыра', 'проспект Кабанбай батыр', 'просп. Кабанбай батыра'],
  mangilik_el: ['Мәңгілік Ел даңғылы', 'проспект Мангилик Ел', 'просп. Мангилик Ел'],
  syganak: ['Сығанақ көшесі', 'улица Сыганак'],
  uly_dala: ['Ұлы Дала даңғылы', 'проспект Улы Дала', 'просп. Улы Дала'],
  korgalzhyn: ['Қорғалжын тас жолы', 'Коргалжынское шоссе'],
  alash: ['Алаш тас жолы', 'шоссе Алаш'],
  respublika: ['Республика даңғылы', 'проспект Республики', 'просп. Республики'],
  bogenbay_batyr: ['Бөгенбай батыр даңғылы', 'проспект Богенбай Батыра', 'проспект Богенбай батыр', 'просп. Богенбай батыр'],
  saryarka: ['Сарыарқа даңғылы', 'проспект Сарыарка', 'просп. Сарыарка'],
  tauelsizdik: ['Тәуелсіздік даңғылы', 'проспект Тауелсиздик', 'просп. Тауелсиздик'],
  zhenis: ['Жеңіс даңғылы', 'проспект Женис'],
  tilendiev: ['Н. Тілендиев даңғылы', 'проспект Нургисы Тлендиева', 'проспект Н. Тлендиева', 'просп. Н.Тлендиева'],
  konaev: ['Дінмұхамед Қонаев көшесі', 'улица Динмухамеда Кунаева'],
  dostyk: ['Достық көшесі', 'улица Достык'],
  koshkarbayev: ['Рақымжан Қошқарбаев даңғылы', 'проспект Ракымжана Кошкарбаева'],
  abylai_khan: ['Абылай хан даңғылы', 'проспект Абылай Хана', 'проспект Абылай хан'],
  momyshuly: ['Бауыржан Момышұлы даңғылы', 'проспект Бауыржана Момышулы'],
  al_farabi: ['Әл-Фараби даңғылы', 'проспект Аль-Фараби'],
  kenesary: ['Кенесары көшесі', 'улица Кенесары'],
  beibitshilik: ['Бейбітшілік көшесі', 'улица Бейбитшилик'],
  zheltoksan: ['Желтоқсан көшесі', 'улица Желтоксан'],
  shevchenko: ['Тарас Шевченко көшесі', 'улица Тараса Шевченко'],
  auezov: ['Мұхтар Әуезов көшесі', 'улица Мухтара Ауэзова'],
  tashenov: ['Жұмабек Тәшенов көшесі', 'улица Жумабека Ташенова'],
};
const DISTRICT_ALIASES = {
  esil: ['Есиль', 'Есильский район', 'район Есиль', 'район "Есиль"', 'Есіл', 'Есіл ауданы'],
  almaty: ['Алматы', 'Алматинский район', 'район Алматы', 'район "Алматы"', 'Алматы ауданы'],
  saryarka: ['Сарыарка', 'Сарыаркинский район', 'район Сарыарка', 'район "Сарыарка"', 'Сарыарқа', 'Сарыарқа ауданы'],
  baikonur: ['Байконур', 'Байконурский район', 'район Байконур', 'район "Байконур"', 'Байқоңыр', 'Байқоңыр ауданы'],
  nura: ['Нура', 'Нуринский район', 'район Нура', 'Нұра', 'Нұра ауданы'],
  saraishyk: ['Сарайшық', 'Сарайшык', 'район Сарайшық', 'район Сарайшык', 'Сарайшық ауданы'],
};
const DISTRICT_LABELS = { esil: 'Есиль', almaty: 'Алматы', saryarka: 'Сарыарка', baikonur: 'Байконур', nura: 'Нура', saraishyk: 'Сарайшық' };
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const normal = value => typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase() : '';
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const point = value => Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]);
const lonLat = value => point(value) && value[0] >= -180 && value[0] <= 180 && value[1] > -90 && value[1] < 90;
const url = value => text(value) && /^https?:\/\//.test(value) ? value : null;
const aliases = entries => new Map(Object.entries(entries).flatMap(([id, names]) => names.map(name => [normal(name), id])));

function properties(feature) { return feature?.properties && typeof feature.properties === 'object' ? feature.properties : {}; }
function identifier(feature) {
  const p = properties(feature);
  const id = feature?.id ?? p.id ?? p.OBJECTID ?? p.objectid ?? p.FID ?? p.fid;
  return typeof id === 'string' && id.trim() || typeof id === 'number' && Number.isFinite(id) ? String(id) : null;
}
function provenance(feature, collection) {
  const p = properties(feature);
  const source = text(p.source) || text(collection?.source);
  const sourceUrl = url(p.source_url) || url(p.sourceUrl) || url(collection?.source_url);
  const sourceIds = [...new Set(list(p.sourceIds).filter(value => typeof value === 'string'))];
  if (!sourceIds.length && (p.source_id || p.sourceId || sourceUrl)) sourceIds.push(String(p.source_id || p.sourceId || sourceUrl));
  return { source, sourceUrl, sourceIds };
}

function segmentDistance(point, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length)) : 0;
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
}

/** World-coordinate tolerance, including road endpoints; no bounding-box-only hit. */
export function hitTestRoad(position, road, tolerance = 6) {
  if (!point(position) || !Number.isFinite(tolerance) || tolerance < 0 || !Array.isArray(road?.points)) return false;
  for (let index = 1; index < road.points.length; index++) {
    const a = road.points[index - 1], b = road.points[index];
    if (point(a) && point(b) && segmentDistance(position, a, b) <= tolerance) return true;
  }
  return false;
}

// Select an actual interior location, never the naive centroid of a concave
// polygon or a hole. Source district geometries are retained without reshaping.
function interiorAnchor(polygons, viewBox) {
  const shape = { polygons };
  const bounds = regionBounds(shape);
  if (!bounds) return null;
  const minX = Math.max(0, bounds.minX), maxX = Math.min(viewBox[2], bounds.maxX);
  const minY = Math.max(0, bounds.minY), maxY = Math.min(viewBox[3], bounds.maxY);
  const center = [(minX + maxX) / 2, (minY + maxY) / 2];
  if (pointInRegion(center, shape)) return center;
  let best = null, clearance = -1;
  for (let x = 0; x < 28; x++) for (let y = 0; y < 28; y++) {
    const candidate = [minX + (x + 0.5) * (maxX - minX) / 28, minY + (y + 0.5) * (maxY - minY) / 28];
    if (!pointInRegion(candidate, shape)) continue;
    let nearest = Infinity;
    for (const polygon of polygons) for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
      nearest = Math.min(nearest, segmentDistance(candidate, ring[i - 1], ring[i]));
    }
    if (nearest > clearance) { best = candidate; clearance = nearest; }
  }
  return best;
}

/**
 * Adapt supplied WGS84 datasets into a single aspect-correct local equirectangular
 * space. No network, geographic reconstruction, district allocation or counts.
 * Public coordinate helpers reject points outside the working bbox. Intersecting
 * source lines/polygons retain their true outer vertices, including outside the
 * viewport, to avoid inventing clipped outlines or connecting separated parts.
 */
export function createGeoData({ seed, landmarks, parks, roads, intersections, landscape, trafficCorridors, majorRoads, districts, buildings, landmarkPositions } = {}) {
  const bounds = seed?.working_bbox?.value;
  if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite)
    || !lonLat(bounds.slice(0, 2)) || !lonLat(bounds.slice(2)) || bounds[0] >= bounds[2] || bounds[1] >= bounds[3]) {
    throw new TypeError('Geographic data requires a valid [west,south,east,north] working bbox.');
  }
  const [west, south, east, north] = bounds;
  const latitude = (south + north) / 2;
  const cosine = Math.cos(latitude * Math.PI / 180);
  const scale = 1000 / ((east - west) * cosine);
  const height = (north - south) * scale;
  const viewBox = [0, 0, 1000, height];
  const inside = coordinate => lonLat(coordinate) && coordinate[0] >= west && coordinate[0] <= east && coordinate[1] >= south && coordinate[1] <= north;
  const project = coordinate => [(coordinate[0] - west) * cosine * scale, (north - coordinate[1]) * scale];
  const projectLonLat = coordinate => inside(coordinate) ? project(coordinate) : null;
  const unprojectWorld = coordinate => point(coordinate) && coordinate[0] >= 0 && coordinate[0] <= 1000 && coordinate[1] >= 0 && coordinate[1] <= height
    ? [west + coordinate[0] / (cosine * scale), north - coordinate[1] / scale] : null;
  const centerCoordinates = [seed?.center?.lon, seed?.center?.lat];
  const center = projectLonLat(centerCoordinates) || [500, height / 2];
  const sourceStatus = {};
  const diagnostics = {};

  function features(collection, layer) {
    const valid = collection?.type === 'FeatureCollection' && Array.isArray(collection.features);
    sourceStatus[layer] = collection == null ? 'missing' : !valid ? 'invalid' : collection.features.length ? 'provided' : 'empty';
    diagnostics[layer] = { accepted: 0, rejected: 0 };
    return valid ? collection.features : [];
  }
  function take(collection, layer, adapt) {
    const result = [], seen = new Set();
    for (const feature of features(collection, layer)) {
      const id = identifier(feature);
      const adapted = id && !seen.has(id) ? adapt(feature, id) : null;
      if (!adapted) { diagnostics[layer].rejected++; continue; }
      seen.add(id); diagnostics[layer].accepted++;
      result.push(...(Array.isArray(adapted) ? adapted : [adapted]));
    }
    return result;
  }
  function anchorCollection(collection, layer, category) {
    return take(collection, layer, (feature, id) => {
      const original = feature.geometry?.coordinates;
      if (feature.geometry?.type !== 'Point' || !inside(original)) return null;
      const correction = layer === 'landmarks' && landmarkPositions?.schemaVersion === 1 ? list(landmarkPositions.positions).find(item => item.id === id && inside(item.coordinates) && /^https:\/\/www\.openstreetmap\.org\/(way|node)\/\d+$/.test(item.sourceUrl) && item.originalCoordinates?.length === 2 && item.originalCoordinates.every((n, i) => n === original[i])) : null;
      const coordinate = correction?.coordinates || original;
      const p = properties(feature), source = provenance(feature, collection);
      if (correction) { source.source = correction.source; source.sourceUrl = correction.sourceUrl; source.originalCoordinates = original.slice(0,2); source.coordinateCorrection = structuredClone(correction); }
      return { id, label: text(p.name) || text(p.label) || id, category: text(p.category) || category,
        importance: number(p.importance), position: project(coordinate), coordinates: coordinate.slice(0, 2), ...source };
    });
  }
  function intersects(coordinates) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const coordinate of coordinates) {
      minX = Math.min(minX, coordinate[0]); maxX = Math.max(maxX, coordinate[0]);
      minY = Math.min(minY, coordinate[1]); maxY = Math.max(maxY, coordinate[1]);
    }
    return maxX >= west && minX <= east && maxY >= south && minY <= north;
  }
  function polygonGeometry(feature) {
    const geometry = feature.geometry;
    const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates]
      : geometry?.type === 'MultiPolygon' ? geometry.coordinates : null;
    if (!Array.isArray(polygons) || !polygons.length) return null;
    for (const polygon of polygons) {
      if (!Array.isArray(polygon) || !polygon.length) return null;
      for (const ring of polygon) {
        if (!Array.isArray(ring) || ring.length < 4 || !ring.every(lonLat)
          || ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) return null;
      }
    }
    if (!intersects(polygons.flat(2))) return null;
    return polygons.map(polygon => polygon.map(ring => ring.map(project)));
  }

  const namedRoads = new Map(list(majorRoads).filter(road => text(road?.id) && text(road?.name)).map(road => [road.id, road]));
  const roadNames = aliases(ROAD_ALIASES);
  for (const road of namedRoads.values()) {
    roadNames.set(normal(road.name), road.id);
    for (const alias of list(road.aliases)) if (text(alias)) roadNames.set(normal(alias), road.id);
  }
  const roadKey = p => [p.name, p.name_ru, p.name_kk, p['name:ru'], p['name:kk']].map(name => roadNames.get(normal(name))).find(Boolean) || null;
  const adaptedRoads = take(roads, 'roads', (feature, id) => {
    const geometry = feature.geometry;
    const lines = geometry?.type === 'LineString' ? [geometry.coordinates]
      : geometry?.type === 'MultiLineString' ? geometry.coordinates : null;
    if (!Array.isArray(lines) || !lines.length || lines.some(line => !Array.isArray(line) || line.length < 2 || !line.every(lonLat))) return null;
    const p = properties(feature), key = roadKey(p), source = provenance(feature, roads);
    const parts = lines.flatMap((line, index) => intersects(line) ? [{
      id: lines.length === 1 ? id : `${id}:part:${index}`, sourceFeatureId: id,
      name: text(p.name) || text(p.name_ru) || text(p.name_kk) || null,
      kind: text(p.highway) || text(p.kind) || 'road', points: line.map(project),
      sourceIds: [...source.sourceIds], source: source.source, sourceUrl: source.sourceUrl, illustrative: false,
      importance: number(namedRoads.get(key)?.importance) ?? number(p.importance) ?? number(p.importance_weight), roadKey: key,
    }] : []);
    return parts.length ? parts : null;
  });
  const adaptedLandscape = take(landscape, 'landscape', (feature, id) => {
    const polygons = polygonGeometry(feature);
    return polygons ? { id, kind: text(properties(feature).kind) || 'landscape', polygons,
      properties: structuredClone(properties(feature)), ...provenance(feature, landscape) } : null;
  });
  const adaptedBuildings = take(buildings, 'buildings', (feature, id) => {
    const polygons = polygonGeometry(feature), p = properties(feature);
    return polygons ? { id, kind: 'building', polygons, label: text(p.NAME_OBJECT) || text(p.name),
      height: number(p.height), levels: number(p.levels) ?? number(p['building:levels']),
      properties: structuredClone(p), ...provenance(feature, buildings) } : null;
  });
  const adaptedIntersections = take(intersections, 'intersections', (feature, id) => {
    const coordinate = feature.geometry?.coordinates, p = properties(feature);
    if (feature.geometry?.type !== 'Point' || !inside(coordinate)) return null;
    return { id, position: project(coordinate), coordinates: coordinate.slice(0, 2),
      roads: [...new Set(list(p.roads).filter(name => typeof name === 'string'))],
      importance: number(p.importance_score) ?? number(p.importance), ...provenance(feature, intersections) };
  });

  const districtNames = aliases(DISTRICT_ALIASES);
  const mergedRegions = new Map();
  take(districts, 'districts', (feature, id) => {
    const p = properties(feature), name = text(p.name) || text(p.label);
    const regionId = districtNames.get(normal(name));
    const polygons = regionId ? polygonGeometry(feature) : null;
    if (!polygons) return null;
    const source = provenance(feature, districts);
    if (!mergedRegions.has(regionId)) mergedRegions.set(regionId, { regionId, label: DISTRICT_LABELS[regionId],
      status: String(districts?.metadata?.boundaryCurrency || '').startsWith('outdated') ? 'historical' : 'unverified',
      simulationDistrict: regionId === 'saraishyk' ? null : DISTRICT_LABELS[regionId], polygons: [], sourceIds: [], sourceFeatureIds: [] });
    const region = mergedRegions.get(regionId);
    region.polygons.push(...polygons);
    region.sourceIds = [...new Set([...region.sourceIds, ...source.sourceIds])];
    region.sourceFeatureIds.push(id);
    return { id };
  });
  const regions = [...mergedRegions.values()].flatMap(region => {
    const labelAnchor = interiorAnchor(region.polygons, viewBox);
    return labelAnchor ? [{ ...region, labelAnchor }] : [];
  });
  sourceStatus.districtBoundaryCurrency = text(districts?.metadata?.boundaryCurrency) || 'unknown';

  sourceStatus.corridors = trafficCorridors == null ? 'missing' : !Array.isArray(trafficCorridors) ? 'invalid' : trafficCorridors.length ? 'provided' : 'empty';
  sourceStatus.majorRoads = majorRoads == null ? 'missing' : !Array.isArray(majorRoads) ? 'invalid' : majorRoads.length ? 'provided' : 'empty';
  const corridors = list(trafficCorridors).filter(corridor => text(corridor?.id) && text(corridor?.road)).map(corridor => {
    const key = roadNames.get(normal(corridor.road)) || null;
    const roadIds = key ? adaptedRoads.filter(road => road.roadKey === key).map(road => road.id) : [];
    for (const road of adaptedRoads) if (roadIds.includes(road.id)) road.historical = true;
    return { id: corridor.id, road: corridor.road, from: text(corridor.from), to: text(corridor.to), roadKey: key, roadIds,
      historical: true, live: false, importance: number(corridor.importance_0_1), historicalLoadScore: number(corridor.historical_load_score),
      source: text(corridor.source), sourceUrl: url(corridor.source_url), periodNote: text(corridor.period_note),
      resolution: roadIds.length ? 'road-only' : 'unresolved', segmentResolved: false,
      unresolvedEndpoints: [text(corridor.from), text(corridor.to)].filter(Boolean),
      note: 'Исторический показатель. Точный участок между конечными точками не установлен; это не текущая загруженность.' };
  });

  return { viewBox, projectLonLat, unprojectWorld, center, geographic: true, bounds: [...bounds],
    landmarks: anchorCollection(landmarks, 'landmarks', 'landmark'), parkAnchors: anchorCollection(parks, 'parks', 'park'),
    roads: adaptedRoads, landscape: adaptedLandscape, buildings: adaptedBuildings, regions,
    intersections: adaptedIntersections, corridors, sourceStatus, diagnostics };
}
