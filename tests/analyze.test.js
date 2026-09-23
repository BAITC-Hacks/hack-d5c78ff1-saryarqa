import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/analyze.js';
import { calculatePlan } from '../simulator.js';
import { analysisFacts } from '../backend/analysis.js';
import { explainLocally } from '../game/advisor.js';

const plan = [{ id: 'M7', district: 'Нура' }, { id: 'M8', district: 'Нура' },
  { id: 'M10', district: 'Нура' }, { id: 'M12' }, { id: 'M5', district: 'Сарыарка' }];
let peer = 0;
async function invoke(body, method = 'POST') {
  const response = { headers: {}, statusCode: 200,
    setHeader(key, value) { this.headers[key] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
  await handler({ body, method, socket: { remoteAddress: `test-${peer++}` } }, response);
  return response;
}
const provider = selection => ({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(selection) }] }] }) });
function configure(t) {
  const previous = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'test-placeholder';
  t.after(() => { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; });
}

test('analysis rejects invalid inputs, injected scores and chat questions before provider calls', async () => {
  assert.equal((await invoke({}, 'GET')).statusCode, 405);
  assert.equal((await invoke('{')).statusCode, 400);
  assert.equal((await invoke(null)).statusCode, 400);
  assert.equal((await invoke({ plan, noise: 'x'.repeat(5000) })).statusCode, 413);
  assert.equal((await invoke({ plan, score: 999 })).body.error, 'UNEXPECTED_FIELD');
  assert.equal((await invoke({ plan, mode: 'invent' })).body.error, 'INVALID_MODE');
  assert.equal((await invoke({ plan: [] })).statusCode, 422);
  assert.equal((await invoke({ plan, mode: 'chat', question: '' })).body.error, 'INVALID_QUESTION');
  assert.equal((await invoke({ plan, mode: 'chat', question: 'x'.repeat(601) })).body.error, 'INVALID_QUESTION');
});

test('analysis, advice and chat allow only server-computed facts selected by the model', async t => {
  configure(t); const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return provider({ strengths: ['strengths-0'], risks: ['risks-0'], next: ['next-0'] });
  });
  const result = calculatePlan(plan); const facts = analysisFacts(result);
  for (const mode of ['analysis', 'advice', 'chat']) {
    const response = await invoke({ plan, mode, ...(mode === 'chat' ? { question: 'Какие риски?', history: [{ role: 'user', content: 'А что с Нурой?' }] } : {}) });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.source, 'openai'); assert.equal(response.body.grounded, true);
    assert.equal(response.body.score, result.score);
    assert.ok(response.body.analysis.includes(facts.risks[0].text));
    assert.equal(response.body.recommendations[0].score, calculatePlan(response.body.recommendations[0].plan).score);
  }
  assert.equal(JSON.parse(requests[2].input).userQuestion, 'Какие риски?');
  assert.equal(requests[0].text.format.strict, true); assert.equal(requests[0].store, false);
});

test('provider failures and invented facts remain explicit for local fallback', async t => {
  configure(t); delete process.env.OPENAI_API_KEY;
  assert.equal((await invoke({ plan })).body.error, 'AI_NOT_CONFIGURED');
  process.env.OPENAI_API_KEY = 'test-placeholder';
  const mock = t.mock.method(globalThis, 'fetch', async () => ({ ok: false }));
  assert.equal((await invoke({ plan })).body.error, 'AI_PROVIDER_UNAVAILABLE');
  for (const [status, code, expected] of [[401, 'invalid_api_key', 'AI_AUTH_FAILED'], [404, 'model_not_found', 'AI_MODEL_UNAVAILABLE'], [429, 'insufficient_quota', 'AI_QUOTA_EXCEEDED'], [429, 'rate_limit_exceeded', 'AI_RATE_LIMITED']]) {
    mock.mock.mockImplementation(async () => ({ ok: false, status, json: async () => ({ error: { code, message: 'sensitive upstream message' } }) }));
    assert.deepEqual((await invoke({ plan })).body, { error: expected });
  }
  for (const selection of [{ strengths: ['invented-score-999'], risks: ['risks-0'], next: ['next-0'] }, { strengths: ['strengths-0'], risks: ['risks-0'], next: ['next-0'], text: 'Индекс 999' }]) {
    mock.mock.mockImplementation(async () => provider(selection));
    assert.equal((await invoke({ plan })).body.error, 'AI_UNVERIFIED_RESPONSE');
  }
});

test('local advisor answers budget, district, risks, formula and recommendations from the engine', () => {
  assert.match(explainLocally(plan, 'Бюджет?'), /95 из 100/);
  assert.match(explainLocally(plan, 'Что в Нуре?'), /52,96/);
  assert.match(explainLocally(plan, 'Какие риски?'), /строго ниже 40 нет/);
  assert.match(explainLocally(plan, 'Почему такой индекс?'), /56,54/);
  assert.match(explainLocally(plan, 'Как улучшить план?'), /Проверенный вариант/);
  assert.match(explainLocally([], 'Индекс?'), /Сначала соберите корректный план/);
});
