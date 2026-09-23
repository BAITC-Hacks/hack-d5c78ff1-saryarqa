import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnv, parseEnv } from '../backend/env.js';

test('dotenv subset handles quoted values and comments without executing interpolation', () => {
  assert.deepEqual(parseEnv('A=plain\nB="quoted value"\nC=hello # comment\nexport D=\'literal ${A}\'\n# ignored\nBROKEN'),
    { A: 'plain', B: 'quoted value', C: 'hello', D: 'literal ${A}' });
});

test('local env overrides inherited IDE credentials; deployment configuration wins in production mode', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'akim-env-'));
  try {
    await writeFile(join(directory, '.env'), 'TEST_KEY=project\nDEFAULT=value\n');
    await writeFile(join(directory, '.env.local'), 'TEST_KEY=local\n');
    const local = { TEST_KEY: 'inherited' };
    loadEnv(directory, local, { override: true });
    assert.deepEqual(local, { TEST_KEY: 'local', DEFAULT: 'value' });
    const production = { TEST_KEY: 'deployment' };
    loadEnv(directory, production, { override: false });
    assert.deepEqual(production, { TEST_KEY: 'deployment', DEFAULT: 'value' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
