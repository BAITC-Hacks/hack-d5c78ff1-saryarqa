export class ApiError extends Error {
  constructor(code, status = 503) { super(code); this.code = code; this.status = status; }
}

export function send(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

export function readBody(req, allowedKeys = []) {
  let input;
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    if (Buffer.byteLength(raw) > 4096) throw new ApiError('REQUEST_TOO_LARGE', 413);
    input = JSON.parse(raw);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('INVALID_REQUEST', 400);
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError('INVALID_REQUEST', 400);
  if (Object.keys(input).some(key => !allowedKeys.includes(key))) throw new ApiError('UNEXPECTED_FIELD', 400);
  return input;
}

export function fail(res, error) {
  return send(res, error instanceof ApiError ? error.status : 503, {
    error: error instanceof ApiError ? error.code : 'SERVICE_UNAVAILABLE',
  });
}

/** Per-process guard; multi-instance deployments also need an edge/provider limit. */
const buckets = new Map();
export function limitRequest(req, action, limit, windowMs = 60000) {
  const now = Date.now();
  for (const [key, value] of buckets) if (value.until <= now) buckets.delete(key);
  // Never trust caller-controlled forwarded headers to bypass the limit.
  const peer = req.socket?.remoteAddress || 'serverless';
  const key = `${action}:${peer}`;
  const bucket = buckets.get(key) || { count: 0, until: now + windowMs };
  bucket.count += 1;
  buckets.set(key, bucket);
  if (bucket.count > limit) throw new ApiError('RATE_LIMITED', 429);
}
