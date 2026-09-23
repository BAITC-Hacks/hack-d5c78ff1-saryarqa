const number = (value) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}
const date = (value) => {
  const stamp = new Date(value);
  return Number.isFinite(stamp.getTime()) ? stamp.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
};

/** Shared ranking/history UI for the main site and the standalone city. */
export function createCloudPanel({ root, session, cloud, showAI = true }) {
  const stylesheet = node('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = '/scene/cloud-panel.css';
  document.head.append(stylesheet);
  const panel = node('details', 'cloud-panel');
  const summary = node('summary', 'cloud-summary');
  const title = node('strong', '', 'Рейтинг акимов');
  const connection = node('span', 'cloud-connection', 'Подключаем…');
  summary.append(title, connection);
  const body = node('div', 'cloud-body');
  const identity = node('p', 'cloud-identity');
  const status = node('p', 'cloud-status'); status.setAttribute('role', 'status');
  const actions = node('div', 'cloud-actions');
  const refresh = node('button', '', 'Обновить'); refresh.type = 'button';
  const save = node('button', '', 'Сохранить результат'); save.type = 'button';
  actions.append(refresh, save);
  const aiSection = node('section', 'cloud-ai');
  const aiButton = node('button', '', 'Разобрать план с ИИ'); aiButton.type = 'button';
  const aiStatus = node('p', 'cloud-status'); aiStatus.setAttribute('role', 'status');
  const aiText = node('div', 'cloud-ai-text');
  aiSection.append(aiButton, aiStatus, aiText); aiSection.hidden = true;
  const columns = node('div', 'cloud-columns');
  const board = node('section'); board.append(node('h3', '', 'Лучшие планы'));
  const leaders = node('ol', 'cloud-leaders'); board.append(leaders);
  const historySection = node('section'); historySection.append(node('h3', '', 'Мои сценарии'));
  const history = node('div', 'cloud-history'); historySection.append(history);
  columns.append(board, historySection);
  const freshness = node('p', 'cloud-freshness');
  const note = node('p', 'cloud-note', 'Один лучший план на игрока. При равном балле выше план с меньшей стоимостью, затем более ранний. Это игровой рейтинг. Черновик сохраняется в этом браузере; рассчитанные планы — в облаке.');
  body.append(identity, status, actions, aiSection, columns, freshness, note);
  panel.append(summary, body); root.append(panel);
  const events = new AbortController();
  const on = (item, event, callback) => item.addEventListener(event, callback, { signal: events.signal });
  on(refresh, 'click', async () => { refresh.disabled = true; try { await cloud.refresh(); await cloud.saveResult(); } finally { refresh.disabled = false; } });
  on(save, 'click', () => cloud.saveResult());
  on(aiButton, 'click', () => cloud.analyze());
  for (const event of ['pointerdown', 'wheel', 'keydown', 'dblclick']) on(panel, event, (input) => input.stopPropagation());
  let current = session.getSnapshot(), cloudState = cloud.getSnapshot(), listSignature = '';
  function render() {
    const value = cloudState;
    const connected = value.connection === 'connected';
    const local = value.services?.storage?.mode === 'local';
    connection.textContent = connected ? value.rank ? `Ваше место · ${value.rank}` : local ? 'На этом сервере' : 'Онлайн' : value.connection === 'loading' ? 'Подключаем…' : 'Нет связи';
    connection.dataset.connected = String(connected);
    identity.textContent = value.player ? `${value.player.displayName}${value.rank ? ` · место ${value.rank}` : ''}` : 'Ваш игровой профиль появится после первого рассчитанного плана.';
    status.textContent = value.saveStatus === 'saving' ? 'Сохраняем проверенный результат…' : value.saveStatus === 'saved' && !value.error ? local ? 'Результат сохранён на этом сервере.' : 'Результат сохранён в Supabase.' : value.error || 'Результаты проверяются сервером перед включением в рейтинг.';
    note.textContent = `Один лучший план на игрока. При равном балле выше план с меньшей стоимостью, затем более ранний. Это игровой рейтинг. Черновик сохраняется в этом браузере; рассчитанные планы — ${local ? 'на этом сервере' : 'в Supabase'}.`;
    save.hidden = !current.result || value.saveStatus === 'saved';
    save.disabled = !connected || value.saveStatus === 'saving';
    save.textContent = value.saveStatus === 'error' ? 'Повторить сохранение' : 'Сохранить результат';
    const revealed = current.result && (current.mode === 'calculator' || current.playback.status === 'complete');
    aiSection.hidden = !showAI || !revealed;
    aiButton.disabled = value.ai.status === 'loading' || value.ai.status === 'complete';
    aiStatus.textContent = value.ai.message || 'ИИ объяснит сильные стороны, риски и следующие шаги.';
    aiText.textContent = value.ai.text;
    aiText.hidden = !value.ai.text;
    freshness.textContent = value.updatedAt ? `Обновлено ${date(value.updatedAt)} · проверка каждые 10 секунд, пока вкладка открыта.` : 'Рейтинг обновляется автоматически после подключения.';
    const signature = JSON.stringify([value.entries, value.history, value.player?.id]);
    if (signature === listSignature) return;
    listSignature = signature;
    leaders.replaceChildren();
    if (!value.entries.length) leaders.append(node('li', 'cloud-empty', 'Пока нет опубликованных результатов.'));
    for (const entry of value.entries.slice(0, 10)) {
      const row = node('li', 'cloud-leader');
      row.classList.toggle('is-you', entry.playerId === value.player?.id);
      const name = node('span', 'cloud-name', entry.displayName);
      name.append(node('small', '', `${entry.cost} ед. бюджета${entry.playerId === value.player?.id ? ' · вы' : ''}`));
      row.append(node('span', 'cloud-position', String(entry.rank)), name, node('strong', 'cloud-score', number(entry.score)));
      leaders.append(row);
    }
    history.replaceChildren();
    if (!value.history.length) history.append(node('p', 'cloud-empty', 'Здесь появятся рассчитанные сценарии.'));
    for (const run of value.history.slice(0, 10)) {
      const row = node('div', 'cloud-run');
      const text = node('div');
      text.append(node('strong', '', `${number(run.score)} · ${run.cost} ед.`), node('small', '', date(run.createdAt)));
      const restore = node('button', '', 'Открыть план'); restore.type = 'button';
      restore.setAttribute('aria-label', `Открыть план с баллом ${number(run.score)}`);
      restore.addEventListener('click', () => cloud.restoreRun(run), { signal: events.signal });
      row.append(text, restore); history.append(row);
    }
  }
  const uncloud = cloud.subscribe((value) => { cloudState = value; render(); });
  const unsession = session.subscribe((value) => { current = value; render(); });
  return { destroy() { uncloud(); unsession(); events.abort(); panel.remove(); stylesheet.remove(); } };
}
