import { createPlayer, authenticate, renamePlayer } from '../backend/storage.js';
import { send, readBody, fail, limitRequest } from '../backend/http.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') { limitRequest(req, 'login-player', 60); return send(res, 200, { player: await authenticate(req) }); }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); }
    const input = readBody(req, ['displayName', 'action']);
    if (input.action === 'rename') {
      limitRequest(req, 'rename-player', 20);
      return send(res, 200, { player: await renamePlayer(await authenticate(req), input.displayName) });
    }
    if (input.action !== undefined) return send(res, 400, { error: 'INVALID_ACTION' });
    limitRequest(req, 'create-player', 15);
    return send(res, 201, await createPlayer(input.displayName));
  } catch (error) { return fail(res, error); }
}
