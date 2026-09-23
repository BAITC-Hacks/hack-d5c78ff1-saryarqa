import { RULES_VERSION } from '../simulator.js';

const IDENTITY_KEY = 'akim.cloud-player.v1';
const safeRead = (storage) => {
  try {
    const value = JSON.parse(storage?.getItem(IDENTITY_KEY) || 'null');
    return typeof value?.credential === 'string' && value.player?.id ? value : null;
  } catch { return null; }
};

/** Browser credentials identify only this anonymous player. Server keys never enter this module. */
export function createCloudSession({ session, storage, fetchImpl = globalThis.fetch, documentRef = globalThis.document, intervalMs = 10000 } = {}) {
  let identity = safeRead(storage), destroyed = false, refreshing = false, saving = false;
  let timer, lastSaved = '', aiRequest = null, signedOut = false, identityRevision = 0;
  try { signedOut = storage?.getItem('akim.signed-out.v1') === 'true' && !identity; } catch { /* Storage unavailable. */ }
  const listeners = new Set(), requests = new Set();
  const state = { services: null, player: identity?.player ?? null, entries: [], history: [], rank: null, updatedAt: null,
    connection: 'loading', saveStatus: 'idle', error: '', ai: { status: 'idle', text: '', message: '' } };
  const notify = () => { if (!destroyed) for (const listener of listeners) listener(structuredClone(state)); };
  async function request(path, { body, authenticated = false, signal, credential } = {}) {
    const controller = new AbortController();
    requests.add(controller);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, path === '/api/analyze' ? 35000 : 12000);
    try {
      const response = await fetchImpl(path, { method: body === undefined ? 'GET' : 'POST', signal: controller.signal,
        headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(credential || authenticated && identity ? { Authorization: `Bearer ${credential || identity.credential}` } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      const data = await response.json();
      if (!response.ok) { const error = new Error(data.error || 'SERVICE_UNAVAILABLE'); error.status = response.status; throw error; }
      return data;
    } finally { clearTimeout(timeout); requests.delete(controller); signal?.removeEventListener('abort', abort); }
  }
  async function refresh() {
    if (destroyed || refreshing || documentRef?.hidden) return;
    refreshing = true;
    const revision = identityRevision;
    try {
      state.services = await request('/api/services');
      if (!state.services.storage?.connected) {
        state.connection = 'offline';
        state.error = state.services.storage?.configured ? 'База данных пока недоступна. Черновик сохранён в этом браузере.' : 'Облачное сохранение не настроено. Черновик сохранён в этом браузере.';
        return;
      }
      const board = await request('/api/leaderboard');
      state.entries = Array.isArray(board.entries) ? board.entries : [];
      state.updatedAt = board.updatedAt || new Date().toISOString();
      state.connection = 'connected'; state.error = '';
      if (identity) {
        try {
          const own = await request('/api/runs', { authenticated: true });
          if (revision !== identityRevision) return;
          state.history = own.runs ?? own.history ?? [];
          state.player = own.player ?? identity.player;
          state.rank = own.rank ?? state.entries.find((entry) => entry.playerId === identity.player.id)?.rank ?? null;
        } catch (error) {
          if (error.status === 401) {
            state.connection = 'error';
            state.error = 'Не удалось подтвердить профиль этого браузера. Сохранённый ключ не заменён.';
          } else throw error;
        }
      }
    } catch { state.connection = 'offline'; state.error = 'Нет связи с сервером. Последние полученные результаты остаются на экране.'; }
    finally { refreshing = false; notify(); }
  }
  async function saveResult() {
    if (signedOut) return;
    const current = session.getSnapshot();
    if (destroyed || saving || current.result?.valid !== true || state.connection !== 'connected') return;
    const signature = JSON.stringify([RULES_VERSION, current.result.plan]);
    if (signature === lastSaved) return;
    saving = true; state.saveStatus = 'saving'; notify();
    try {
      if (!identity) {
        const created = await request('/api/player', { body: {} });
        if (!created.player?.id || typeof created.credential !== 'string') throw new Error('INVALID_PLAYER');
        identity = { player: created.player, credential: created.credential };
        state.player = identity.player;
        try { storage?.setItem(IDENTITY_KEY, JSON.stringify(identity)); } catch { /* In-memory access still works. */ }
      }
      const data = await request('/api/runs', { authenticated: true, body: { plan: current.result.plan } });
      if (!Number.isFinite(data.run?.score) || Math.abs(data.run.score - current.result.score) > 1e-7) throw new Error('SCORE_MISMATCH');
      lastSaved = signature; state.saveStatus = 'saved'; state.rank = data.rank ?? state.rank;
      await refresh();
    } catch { state.saveStatus = 'error'; state.error = 'Не удалось сохранить результат. Повторите сохранение, когда связь восстановится.'; }
    finally {
      saving = false; notify();
      const next = session.getSnapshot();
      if (next.result?.valid === true && signature !== JSON.stringify([RULES_VERSION, next.result.plan])) void saveResult();
    }
  }
  function storeIdentity(next) {
    identityRevision += 1;
    identity = next; signedOut = !next; lastSaved = '';
    state.player = next?.player ?? null; state.history = []; state.rank = null; state.saveStatus = 'idle'; state.error = '';
    try { if (next) storage?.setItem(IDENTITY_KEY, JSON.stringify(next)); else storage?.removeItem(IDENTITY_KEY); storage?.setItem('akim.signed-out.v1', String(!next)); } catch { /* Memory fallback. */ }
    notify();
  }
  async function createAccount(displayName) {
    if (saving) throw new Error('SAVE_IN_PROGRESS');
    const created = await request('/api/player', { body: { displayName } });
    if (!created.player?.id || typeof created.credential !== 'string') throw new Error('INVALID_PLAYER');
    storeIdentity(created); await refresh(); await saveResult(); return created.player;
  }
  async function login(credential) {
    if (saving) throw new Error('SAVE_IN_PROGRESS');
    if (typeof credential !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(credential.trim())) throw new Error('PLAYER_AUTH_INVALID');
    const token = credential.trim(), data = await request('/api/player', { credential: token });
    if (!data.player?.id) throw new Error('PLAYER_AUTH_INVALID');
    storeIdentity({ player: data.player, credential: token }); await refresh(); return data.player;
  }
  async function rename(displayName) {
    const data = await request('/api/player', { authenticated: true, body: { action: 'rename', displayName } });
    identity = { ...identity, player: data.player }; state.player = data.player;
    try { storage?.setItem(IDENTITY_KEY, JSON.stringify(identity)); } catch { /* Memory fallback. */ }
    await refresh(); notify();
  }
  async function analyze() {
    const current = session.getSnapshot();
    if (destroyed || current.result?.valid !== true || aiRequest || state.ai.status === 'complete') return;
    const controller = new AbortController(); aiRequest = controller;
    const revision = current.planRevision;
    state.ai = { status: 'loading', text: '', message: 'ИИ разбирает сильные стороны, риски и следующий шаг…' }; notify();
    const isCurrent = () => !destroyed && aiRequest === controller && session.getSnapshot().planRevision === revision;
    try {
      const data = await request('/api/analyze', { body: { plan: current.result.plan }, signal: controller.signal });
      if (!isCurrent()) return;
      if (data.source !== 'openai' || typeof data.analysis !== 'string' || !data.analysis.trim() || !Number.isFinite(data.score) || Math.abs(data.score - current.result.score) > 1e-7) throw new Error('INVALID_ANALYSIS');
      state.ai = { status: 'complete', text: data.analysis, message: 'Анализ ИИ готов. Баллы рассчитаны проверяемым алгоритмом.' };
    } catch {
      if (isCurrent()) state.ai = { status: 'error', text: '', message: 'ИИ сейчас недоступен. Расчёт и локальный разбор продолжают работать; запрос можно повторить.' };
    } finally { if (isCurrent()) { aiRequest = null; notify(); } }
  }
  let planRevision = session.getSnapshot().planRevision;
  const unsubscribe = session.subscribe((snapshot) => {
    if (snapshot.planRevision !== planRevision) {
      planRevision = snapshot.planRevision;
      aiRequest?.abort(); aiRequest = null;
      state.ai = { status: 'idle', text: '', message: '' }; state.saveStatus = 'idle'; notify();
    }
    if (snapshot.result) void saveResult();
  });
  const visibility = () => { if (!documentRef?.hidden) void refresh(); };
  documentRef?.addEventListener('visibilitychange', visibility);
  return {
    getSnapshot: () => structuredClone(state),
    subscribe(listener) { listeners.add(listener); listener(structuredClone(state)); return () => listeners.delete(listener); },
    async connect() { await refresh(); if (!destroyed && !timer) timer = setInterval(() => void refresh(), intervalMs); await saveResult(); },
    refresh, saveResult, analyze, createAccount, login, rename,
    logout() { if (saving) throw new Error('SAVE_IN_PROGRESS'); storeIdentity(null); },
    getLoginCode() { return identity?.credential ?? ''; },
    restoreRun(run) { if (!run || (run.rulesVersion && run.rulesVersion !== RULES_VERSION)) return; return session.dispatch({ type: 'LOAD_PLAN', plan: run.plan }); },
    destroy() { destroyed = true; clearInterval(timer); unsubscribe(); aiRequest?.abort(); for (const controller of requests) controller.abort(); documentRef?.removeEventListener('visibilitychange', visibility); listeners.clear(); },
  };
}
