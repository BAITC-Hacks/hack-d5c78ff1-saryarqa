import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/analyze.js';
import { calculatePlan } from '../simulator.js';

const plan = [{ id: 'M7', district: 'Нура' }, { id: 'M8', district: 'Нура' },
  { id: 'M10', district: 'Нура' }, { id: 'M12' }, { id: 'M5', district: 'Сарыарка' }];
async function invoke(body, method = 'POST') {
  const response = { headers: {}, statusCode: 200,
    setHeader(key, value) { this.headers[key] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
  await handler({ body, method }, response);
  return response;
}
const provider = text => ({ ok: true, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text }] }] }) });

test('AI endpoint validates method, malformed input, mode and plans before provider calls', async () => {
  assert.equal((await invoke({}, 'GET')).statusCode, 405);
  assert.equal((await invoke('{')).statusCode, 400);
  assert.equal((await invoke(null)).statusCode, 400);
  assert.equal((await invoke({ plan, noise: 'x'.repeat(5000) })).statusCode, 400);
  assert.equal((await invoke({ plan, mode: 'invent' })).body.error, 'INVALID_MODE');
  assert.equal((await invoke({ plan: [] })).statusCode, 422);
});

test('AI uses recomputed forecast and supports analysis/advice without trusting client facts', async t => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-placeholder';
  t.after(() => { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; });
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return provider('Социальная инфраструктура Нуры улучшается. Учитывайте оставшиеся различия между районами.');
  });
  for (const mode of ['analysis', 'advice']) {
    const response = await invoke({ plan, mode, score: 999, forecast: { scoreAfter: 999 } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.source, 'openai');
    assert.equal(response.body.mode, mode);
    assert.equal(response.body.score, calculatePlan(plan).score);
  }
  const facts = JSON.parse(requests[0].input);
  assert.equal(facts.score, calculatePlan(plan).score);
  assert.equal(facts.forecast.scoreAfter, facts.score);
  assert.ok(facts.forecast.suggestions.length);
  for (const alternative of facts.forecast.suggestions) {
    assert.equal(alternative.score, calculatePlan(alternative.plan).score);
  }
  assert.notEqual(requests[0].instructions, requests[1].instructions);
  assert.equal(requests[0].store, false);
});

test('missing key and provider failures stay explicit for deterministic UI fallback', async t => {
  const previous = process.env.OPENAI_API_KEY;
  t.after(() => { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; });
  delete process.env.OPENAI_API_KEY;
  assert.equal((await invoke({ plan })).body.error, 'AI_NOT_CONFIGURED');
  process.env.OPENAI_API_KEY = 'test-placeholder';
  const mock = t.mock.method(globalThis, 'fetch', async () => ({ ok: false }));
  assert.equal((await invoke({ plan })).body.error, 'AI_PROVIDER_UNAVAILABLE');
  for (const [status, code, expected] of [[401, 'invalid_api_key', 'AI_AUTH_FAILED'],
    [404, 'model_not_found', 'AI_MODEL_UNAVAILABLE'],
    [429, 'insufficient_quota', 'AI_QUOTA_EXCEEDED'],
    [429, 'rate_limit_exceeded', 'AI_RATE_LIMITED']]) {
    mock.mock.mockImplementation(async () => ({ ok: false, status,
      json: async () => ({ error: { code, message: 'sensitive upstream text must never escape' } }),
    }));
    const response = await invoke({ plan });
    assert.deepEqual(response.body, { error: expected });
  }
  mock.mock.mockImplementation(async () => { throw new DOMException('Aborted', 'AbortError'); });
  assert.equal((await invoke({ plan })).body.error, 'AI_PROVIDER_UNAVAILABLE');
  mock.mock.mockImplementation(async () => provider(''));
  assert.equal((await invoke({ plan })).body.error, 'AI_EMPTY_RESPONSE');
  for (const text of ['Индекс вырастет до 99.', 'Рост составит пять процентов.', 'Прирост ９９.']) {
    mock.mock.mockImplementation(async () => provider(text));
    const response = await invoke({ plan });
    assert.equal(response.statusCode, 502);
    assert.equal(response.body.error, 'AI_UNSUPPORTED_NUMBERS');
    assert.equal(response.body.analysis, undefined);
  }
});
