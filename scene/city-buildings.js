import { regionBounds, polygonsToPath } from './camera.js';
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs) => { const node = document.createElementNS(NS, tag); for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value); return node; };
const linePath = points => points?.length ? 'M' + points.map(p => p.join(',')).join('L') : '';
// All visible source polygons are batched; full-city snapshots have no feature-count cap.
export function buildCityBuildings(buildings, projection) {
  const paths = [];
    // Heights are illustrative; footprints remain the municipal geometry.
    const [a, b, c, d] = projection === 'top' ? [1, 0, 0, 1] : [1, .24, -.35, .65];
    const determinant = a * d - b * c;
    const roofs = [], walls = [];
    for (const building of buildings) {
      for (const polygon of building.polygons || []) {
        const ring = polygon[0]; if (!ring || ring.length < 4) continue;
        const bounds = regionBounds({ polygons: [polygon] });
        const h = projection === 'top' ? 0 : Math.min(2.8, Math.max(.35, Math.sqrt(bounds.width * bounds.height) * .6));
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
      if(walls.length) paths.push(el('path',{d:walls.slice(i,i+128).join(' '),fill:'#cdd2d3',stroke:'#bbc2c4','stroke-width':.07}));
      paths.push(el('path',{d:roofs.slice(i,i+128).join(' '),fill:'#edf0f0',stroke:'#cdd3d5','stroke-width':.12,'fill-rule':'evenodd'}));
    }

  return paths;
}
