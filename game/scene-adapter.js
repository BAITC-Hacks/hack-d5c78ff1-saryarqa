import { REGIONS } from './contracts.js';

const EMPTY_CITY = Object.freeze({ schemaVersion: 1, sources: [], observations: [] });

/** Only mount the other owners' module when its public resources are ready. */
export async function loadScenePackage({ fetchImpl = fetch, loadModule = () => import('../scene/index.js'), signal } = {}) {
  const json = async (path) => {
    const response = await fetchImpl(path, { signal });
    if (!response.ok) throw new Error(`RESOURCE_UNAVAILABLE:${path}`);
    return response.json();
  };
  const capabilities = await json('/api/capabilities');
  if (!capabilities.scene || !capabilities.assets || !capabilities.geography) {
    const cityData = capabilities.cityData ? await json('/data/city/context.json') : EMPTY_CITY;
    return { ready: false, reason: 'awaiting-resources', cityData: cityData?.schemaVersion === 1 && Array.isArray(cityData.observations) ? cityData : EMPTY_CITY };
  }
  const [assets, geography, cityData] = await Promise.all([
    json('/assets/game/manifest.json'), json('/data/geography/astana.json'),
    capabilities.cityData ? json('/data/city/context.json') : EMPTY_CITY,
  ]);
  if (assets.schemaVersion !== 1 || !Array.isArray(assets.assets)) throw new Error('INVALID_ASSETS');
  if (geography.schemaVersion !== 1 || geography.status !== 'verified' || !Array.isArray(geography.regions)) return { ready: false, reason: 'awaiting-verified-geography', cityData };
  if (REGIONS.some((region) => geography.regions.filter((item) => item.regionId === region.regionId && item.simulationDistrict === region.simulationDistrict).length !== 1) || geography.regions.length !== 6) throw new Error('INVALID_REGIONS');
  if (cityData.schemaVersion !== 1 || !Array.isArray(cityData.observations) || !Array.isArray(cityData.sources)) throw new Error('INVALID_CONTEXT');
  const style = await fetchImpl('/scene/styles.css', { signal, method: 'HEAD' });
  if (!style.ok) throw new Error('SCENE_STYLE_UNAVAILABLE');
  const module = await loadModule();
  if (typeof module.createScene !== 'function') throw new Error('INVALID_SCENE_INTERFACE');
  return { ready: true, assets, geography, cityData, createScene: module.createScene };
}

export function createSceneAdapter({ root, session, onStatus = () => {}, fetchImpl = fetch, loadModule, documentRef = document, motion = matchMedia('(prefers-reduced-motion: reduce)') }) {
  let scene = null;
  let disposed = false;
  let request = null;
  let cityData = EMPTY_CITY;
  let loadingId = 0;
  let css = null;
  let unsubscribe = () => {};
  function clearScene() {
    const current = scene;
    scene = null;
    try { current?.destroy?.(); } catch { /* A failed renderer cannot block retry. */ }
    root.replaceChildren();
  }
  const context = () => ({ cityData, reducedMotion: motion.matches, visible: !documentRef.hidden && session.getSnapshot().mode === 'game' });
  function update(snapshot = session.getSnapshot()) {
    if (!scene || disposed) return;
    try { scene.update({ snapshot, context: context() }); }
    catch {
      loadingId += 1;
      clearScene();
      onStatus({ phase: 'error', reason: 'scene-update-failed', cityData });
    }
  }
  const onEnvironment = () => update();
  documentRef.addEventListener('visibilitychange', onEnvironment);
  motion.addEventListener('change', onEnvironment);
  unsubscribe = session.subscribe(update);

  async function connect() {
    if (disposed) return;
    request?.abort();
    request = new AbortController();
    const controller = request;
    const id = ++loadingId;
    clearScene();
    onStatus({ phase: 'loading', cityData });
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const result = await loadScenePackage({ fetchImpl, loadModule, signal: controller.signal });
      if (disposed || id !== loadingId) return;
      cityData = result.cityData;
      if (!result.ready) { onStatus({ phase: 'unavailable', reason: result.reason, cityData }); return; }
      if (!css) {
        css = documentRef.createElement('link');
        css.rel = 'stylesheet'; css.href = '/scene/styles.css';
        documentRef.head.append(css);
      }
      scene = result.createScene({ root, assets: result.assets, geography: result.geography, onIntent: (action) => {
        if (!disposed && id === loadingId && ['FOCUS_REGION', 'SET_VIEW', 'SET_PROJECTION', 'PLAYBACK_COMPLETE'].includes(action?.type)) session.dispatch(action);
      } });
      if (!scene || typeof scene.update !== 'function' || typeof scene.destroy !== 'function') throw new Error('INVALID_SCENE_INSTANCE');
      onStatus({ phase: 'ready', cityData });
      update();
    } catch {
      if (!disposed && id === loadingId) { loadingId += 1; clearScene(); onStatus({ phase: 'error', reason: 'load-failed', cityData }); }
    } finally { clearTimeout(timeout); }
  }
  return {
    connect,
    destroy() {
      if (disposed) return;
      disposed = true;
      request?.abort();
      unsubscribe();
      documentRef.removeEventListener('visibilitychange', onEnvironment);
      motion.removeEventListener('change', onEnvironment);
      clearScene();
      css?.remove();
    },
  };
}
