import { DISTRICTS, INDICATORS, MEASURES, BASELINE, realizedMeasureEffects } from './simulator.js';
import { createGameSession } from './game/session.js';
import { REGIONS, getRegion } from './game/contracts.js';
import { createSceneAdapter } from './game/scene-adapter.js';
import { CITIES } from './scene/cities.js';
let currentCity = 'astana';

const $ = (selector) => document.querySelector(selector);
const byId = (id) => document.getElementById(id);
const number = (value, digits = 2) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const groups = [...new Set(MEASURES.map((measure) => measure.direction))];
let browserStorage;
try { browserStorage = window.localStorage; } catch { browserStorage = null; }
const session = createGameSession({ storage: browserStorage });
let state = session.getSnapshot();
let requestedAI = false;
let aiController = null;
let adapter = null;
let sceneStatus = { phase: 'loading', cityData: null };
const motion = matchMedia('(prefers-reduced-motion: reduce)');

function dispatch(action) {
  const response = session.dispatch(action);
  byId('session-message').textContent = response?.ok === false ? response.error?.message ?? 'Не удалось выполнить действие.' : '';
  return response;
}

function el(tag, className, textValue) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textValue !== undefined) element.textContent = textValue;
  return element;
}

function measure(id) { return MEASURES.find((item) => item.id === id); }

function renderCatalog() {
  const container = byId('measure-groups');
  container.replaceChildren();
  for (const groupName of groups) {
    const group = el('section', 'measure-group');
    const heading = el('div', 'group-heading');
    heading.append(el('strong', '', groupName), el('span', '', `${MEASURES.filter((item) => item.direction === groupName).length} меры`));
    group.append(heading);
    const list = el('div', 'measure-list');
    for (const item of MEASURES.filter((candidate) => candidate.direction === groupName)) {
      const selected = state.plan.some((choice) => choice.id === item.id);
      const button = el('button', `measure-card${selected ? ' is-selected' : ''}`);
      button.type = 'button';
      button.dataset.focusKey = `measure-${item.id}`;
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', `${selected ? 'Убрать' : 'Выбрать'}: ${item.name}, стоимость ${item.cost}, ${item.scope === 'city' ? 'весь город' : 'выбрать район'}`);
      const focused = getRegion(state.focusedRegion);
      button.disabled = !selected && (state.plan.length >= 5 || (state.mode === 'game' && focused?.simulationDistrict === null && item.scope === 'district'));
      const top = el('div', 'measure-card-top');
      top.append(el('span', 'measure-id', item.id), el('span', 'measure-check', selected ? '✓' : '+'));
      const bottom = el('div', 'measure-card-bottom');
      bottom.append(el('span', '', item.scope === 'city' ? 'Весь город' : 'Один район'), el('span', 'measure-cost', `${item.cost} ед.`));
      const effectText = Object.entries(realizedMeasureEffects(item).effects).map(([id, effect]) => `${id} ${effect >= 0 ? '+' : ''}${number(effect)}`).join(' · ');
      const preview = el('span', 'measure-preview', `${effectText} · задержка ${item.lag} кв.`);
      preview.title = 'Изменения показателей к концу восьми кварталов, без отдельных бонусов сочетания мер.';
      button.append(top, el('div', 'measure-title', item.name), preview, bottom);
      button.addEventListener('click', () => toggleMeasure(item.id));
      list.append(button);
    }
    group.append(list);
    container.append(group);
  }
}

function toggleMeasure(id) {
  const current = state.plan.findIndex((choice) => choice.id === id);
  if (current >= 0) dispatch({ type: 'REMOVE_MEASURE', id });
  else dispatch({ type: 'ADD_MEASURE', id, district: measure(id).scope === 'city' ? null : state.mode === 'game' ? getRegion(state.focusedRegion)?.simulationDistrict ?? null : null });
}

