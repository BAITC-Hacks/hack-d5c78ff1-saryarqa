// One optical family for the city interface: 24px, rounded 1.65px strokes.
// These are interface symbols, separate from the geographically placed models.
const paths = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".7" fill="currentColor" stroke="none"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  external: '<path d="M13 4h7v7m0-7-10 10M9 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-4"/>',
  expand: '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>',
  locate: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  north: '<path d="m12 3-7 17 7-4 7 4Z"/><path d="M12 3v13l7 4Z" fill="currentColor" stroke="none" opacity=".45"/>',
  buildings: '<path d="M4 21V8l8-4v17M12 10l8-3v14M2 21h20M7.5 9v1m0 3v1m0 3v1m8.5-7v1m0 3v1"/><path d="M4 8 12 4v17H4Z" fill="currentColor" opacity=".1" stroke="none"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  leaf: '<path d="M20 3c-2 1-7 0-11 3-5 3-5 10 0 12 6 3 12-4 11-15Z" fill="currentColor" opacity=".14" stroke="none"/><path d="M20 3c-2 1-7 0-11 3-5 3-5 10 0 12 6 3 12-4 11-15ZM4 21 16 9m-7 7v-5m3 2h5"/>',
  traffic: '<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>',
  labels: '<path d="m3 19 6-14 6 14M5 14h8m4-2c4-2 5 0 5 2v5m0-4c-7-2-6 6 0 3"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3ZM9 3v15m6-12v15"/>',
  cube: '<path d="m12 3 9 5v9l-9 5-9-5V8Zm0 10 9-5M12 13 3 8m9 5v9"/><path d="m12 13 9-5v9l-9 5Z" fill="currentColor" opacity=".12" stroke="none"/>',
  route: '<circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M7.5 6H16a4 4 0 0 1 0 8H8a2 2 0 0 0 0 4h8.5"/>',
  train: '<rect x="5" y="3" width="14" height="15" rx="4"/><path d="M5 11h14M12 3v8M8 18l-3 3m11-3 3 3M8 21h8"/><path d="M8 14h1m6 0h1"/>',
  plane: '<path d="m10 10-7 4v3l7-2v4l-2 2h8l-2-2v-4l7 2v-3l-7-4V5c0-4-4-4-4 0Z"/>',
  culture: '<path d="m3 8 9-5 9 5ZM5 10v8m5-8v8m4-8v8m5-8v8M3 21h18M4 18h16"/>',
  school: '<path d="M3 5c4-1 6 0 9 2 3-2 5-3 9-2v14c-4-1-6 0-9 2-3-2-5-3-9-2Zm9 2v14"/>',
  sport: '<ellipse cx="12" cy="7" rx="9" ry="4"/><path d="M3 7v9c0 6 18 6 18 0V7M7 11v6m5-5v6m5-7v6"/>',
  dome: '<path d="M6 12a6 6 0 0 1 12 0ZM12 3v3M6 14v7m12-7v7M3 21h18M3 8v13M21 8v13"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  health: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/>',
  services: '<path d="M4 5h16v12H9l-5 4Zm4 4h8m-8 4h5"/>',
  play: '<path d="m8 4 12 8-12 8Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14m8-14v14" stroke-width="3"/>',
  replay: '<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};

export function iconMarkup(name, size = 20) {
  return `<svg class="atlas-icon" xmlns="http://www.w3.org/2000/svg" width="${Number(size) || 20}" height="${Number(size) || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.pin}</svg>`;
}
export const categoryIcon = category => ({ culture:'culture', government:'culture', religion:'dome', university:'school', sport:'sport', transport:'train', business:'buildings', park_anchor:'leaf' }[category] || 'pin');
