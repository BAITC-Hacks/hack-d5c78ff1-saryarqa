import '../backend/env.js';
import { storageStatus } from '../backend/storage.js';
import { send } from '../backend/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); }
  return send(res, 200, {
    ai: { configured: Boolean(process.env.OPENAI_API_KEY) },
    storage: await storageStatus(),
    sync: { mode: 'polling', intervalMs: 10000 },
  });
}