function renderSelections() {
  const list = byId('selected-list');
  list.replaceChildren();
  if (state.plan.length === 0) {
    list.append(el('li', 'selected-empty', 'Выберите первую меру.'));
    return;
  }
  state.plan.forEach((choice, index) => {
    const item = measure(choice.id);
    const row = el('li', 'selected-item');
    row.append(el('span', 'selected-index', String(index + 1).padStart(2, '0')));
    const body = el('div');
    body.append(el('div', 'selected-title', item.name));
    body.append(el('div', 'selected-meta', `${item.direction} · ${item.cost} ед.${item.scope === 'city' ? ' · весь город' : ''}`));
    if (item.scope === 'district') {
      const select = el('select', 'district-select');
      select.dataset.focusKey = `district-${choice.id}`;
      select.setAttribute('aria-label', `Район для ${item.name}`);
      const placeholder = el('option', '', 'Выберите район');
      placeholder.value = '';
      select.append(placeholder);
      DISTRICTS.forEach((district) => {
        const option = el('option', '', district.name);
        option.value = district.name;
        select.append(option);
      });
      select.value = choice.district ?? '';
      select.addEventListener('change', (event) => {
        dispatch({ type: 'ASSIGN_MEASURE', id: choice.id, district: event.target.value || null });
      });
      body.append(select);
    }
    row.append(body);
    const remove = el('button', 'selected-remove', '×');
    remove.dataset.focusKey = `remove-${choice.id}`;
    remove.type = 'button';
    remove.setAttribute('aria-label', `Убрать ${item.name}`);
    remove.addEventListener('click', () => toggleMeasure(choice.id));
    row.append(remove);
    list.append(row);
  });
}

function renderValidation() {
  const validation = state.validation;
  const used = validation.cost;
  byId('budget-used').textContent = String(used);
  byId('selection-count').textContent = `${state.plan.length}/5`;
  const track = byId('budget-track');
  track.setAttribute('aria-valuenow', String(Math.min(100, used)));
  track.setAttribute('aria-valuetext', `${used} из 100 единиц${used > 100 ? ', превышение бюджета' : ''}`);
  track.classList.toggle('is-over', used > 100);
  byId('budget-fill').style.width = `${Math.min(100, used)}%`;
  const budgetNote = byId('budget-note');
  budgetNote.textContent = used <= 100 ? `Осталось ${100 - used} единиц` : `Превышение на ${used - 100} единиц`;
  budgetNote.classList.toggle('is-error', used > 100);
  const status = byId('validation');
  status.replaceChildren();
  const errors = validation.errors.filter((issue) => issue.code !== 'EXACTLY_FIVE_REQUIRED');
  status.classList.toggle('has-errors', errors.length > 0);
  if (errors.length) {
    const list = el('ul');
    errors.forEach((issue) => list.append(el('li', '', issue.message)));
    status.append(list);
  } else if (state.plan.length < 5) {
    status.textContent = `Выберите ещё ${5 - state.plan.length} ${plural(5 - state.plan.length, 'меру', 'меры', 'мер')}.`;
  } else {
    status.textContent = 'План готов к расчёту.';
  }
  return validation;
}

function plural(value, one, few, many) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  return mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
}

function render() {
  renderCatalog();
  renderSelections();
  renderValidation();
}

function clearResults() {
  aiController?.abort();
  aiController = null;
  requestedAI = false;
  byId('results').hidden = true;
  byId('ai-button').disabled = false;
  byId('ai-output').hidden = true;
  byId('ai-output').replaceChildren();
  byId('ai-status').textContent = 'ИИ объясняет результат.';
}

function makeInsight(title, description) {
  const block = el('div', 'insight-block');
  block.append(el('strong', '', title), el('p', '', description));
  return block;
}

function renderInsights(result) {
  const holder = byId('insight-content');
  holder.replaceChildren();
  const gains = [...result.districts].sort((a, b) => b.scoreDelta - a.scoreDelta);
  const top = gains[0];
  holder.append(makeInsight('Наибольший рост', `${top.name}: +${number(top.scoreDelta)} к районному индексу. Общий индекс города изменился на ${result.delta >= 0 ? '+' : ''}${number(result.delta)}.`));
  const afterCritical = new Set(result.criticalCells.map((cell) => `${cell.district}:${cell.indicator}`));
  const solved = BASELINE.criticalCells.filter((cell) => !afterCritical.has(`${cell.district}:${cell.indicator}`)).length;
  if (solved > 0) holder.append(makeInsight('Сняты критические значения', `${solved} из ${BASELINE.criticalCount} исходных показателей ниже 40 больше не находятся в критической зоне.`));
  if (result.criticalCount > 0) {
    const cells = result.criticalCells.map((cell) => `${cell.district} ${cell.indicator} (${number(cell.value)})`).join(', ');
    holder.append(makeInsight('Остаётся риск', `${result.criticalCount} ${plural(result.criticalCount, 'показатель', 'показателя', 'показателей')} ниже 40: ${cells}.`));
  } else holder.append(makeInsight('Критическая зона', 'После выбранных решений показателей строго ниже 40 нет.'));
  const negatives = result.districts.flatMap((district) => Object.keys(district.after).filter((key) => district.after[key] < district.before[key]).map((key) => ({ district: district.name, key, delta: district.after[key] - district.before[key] })));
  if (negatives.length) {
    const tradeoff = negatives.sort((a, b) => a.delta - b.delta)[0];
    const indicatorName = INDICATORS.find((indicator) => indicator.id === tradeoff.key)?.name ?? tradeoff.key;
    holder.append(makeInsight('Компромисс', `${tradeoff.district}: показатель «${indicatorName}» снижается на ${number(Math.abs(tradeoff.delta))}. Учитывайте это при изменении плана.`));
  } else {
    holder.append(makeInsight('Бюджет', `Из ${100} единиц использовано ${result.cost}; неиспользованный бюджет (${result.remaining}) не прибавляется к итоговому индексу.`));
  }
  if (result.synergies.length) {
    const synergyText = result.synergies.map((synergy) => `${synergy.measures.join(' + ')} → ${synergy.indicator} +${synergy.amount} в районе ${synergy.district}`).join('; ');
    holder.append(makeInsight('Сочетание мер', synergyText + '.'));
  }
}

