import { calculatePlan } from '../simulator.js';
import { authenticate, saveRun, history, leaderboard } from '../backend/storage.js';
import { send, readBody, fail, limitRequest } from '../backend/http.js';

export default async function handler(req, res) {
  try {
    if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); }
    const input = req.method === 'POST' ? readBody(req, ['plan']) : null;
    const result = input ? calculatePlan(input.plan) : null;
    if (result && !result.valid) return send(res, 422, { error: 'INVALID_PLAN', details: result.errors, score: null });
    const player = await authenticate(req);
    if (req.method === 'GET') {
      const [savedRuns, ranks] = await Promise.all([history(player), leaderboard(player.id)]);
      return send(res, 200, { player, runs: savedRuns, rank: ranks[0]?.rank ?? null });
    }
    limitRequest(req, 'save-run', 30);
    const run = await saveRun(player, result);
    // Saving remains successful if the separate rank refresh is temporarily unavailable.
    const ranks = await leaderboard(player.id).catch(() => []);
    return send(res, 201, { player, run, rank: ranks[0]?.rank ?? null });
  } catch (error) { return fail(res, error); }
}
