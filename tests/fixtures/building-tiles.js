export const buildingSeed = { working_bbox: { value: [71.2, 51, 71.8, 51.4] }, center: { lon: 71.5, lat: 51.2 } };

export function buildingManifest({ populated = 16 } = {}) {
  const tiles = Array.from({ length: 16 }, (_, index) => {
    const row = Math.floor(index / 4), column = index % 4;
    const west = 71.2 + column * 0.15, south = 51 + row * 0.1;
    return { id: `r${row}-c${column}`, path: `buildings-tiles/r${row}-c${column}.geojson`,
      bbox: [west, south, west + 0.15, south + 0.1], featureCount: Number(index < populated) };
  });
  return { schemaVersion: 1, kind: 'building-tiles', featureCount: populated, tiles };
}

export function tileCollection(tile) {
  const [west, south] = tile.bbox;
  return { type: 'FeatureCollection', features: tile.featureCount ? [{ type: 'Feature', id: `building-${tile.id}`,
    properties: { name: `Building ${tile.id}`, height: 15 }, geometry: { type: 'Polygon', coordinates: [
      [[west + .02, south + .02], [west + .03, south + .02], [west + .03, south + .03], [west + .02, south + .03], [west + .02, south + .02]],
    ] } }] : [] };
}