function showResult(result) {
  byId('result-score').textContent = number(result.score);
  byId('score-delta').textContent = `${result.delta >= 0 ? '+' : ''}${number(result.delta)} к исходному индексу ${number(result.baseline)}`;
  byId('result-average').textContent = number(result.cityAverage);
  byId('result-weakest').textContent = result.weakestDistrict.name;
  byId('result-weakest-score').textContent = `Индекс района: ${number(result.weakestDistrict.score)}`;
  byId('result-critical').textContent = String(result.criticalCount);
  const districtResults = byId('district-results');
  districtResults.replaceChildren();
  for (const district of result.districts) {
    const row = el('div', 'district-row');
    row.append(el('span', 'district-name', district.name));
    const bars = el('div', 'district-bars');
    const before = el('div', 'district-bar before');
    const beforeFill = el('span');
    beforeFill.style.width = `${Math.max(0, Math.min(100, district.scoreBefore))}%`;
    before.append(beforeFill);
    before.title = `До: ${number(district.scoreBefore)}`;
    const after = el('div', 'district-bar after');
    const afterFill = el('span');
    afterFill.style.width = `${Math.max(0, Math.min(100, district.scoreAfter))}%`;
    after.append(afterFill);
    after.title = `После: ${number(district.scoreAfter)}`;
    bars.append(before, after);
    row.append(bars);
    const value = el('span', 'district-value', number(district.scoreAfter));
    value.append(el('small', '', `${district.scoreDelta >= 0 ? '+' : ''}${number(district.scoreDelta)} / до ${number(district.scoreBefore)}`));
    row.append(value);
    districtResults.append(row);
  }
  renderInsights(result);
  byId('results').hidden = false;
}

function calculate() {
  dispatch({ type: 'FINALIZE' });
  if (!state.result) {
    renderValidation();
    const status = byId('validation');
    if (state.plan.length !== 5) status.textContent = `Нужно выбрать ровно 5 мер. Сейчас выбрано ${state.plan.length}.`;
    status.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'center' });
    return;
  }
  if (sceneStatus.phase !== 'ready' && sceneStatus.phase !== 'loading') session.dispatch({ type: 'PLAYBACK_CONTROL', command: 'skip' });
  const target = state.mode === 'game' && state.playback.status !== 'complete' ? 'playback-panel' : 'results';
  byId(target).scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'start' });
}

async function requestAI() {
  if (!state.result || requestedAI || aiController) return;
  const result = state.result;
  const revision = state.planRevision;
  const button = byId('ai-button');
  const status = byId('ai-status');
  button.disabled = true;
  status.textContent = 'ИИ анализирует рассчитанный сценарий…';
  const controller = new AbortController();
  aiController = controller;
  const isCurrent = () => state.planRevision === revision && aiController === controller && state.result !== null;
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: result.plan }), signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!isCurrent()) return;
    if (typeof data.analysis !== 'string' || data.analysis.trim().length === 0 || data.source !== 'openai' || !Number.isFinite(data.score) || Math.abs(data.score - result.score) > 1e-7) throw new Error('Некорректный ответ');
    const output = byId('ai-output');
    output.textContent = data.analysis;
    output.hidden = false;
    status.textContent = 'Ответ ИИ. Числовой результат рассчитан алгоритмом.';
    requestedAI = true;
  } catch {
    if (!isCurrent()) return;
    status.textContent = 'ИИ недоступен. Разбор — выше.';
    button.disabled = false;
  } finally {
    clearTimeout(timeout);
    if (isCurrent()) { aiController = null; button.disabled = requestedAI; }
  }
}

