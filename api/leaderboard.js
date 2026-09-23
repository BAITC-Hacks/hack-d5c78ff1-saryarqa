import { leaderboard } from '../backend/storage.js';
import { send, fail } from '../backend/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); }
  try {
    return send(res, 200, { entries: await leaderboard(), updatedAt: new Date().toISOString(), sync: 'polling', intervalMs: 10000 });
  } catch (error) { return fail(res, error); }
}
