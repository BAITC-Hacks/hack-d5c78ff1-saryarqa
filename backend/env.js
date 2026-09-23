import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Node 18 compatible dotenv subset. Never executes/interpolates file contents. */
export function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?$/.exec(line);
    if (!match) continue;
    let value = (match[2] || '').trim();
    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0];
      const end = value.indexOf(quote, 1);
      if (end < 0) continue;
      value = value.slice(1, end);
    } else value = value.replace(/\s+#.*$/, '').trim();
    values[match[1]] = value;
  }
  return values;
}

export function loadEnv(root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), target = process.env, { override = process.env.NODE_ENV !== 'production' } = {}) {
  const values = {};
  for (const name of ['.env', '.env.local']) {
    try { Object.assign(values, parseEnv(readFileSync(resolve(root, name), 'utf8'))); }
    catch (error) { if (error.code !== 'ENOENT') throw new Error('ENV_FILE_UNREADABLE'); }
  }
  // Local project credentials win over unrelated credentials inherited from an IDE.
  // Production continues to use deployment-provider environment configuration.
  for (const [key, value] of Object.entries(values)) if (override || target[key] === undefined) target[key] = value;
}

loadEnv();