byId('baseline-score').textContent = number(BASELINE.score);
byId('baseline-weakest').textContent = BASELINE.weakestDistrict.name;
byId('baseline-critical').textContent = String(BASELINE.criticalCount);
byId('sample-button').addEventListener('click', () => {
  dispatch({ type: 'LOAD_PLAN', plan: [
    { id: 'M7', district: 'Нура' },
    { id: 'M8', district: 'Нура' },
    { id: 'M10', district: 'Нура' },
    { id: 'M12', district: null },
    { id: 'M5', district: 'Сарыарка' },
  ] });
  $('#measures').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
byId('reset-button').addEventListener('click', () => dispatch({ type: 'RESET' }));
byId('calculate-button').addEventListener('click', calculate);
byId('back-button').addEventListener('click', () => $('#measures').scrollIntoView({ behavior: 'smooth', block: 'start' }));
byId('ai-button').addEventListener('click', requestAI);

function renderInspector() {
  const region = getRegion(state.focusedRegion);
  byId('district-title').textContent = region?.label ?? 'Выберите район';
  const holder = byId('district-indicators');
  holder.replaceChildren();
  if (!region) {
    byId('district-note').textContent = 'Выберите район.';
  } else if (!region.simulationDistrict) {
    byId('district-note').textContent = 'Сарайшық не участвует в расчёте.';
  } else {
    byId('district-note').textContent = region.regionId === 'nura' ? 'Меры будут назначены этому району.' : 'Меры будут назначены этому району.';
    const baseline = DISTRICTS.find((district) => district.name === region.simulationDistrict);
    const revealed = state.result && (state.mode === 'calculator' || state.playback.status === 'complete');
    const after = revealed ? state.result.districts.find((district) => district.name === region.simulationDistrict)?.after : null;
    for (const indicator of INDICATORS) {
      const row = el('div', 'inspector-indicator');
      const value = after?.[indicator.id] ?? baseline.indicators[indicator.id];
      row.append(el('span', '', indicator.name), el('strong', value < 40 ? 'is-critical' : '', number(value)));
      holder.append(row);
    }
  }
  const facts = byId('district-context');
  facts.replaceChildren();
  const observations = sceneStatus.cityData?.observations?.filter((item) => (item.regionId === region?.regionId || item.regionId === 'city') && item.status === 'verified' && Number.isFinite(item.value)) ?? [];
  if (!observations.length) facts.append(el('p', '', 'Показатели учебной модели.'));
  for (const item of observations) facts.append(el('p', '', `${item.regionId === 'city' ? 'Весь город · ' : ''}${item.definition || item.metric}: ${new Intl.NumberFormat('ru-RU').format(item.value)} ${item.unit} · ${item.asOf}`));
}

function completeWithoutScene() {
  if (currentCity !== 'astana') return;
  if (sceneStatus.phase === 'loading' || sceneStatus.phase === 'ready' || !state.result || state.playback.status === 'complete') return;
  const revision = state.planRevision;
  queueMicrotask(() => {
    if (state.planRevision === revision && state.result && state.playback.status !== 'complete' && sceneStatus.phase !== 'ready') session.dispatch({ type: 'PLAYBACK_CONTROL', command: 'skip' });
  });
}

function renderCityChrome() {
  const city=CITIES[currentCity], browsing=!city.simulation;
  byId('page-title').textContent=city.title;
  document.title=city.name+' — Аким на 5 часов';
  $('.intro-lead').textContent=browsing?'Улицы, здания и парки на реальной карте.':'5 решений. 100 единиц бюджета. 8 кварталов.';
  for(const selector of ['.intro-actions','.baseline-strip','.workspace','.personal-best','.mode-toolbar .segmented','.world-toolbar','.district-inspector','#region-buttons']) $(selector).hidden=browsing;
  byId('city-note').hidden=!browsing;
  if(browsing){byId('game-panel').hidden=false;byId('playback-panel').hidden=true;byId('results').hidden=true;}
  $('.scene-notice p').textContent=browsing?'Загружаем улицы и здания города.':'План доступен ниже.';
}
function renderShell() {
  const game = state.mode === 'game';
  byId('game-panel').hidden = !game;
  byId('mode-game').setAttribute('aria-pressed', String(game));
  byId('mode-calculator').setAttribute('aria-pressed', String(!game));
  byId('view-overview').setAttribute('aria-pressed', String(state.view === 'overview'));
  byId('view-district').setAttribute('aria-pressed', String(state.view === 'district'));
  byId('view-district').disabled = state.focusedRegion !== 'nura' || sceneStatus.phase !== 'ready';
  byId('view-overview').disabled = sceneStatus.phase !== 'ready';
  const revealed = state.result && (!game || state.playback.status === 'complete');
  byId('personal-best').textContent = state.result && !revealed ? 'После показа' : state.personalBest ? number(state.personalBest.score) : 'Ещё нет';
  for (const button of byId('region-buttons').children) button.setAttribute('aria-pressed', String(button.dataset.region === state.focusedRegion));
  byId('playback-panel').hidden = !state.result || !game;
  byId('playback-status').textContent = state.playback.status === 'complete' ? 'Расчёт завершён' : state.playback.status === 'paused' ? 'Показ на паузе' : 'Показываем последствия решений…';
  const pause = byId('playback-pause');
  pause.textContent = state.playback.status === 'paused' ? 'Продолжить' : 'Пауза';
  pause.disabled = sceneStatus.phase !== 'ready' || state.playback.status === 'complete';
  byId('playback-skip').disabled = state.playback.status === 'complete';
  byId('playback-replay').disabled = sceneStatus.phase !== 'ready' || state.playback.status !== 'complete';
  byId('playback-speed').value = String(state.playback.speed);
  byId('playback-speed').disabled = sceneStatus.phase !== 'ready';
  byId('calculate-button').disabled = !state.validation.valid;
  byId('calculate-button').textContent = game ? 'Применить план' : 'Рассчитать';
  if (revealed) showResult(state.result);
  else byId('results').hidden = true;
  renderInspector();
  completeWithoutScene();
  renderCityChrome();
}

for (const region of REGIONS) {
  const button = el('button', 'region-button', region.label);
  button.type = 'button';
  button.dataset.region = region.regionId;
  button.setAttribute('aria-pressed', 'false');
  if (!region.simulationDistrict) button.append(el('small', '', 'справка'));
  button.addEventListener('click', () => dispatch({ type: 'FOCUS_REGION', regionId: region.regionId }));
  byId('region-buttons').append(button);
}
for (const mode of ['game', 'calculator']) byId(`mode-${mode}`).addEventListener('click', () => dispatch({ type: 'SET_MODE', mode }));
for (const view of ['overview', 'district']) byId(`view-${view}`).addEventListener('click', () => dispatch({ type: 'SET_VIEW', view }));
byId('playback-pause').addEventListener('click', () => dispatch({ type: 'PLAYBACK_CONTROL', command: state.playback.status === 'paused' ? 'play' : 'pause' }));
for (const command of ['skip', 'replay']) byId(`playback-${command}`).addEventListener('click', () => dispatch({ type: 'PLAYBACK_CONTROL', command }));
byId('playback-speed').addEventListener('change', (event) => dispatch({ type: 'PLAYBACK_CONTROL', command: 'speed', speed: Number(event.target.value) }));
byId('scene-retry').addEventListener('click', () => adapter?.connect());

let previousSnapshot = null;
const unsubscribe = session.subscribe((next) => {
  const focusedKey = document.activeElement?.dataset.focusKey;
  const prior = previousSnapshot;
  state = next;
  previousSnapshot = next;
  const edited = !prior || prior.planRevision !== next.planRevision;
  if (edited) { clearResults(); renderSelections(); renderValidation(); }
  if (edited || prior.mode !== next.mode || prior.focusedRegion !== next.focusedRegion) renderCatalog();
  renderShell();
  if (focusedKey) {
    const replacement = [...document.querySelectorAll('[data-focus-key]')].find((item) => item.dataset.focusKey === focusedKey);
    if (replacement && !replacement.disabled) replacement.focus({ preventScroll: true });
    else if (focusedKey.startsWith('remove-')) document.querySelector(`[data-focus-key="measure-${focusedKey.slice(7)}"]`)?.focus({ preventScroll: true });
  }
});

adapter = createSceneAdapter({ root: byId('scene-root'), session, getCityId:()=>currentCity, onStatus(status) {
  sceneStatus = status;
  const ready = status.phase === 'ready';
  byId('scene-notice').hidden = ready;
  byId('scene-status').textContent = status.phase === 'loading' ? 'Подключаем город…' : 'Карта недоступна';
  byId('scene-retry').hidden = status.phase === 'loading' || ready;
  renderShell();
} });
byId('city-select').addEventListener('change', () => {
  const next = byId('city-select').value;
  if (!CITIES[next] || next === currentCity) return;
  if (state.playback.status === 'playing') dispatch({ type: 'PLAYBACK_CONTROL', command: 'pause' });
  currentCity = next;
  if (currentCity !== 'astana' && state.mode !== 'game') dispatch({ type: 'SET_MODE', mode: 'game' });
  renderCityChrome();
  adapter.connect();
});
adapter.connect();
window.addEventListener('pagehide', (event) => { if (event.persisted) return; adapter.destroy(); aiController?.abort(); unsubscribe(); session.destroy(); });
