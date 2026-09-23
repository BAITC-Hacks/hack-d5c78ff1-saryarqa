import './env.js';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ApiError } from './http.js';
import { RULES_VERSION } from '../simulator.js';
import { localPlayers } from './local-storage.js';

export const hashCredential = value => createHash('sha256').update(value).digest('hex');

export function storageConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  return url && key ? { url, key } : null;
}

export const storageMode = () => process.env.AKIM_STORAGE_MODE === 'local' || (process.env.AKIM_STORAGE_MODE !== 'supabase' && !storageConfig() && !process.env.VERCEL) ? 'local' : 'supabase';
export function validDisplayName(value) {
  if (value === undefined) return `Аким ${randomBytes(3).toString('hex').toUpperCase()}`;
  if (typeof value !== 'string') throw new ApiError('INVALID_DISPLAY_NAME', 400);
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 32 || /[\u0000-\u001f\u007f<>]/u.test(name)) throw new ApiError('INVALID_DISPLAY_NAME', 400);
  return name;
}

export async function database(path, { method = 'GET', body, prefer } = {}) {
  const config = storageConfig();
  if (!config) throw new ApiError('STORAGE_NOT_CONFIGURED');
  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const headers = { apikey: config.key, 'Content-Type': 'application/json' };
    // New secret API keys are opaque, not JWTs. Supabase uses their apikey header.
    if (!config.key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${config.key}`;
    if (prefer) headers.Prefer = prefer;
    response = await fetch(`${config.url}/rest/v1/${path}`, {
      method, headers, signal: controller.signal, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (data?.code === 'PGRST205' || data?.code === 'PGRST202' || data?.code === '42P01') throw new ApiError('STORAGE_SCHEMA_REQUIRED');
      throw new ApiError('STORAGE_UNAVAILABLE');
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('STORAGE_UNAVAILABLE');
  } finally { clearTimeout(timeout); }
}

export async function authenticate(req) {
  const header = req.headers?.authorization;
  const match = typeof header === 'string' && /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header);
  if (!match) throw new ApiError('PLAYER_AUTH_REQUIRED', 401);
  const rows = storageMode() === 'local' ? [await localPlayers.find(hashCredential(match[1]))] : await database(`akim_players?credential_hash=eq.${hashCredential(match[1])}&select=id,display_name&limit=1`);
  if (!Array.isArray(rows) || !rows[0]) throw new ApiError('PLAYER_AUTH_INVALID', 401);
  return { id: rows[0].id, displayName: rows[0].display_name };
}

export async function createPlayer(name) {
  const credential = randomBytes(32).toString('base64url');
  const id = randomUUID();
  const displayName = validDisplayName(name);
  const row = { id, display_name: displayName, credential_hash: hashCredential(credential) };
  if (storageMode() === 'local') await localPlayers.create(row);
  else await database('akim_players', {
    method: 'POST', prefer: 'return=minimal',
    body: row,
  });
  return { player: { id, displayName }, credential };
}

export async function renamePlayer(player, name) {
  const displayName = validDisplayName(name);
  if (storageMode() === 'local') await localPlayers.rename(player.id, displayName);
  else await database(`akim_players?id=eq.${player.id}`, { method: 'PATCH', body: { display_name: displayName }, prefer: 'return=minimal' });
  return { ...player, displayName };
}

export function publicRun(row) {
  return {
    id: row.id, score: row.score, delta: row.delta, cost: row.cost,
    plan: row.plan, createdAt: row.created_at, rulesVersion: row.rules_version,
  };
}

export async function saveRun(player, result) {
  const planHash = hashCredential(`${RULES_VERSION}:${JSON.stringify(result.plan)}`);
  if (storageMode() === 'local') return publicRun(await localPlayers.save({ player_id: player.id, plan_hash: planHash, plan: result.plan, score: result.score, delta: result.delta, cost: result.cost, rules_version: RULES_VERSION }));
  const rows = await database('rpc/akim_save_run', {
    method: 'POST', body: {
      p_player_id: player.id, p_plan_hash: planHash, p_plan: result.plan,
      p_score: result.score, p_delta: result.delta, p_cost: result.cost,
      p_rules_version: RULES_VERSION, p_result: result,
    },
  });
  if (!Array.isArray(rows) || !rows[0]) throw new ApiError('STORAGE_UNAVAILABLE');
  return publicRun(rows[0]);
}

export async function history(player) {
  const rows = storageMode() === 'local' ? await localPlayers.history(player.id) : await database(`akim_runs?player_id=eq.${player.id}&select=id,score,delta,cost,plan,created_at,rules_version&order=created_at.desc&limit=30`);
  return rows.map(publicRun);
}

export async function leaderboard(playerId = null) {
  const rows = storageMode() === 'local' ? await localPlayers.leaderboard(playerId) : await database('rpc/akim_leaderboard', { method: 'POST', body: { p_player_id: playerId } });
  return rows.map(row => ({
    rank: Number(row.rank), playerId: row.player_id, displayName: row.display_name,
    score: row.score, cost: row.cost, createdAt: row.created_at,
  }));
}

export async function storageStatus() {
  if (storageMode() === 'local') {
    try { await localPlayers.leaderboard(); return { configured: true, connected: true, mode: 'local', label: 'На этом сервере' }; }
    catch { return { configured: true, connected: false, mode: 'local', error: 'STORAGE_UNAVAILABLE' }; }
  }
  if (!storageConfig()) return { configured: false, connected: false, error: 'STORAGE_NOT_CONFIGURED' };
  try {
    await database('akim_players?select=id&limit=0');
    await database('rpc/akim_leaderboard', { method: 'POST', body: { p_player_id: null } });
    return { configured: true, connected: true, mode: 'supabase', label: 'Облачное сохранение' };
  } catch (error) { return { configured: true, connected: false, error: error.code || 'STORAGE_UNAVAILABLE' }; }
}
