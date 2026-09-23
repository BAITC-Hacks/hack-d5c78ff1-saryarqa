import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { RULES_VERSION } from '../simulator.js';

let pending = Promise.resolve();
const filePath = () => resolve(process.env.AKIM_DATA_DIR || '.akim-data', 'players.json');
async function read() {
  try { return JSON.parse(await readFile(filePath(), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return { players: [], runs: [] }; throw error; }
}
async function access(mutator) {
  const task = pending.then(async () => {
    const data = await read();
    const result = mutator(data);
    if (mutator.write) {
      const path = filePath();
      await mkdir(resolve(path, '..'), { recursive: true });
      const temp = `${path}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(data), { mode: 0o600 });
      await rename(temp, path);
    }
    return result;
  });
  pending = task.catch(() => {});
  return task;
}
function change(mutator) { mutator.write = true; return access(mutator); }
export const localPlayers = {
  find: hash => access(data => data.players.find(player => player.credential_hash === hash)),
  create: player => change(data => { data.players.push(player); return player; }),
  rename: (id, name) => change(data => { const player = data.players.find(item => item.id === id); player.display_name = name; return player; }),
  history: id => access(data => data.runs.filter(run => run.player_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30)),
  save: row => change(data => {
    const existing = data.runs.find(run => run.player_id === row.player_id && run.plan_hash === row.plan_hash);
    if (existing) return existing;
    const run = { ...row, id: randomUUID(), created_at: new Date().toISOString() };
    data.runs.push(run);
    return run;
  }),
  leaderboard: playerId => access(data => {
    const compare = (a, b) => b.score - a.score || a.cost - b.cost || a.created_at.localeCompare(b.created_at) || a.player_id.localeCompare(b.player_id);
    const best = new Map();
    for (const run of data.runs.filter(item => item.rules_version === RULES_VERSION).sort(compare)) if (!best.has(run.player_id)) best.set(run.player_id, run);
    return [...best.values()].sort(compare).map((run, index) => ({ ...run, rank: index + 1, display_name: data.players.find(player => player.id === run.player_id)?.display_name || 'Аким' })).filter(row => !playerId || row.player_id === playerId).slice(0, 50);
  }),
};
