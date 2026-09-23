// All scene geometry remains in the geography file's planar world space.
// Only this camera maps it to viewport pixels. SVG labels can use project()
// individually to stay upright while map paths use matrix().
const PROJECTIONS = {
  top: [1, 0, 0, 1],
  tilted: [1, 0.24, -0.35, 0.65],
};
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;
const FIT_RATIO = 0.9;

const isPoint = (point) => Array.isArray(point)
  && Number.isFinite(point[0]) && Number.isFinite(point[1]);
const clampZoom = (zoom) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
const polygonsOf = (region) => Array.isArray(region) ? region : region?.polygons ?? [];

// 0 = outside; 1 = inside; 2 = boundary. Ring winding is immaterial.
function ringContains(point, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const start = ring[j];
    const end = ring[i];
    if (!isPoint(start) || !isPoint(end)) continue;
    const [ax, ay] = start;
    const [bx, by] = end;
    const dx = bx - ax;
    const dy = by - ay;
    const epsilon = 1e-9;
    const cross = (x - ax) * dy - (y - ay) * dx;
    if (Math.abs(cross) <= epsilon * Math.max(1, Math.abs(dx), Math.abs(dy))
      && x >= Math.min(ax, bx) - epsilon && x <= Math.max(ax, bx) + epsilon
      && y >= Math.min(ay, by) - epsilon && y <= Math.max(ay, by) + epsilon) return 2;
    if ((ay > y) !== (by > y) && x < ax + ((y - ay) * dx) / dy) inside = !inside;
  }
  return inside ? 1 : 0;
}

/** Includes outer boundaries, excludes holes and their boundaries. */
export function pointInRegion(point, region) {
  if (!isPoint(point)) return false;
  return polygonsOf(region).some((polygon) => Array.isArray(polygon)
    && ringContains(point, polygon[0]) !== 0
    && !polygon.slice(1).some((hole) => ringContains(point, hole) !== 0));
}

/** Bounds cover every polygon part. Empty geometry has no bounds. */
export function regionBounds(region) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polygon of polygonsOf(region)) {
    for (const ring of polygon ?? []) {
      for (const point of ring ?? []) {
        if (!isPoint(point)) continue;
        minX = Math.min(minX, point[0]);
        minY = Math.min(minY, point[1]);
        maxX = Math.max(maxX, point[0]);
        maxY = Math.max(maxY, point[1]);
      }
    }
  }
  return Number.isFinite(minX)
    ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY, minX, minY, maxX, maxY }
    : null;
}

/** Render with fill-rule="evenodd" to preserve holes regardless of winding. */
export function polygonsToPath(region) {
  const commands = [];
  for (const polygon of polygonsOf(region)) {
    for (const ring of polygon ?? []) {
      const points = (ring ?? []).filter(isPoint);
      if (points.length < 3) continue;
      commands.push(`M${points.map(([x, y]) => `${x},${y}`).join('L')}Z`);
    }
  }
  return commands.join(' ');
}

function readBounds(bounds) {
  if (!bounds) return null;
  const [x, y, width, height] = Array.isArray(bounds)
    ? bounds
    : [bounds.x ?? bounds.minX, bounds.y ?? bounds.minY,
      bounds.width ?? bounds.maxX - bounds.minX, bounds.height ?? bounds.maxY - bounds.minY];
  return [x, y, width, height].every(Number.isFinite) && width >= 0 && height >= 0
    ? { x, y, width, height } : null;
}

function dimension(value) {
  if (!Number.isFinite(value)) throw new TypeError('Camera viewport dimensions must be finite');
  // A temporarily collapsed panel still has an invertible camera.
  return Math.max(1, value);
}

/**
 * A DOM-free affine camera. viewBox is [x, y, width, height]. Pan and zoom
 * anchors use viewport pixels; center is world coordinates. Zoom is relative
 * to fitting the whole viewBox. Resizing/projection changes retain that center.
 */
export function createCamera({ viewBox = [0, 0, 1000, 1000], width = 1000,
  height = 700, projection = 'top' } = {}) {
  const world = readBounds(viewBox);
  if (!world || world.width <= 0 || world.height <= 0) {
    throw new TypeError('Camera viewBox must have finite coordinates and positive dimensions');
  }
  if (!Object.hasOwn(PROJECTIONS, projection)) throw new RangeError('Unknown camera projection');
  let viewportWidth = dimension(width);
  let viewportHeight = dimension(height);
  let currentProjection = projection;
  let center = [world.x + world.width / 2, world.y + world.height / 2];
  let zoom = 1;

  function fitScale(bounds) {
    const [a, b, c, d] = PROJECTIONS[currentProjection];
    const projectedWidth = Math.abs(a) * bounds.width + Math.abs(c) * bounds.height;
    const projectedHeight = Math.abs(b) * bounds.width + Math.abs(d) * bounds.height;
    return FIT_RATIO * Math.min(viewportWidth / Math.max(projectedWidth, 1e-9),
      viewportHeight / Math.max(projectedHeight, 1e-9));
  }

  function matrix() {
    const scale = fitScale(world) * zoom;
    const [a, b, c, d] = PROJECTIONS[currentProjection].map((value) => value * scale);
    return [a, b, c, d, viewportWidth / 2 - a * center[0] - c * center[1],
      viewportHeight / 2 - b * center[0] - d * center[1]];
  }

  function project(point) {
    const [a, b, c, d, e, f] = matrix();
    return [a * point[0] + c * point[1] + e, b * point[0] + d * point[1] + f];
  }

  function unproject(point) {
    const [a, b, c, d, e, f] = matrix();
    const determinant = a * d - b * c;
    const x = point[0] - e;
    const y = point[1] - f;
    return [(d * x - c * y) / determinant, (a * y - b * x) / determinant];
  }

  const api = {
    project,
    unproject,
    matrix,
    getState() {
      return { projection: currentProjection, width: viewportWidth, height: viewportHeight,
        viewBox: [world.x, world.y, world.width, world.height], center: [...center],
        zoom, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, scale: fitScale(world) * zoom };
    },
    setViewport(nextWidth, nextHeight) {
      const w = dimension(nextWidth);
      const h = dimension(nextHeight);
      viewportWidth = w;
      viewportHeight = h;
      return api;
    },
    setProjection(nextProjection) {
      if (!Object.hasOwn(PROJECTIONS, nextProjection)) throw new RangeError('Unknown camera projection');
      currentProjection = nextProjection;
      return api;
    },
    pan(dx, dy) {
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return api;
      center = unproject([viewportWidth / 2 - dx, viewportHeight / 2 - dy]);
      return api;
    },
    zoomAt(factor, anchor = [viewportWidth / 2, viewportHeight / 2]) {
      if (!Number.isFinite(factor) || factor <= 0 || !isPoint(anchor)) return api;
      const before = unproject(anchor);
      zoom = clampZoom(zoom * factor);
      const after = unproject(anchor);
      center = [center[0] + before[0] - after[0], center[1] + before[1] - after[1]];
      return api;
    },
    reset() {
      center = [world.x + world.width / 2, world.y + world.height / 2];
      zoom = 1;
      return api;
    },
    focus(bounds) {
      const target = readBounds(bounds);
      if (!target) return api;
      center = [target.x + target.width / 2, target.y + target.height / 2];
      zoom = clampZoom(fitScale(target) / fitScale(world));
      return api;
    },
  };
  return api;
}
