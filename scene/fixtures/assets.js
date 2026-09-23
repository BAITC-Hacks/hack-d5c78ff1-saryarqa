// Adapter for reviewed baseline starter SVGs. Missing assets remain missing.
const miniature = (id, symbolId) => ({ id, kind: 'world', status: 'placeholder', sourceId: 'baseline-starter',
  views: { shared: { path: 'assets/game/miniature-kit.svg', symbolId, width: 96, height: 96, anchor: [48, 82] } } });
export const assets = { schemaVersion: 1, assets: [
  miniature('building.home', 'home'), miniature('building.apartment', 'apartment'),
  miniature('building.civic', 'civic'), miniature('terrain.tree', 'tree'),
  miniature('terrain.park', 'park'), miniature('vehicle.bus', 'bus'),
  ...Array.from({ length: 14 }, (_, i) => ({ id: `measure.M${i + 1}`, kind: 'policy', status: 'placeholder', sourceId: 'baseline-starter',
    views: { shared: { path: 'assets/game/measure-icons.svg', symbolId: `M${i + 1}`, width: 32, height: 32, anchor: [16, 16] } } })),
] };
