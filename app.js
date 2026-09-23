import { DISTRICTS, INDICATORS, MEASURES, BASELINE, realizedMeasureEffects } from './simulator.js';
import { createGameSession } from './game/session.js';
import { REGIONS, getRegion } from './game/contracts.js';
import { createSceneAdapter } from './game/scene-adapter.js';
import { createForecast } from './game/forecast.js';
import { policyArt, iconArt } from './game/art.js';

const $ = (selector) => document.querySelector(selector);
const byId = (id) => document.getElementById(id);
const number = (value, digits = 2) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const groups = [...new Set(MEASURES.map((measure) => measure.direction))];
let browserStorage;
try { browserStorage = window.localStorage; } catch { browserStorage = null; }
const session = createGameSession({ storage: browserStorage });
let state = session.getSnapshot();
let requestedAI = new Map();
let forecast = null;
let forecastRevision = -1;
let selectedCategory = 'Все';
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
const measureNames = { M1:'Автобусные полосы', M2:'Умные светофоры', M3:'ЛРТ', M4:'Парк', M5:'Чистое топливо', M6:'Озеленение', M7:'Школа и детсад', M8:'Поликлиника', M9:'Спорт во дворах', M10:'Свет и камеры', M11:'Безопасные переходы', M12:'Обращения жителей', M13:'Тепло и вода', M14:'Аварийные бригады' };

function artImage(art, className) {
  const image = el('img', className);
  image.src = art.href; image.alt = ''; image.width = art.width; image.height = art.height;
  image.loading = 'lazy'; image.decoding = 'async';
  return image;
}

function setPlannerTab(tab, focus = false) {
  for (const name of ['measures', 'plan']) {
    const selected = name === tab;
    byId(`tab-${name}`).setAttribute('aria-selected', String(selected));
    byId(`tab-${name}`).tabIndex = selected ? 0 : -1;
    byId(name === 'measures' ? 'measures' : 'plan-panel').hidden = !selected;
  }
  if (focus) byId(`tab-${tab}`).focus();
}

const categoryNames = ['Транспорт', 'Экология', 'Соцсфера', 'Безопасность', 'Сервисы'];
for (const [index, group] of ['Все', ...groups].entries()) {
  const button = el('button', '', index === 0 ? 'Все' : categoryNames[index - 1]);
  button.type = 'button'; button.dataset.category = group;
  button.setAttribute('aria-pressed', String(index === 0));
  const icon = iconArt(`category-${['transport','ecology','social','safety','services'][index - 1]}`);
  if (icon) button.prepend(artImage(icon, 'category-icon'));
  button.addEventListener('click', () => {
    selectedCategory = group;
    for (const item of byId('category-filter').children) item.setAttribute('aria-pressed', String(item === button));
    renderCatalog();
  });
  byId('category-filter').append(button);
}
for (const tab of ['measures', 'plan']) {
  byId(`tab-${tab}`).addEventListener('click', () => setPlannerTab(tab));
  byId(`tab-${tab}`).addEventListener('keydown', event => {
    if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
      event.preventDefault(); setPlannerTab(event.key === 'Home' ? 'measures' : event.key === 'End' ? 'plan' : tab === 'plan' ? 'measures' : 'plan', true);
    }
  });
}
setPlannerTab('measures');

function renderCatalog() {
  const container = byId('measure-groups');
  container.replaceChildren();
  for (const groupName of groups) {
    if (selectedCategory !== 'Все' && selectedCategory !== groupName) continue;
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
      const preview = el('span', 'measure-preview', `Эффект через ${item.lag} кв.`);
      preview.title = 'Изменения показателей к концу восьми кварталов, без отдельных бонусов сочетания мер.';
      const artwork = policyArt(item.id, 'object');
      if (artwork) button.append(artImage(artwork, 'measure-art'));
      button.append(top, el('div', 'measure-title', measureNames[item.id]), preview, bottom);
      button.title = `${item.name} · ${effectText} · ${item.lag} кв.`;
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
    list.append(el('li', 'selected-empty', 'Выберите меры, затем назначьте районы.'));
    return;
  }
  state.plan.forEach((choice, index) => {
    const item = measure(choice.id);
    const row = el('li', 'selected-item');
    row.append(el('span', 'selected-index', String(index + 1).padStart(2, '0')));
    const body = el('div');
    body.append(el('div', 'selected-title', measureNames[item.id]));
    body.append(el('div', 'selected-meta', `${item.cost} ед. · ${item.lag} кв.${item.scope === 'city' ? ' · весь город' : ''}`));
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
  byId('plan-tab-count').textContent = String(state.plan.length);
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
  requestedAI.clear();
  forecast = null;
  forecastRevision = -1;
  byId('results').hidden = true;
  byId('ai-button').disabled = false;
  byId('ai-advice-button').disabled = false;
  byId('ai-output').hidden = true;
  byId('ai-output').replaceChildren();
  byId('ai-status').textContent = 'Объяснит последствия и компромиссы.';
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
  holder.append(makeInsight('Наибольший рост', `${top.name}: +${number(top.scoreDelta)} к индексу района.`));
  const afterCritical = new Set(result.criticalCells.map((cell) => `${cell.district}:${cell.indicator}`));
  const solved = BASELINE.criticalCells.filter((cell) => !afterCritical.has(`${cell.district}:${cell.indicator}`)).length;
  if (solved > 0) holder.append(makeInsight('Выход из критической зоны', `${solved} из ${BASELINE.criticalCount} исходных проблемных показателей достигли 40.`));
  if (result.criticalCount > 0) {
    const cells = result.criticalCells.map((cell) => `${cell.district} ${cell.indicator} (${number(cell.value)})`).join(', ');
    holder.append(makeInsight('Остаётся риск', `${result.criticalCount} ${plural(result.criticalCount, 'показатель', 'показателя', 'показателей')} ниже 40: ${cells}.`));
  }
  const negatives = result.districts.flatMap((district) => Object.keys(district.after).filter((key) => district.after[key] < district.before[key]).map((key) => ({ district: district.name, key, delta: district.after[key] - district.before[key] })));
  if (negatives.length) {
    const tradeoff = negatives.sort((a, b) => a.delta - b.delta)[0];
    const indicatorName = INDICATORS.find((indicator) => indicator.id === tradeoff.key)?.name ?? tradeoff.key;
    holder.append(makeInsight('Компромисс', `${tradeoff.district}: ${indicatorName.toLowerCase()} −${number(Math.abs(tradeoff.delta))}.`));
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
  if (forecastRevision !== state.planRevision) {
    forecast = createForecast(result);
    forecastRevision = state.planRevision;
    renderForecast();
  }
  byId('results').hidden = false;
}

function renderForecast() {
  const holder = byId('forecast-suggestions');
  const changes = byId('forecast-changes');
  holder.replaceChildren(); changes.replaceChildren();
  if (!forecast) return;
  if (!forecast.suggestions.length) holder.append(el('p', 'subtle', 'Одной заменой улучшить этот план не удалось.'));
  for (const suggestion of forecast.suggestions) {
    const card = el('div', 'suggestion');
    const body = el('div');
    body.append(el('strong', '', `${measureNames[suggestion.replaced.id]} → ${measureNames[suggestion.replacement.id]}`));
    body.append(el('p', '', suggestion.replacement.district ?? 'Весь город'));
    body.append(el('p', '', `Бюджет ${suggestion.result.cost}/100 · индекс ${number(suggestion.result.score)}`));
    body.append(el('span', 'suggestion-gain', `+${number(suggestion.delta)} к вашему плану`));
    const button = el('button', '', 'Попробовать'); button.type = 'button';
    button.addEventListener('click', () => {
      dispatch({ type: 'LOAD_PLAN', plan: suggestion.plan });
      setPlannerTab('plan');
      byId('plan-panel').scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'center' });
      byId('calculate-button').focus({ preventScroll: true });
    });
    card.append(body, button); holder.append(card);
  }
  for (const change of forecast.changes.filter(item => Math.abs(item.delta) > 1e-8)) {
    const row = el('div', 'forecast-change');
    const label = el('span', '', change.name); label.append(el('small', '', change.district));
    row.append(label, el('strong', change.delta < 0 ? 'is-critical' : '', `${number(change.before)} → ${number(change.after)}`));
    changes.append(row);
  }
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

async function requestAI(mode = 'analysis') {
  if (!state.result || aiController) return;
  if (requestedAI.has(mode)) {
    byId('ai-output').textContent = requestedAI.get(mode);
    byId('ai-output').hidden = false;
    byId('ai-status').textContent = mode === 'advice' ? 'Совет AI по рассчитанным вариантам.' : 'AI-разбор вашего сценария.';
    return;
  }
  const result = state.result;
  const revision = state.planRevision;
  const button = byId('ai-button');
  const status = byId('ai-status');
  button.disabled = true;
  byId('ai-advice-button').disabled = true;
  status.textContent = mode === 'advice' ? 'Сравниваем варианты…' : 'Анализируем ваш сценарий…';
  const controller = new AbortController();
  aiController = controller;
  const isCurrent = () => state.planRevision === revision && aiController === controller && state.result !== null;
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: result.plan, mode }), signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!isCurrent()) return;
    if (typeof data.analysis !== 'string' || data.analysis.trim().length === 0 || data.source !== 'openai' || !Number.isFinite(data.score) || Math.abs(data.score - result.score) > 1e-7) throw new Error('Некорректный ответ');
    const output = byId('ai-output');
    output.textContent = data.analysis;
    output.hidden = false;
    status.textContent = mode === 'advice' ? 'Совет AI по рассчитанным вариантам.' : 'AI-разбор вашего сценария.';
    requestedAI.set(mode, data.analysis);
  } catch {
    if (!isCurrent()) return;
    status.textContent = 'AI временно недоступен. Расчёт и варианты улучшения доступны рядом.';
    button.disabled = false;
  } finally {
    clearTimeout(timeout);
    if (isCurrent()) { aiController = null; button.disabled = false; byId('ai-advice-button').disabled = false; }
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
  setPlannerTab('plan');
  byId('plan-panel').scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'center' });
});
byId('reset-button').addEventListener('click', () => dispatch({ type: 'RESET' }));
byId('calculate-button').addEventListener('click', calculate);
byId('back-button').addEventListener('click', () => { setPlannerTab('plan'); byId('plan-panel').scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'start' }); });
byId('ai-button').addEventListener('click', () => requestAI('analysis'));
byId('ai-advice-button').addEventListener('click', () => requestAI('advice'));

function renderInspector() {
  const region = getRegion(state.focusedRegion);
  byId('district-title').textContent = region?.label ?? 'Выберите район';
  const holder = byId('district-indicators');
  holder.replaceChildren();
  if (!region) {
    byId('district-note').textContent = 'Выберите район на карте или над ней.';
  } else if (!region.simulationDistrict) {
    byId('district-note').textContent = 'Сарайшық показан для справки. В учебном наборе нет его показателей: назначать районные меры сюда нельзя.';
  } else {
    byId('district-note').textContent = 'Новые районные меры будут назначены сюда.';
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
  for (const item of observations) facts.append(el('p', '', `${item.regionId === 'city' ? 'Весь город · ' : ''}${item.definition || item.metric}: ${new Intl.NumberFormat('ru-RU').format(item.value)} ${item.unit} · ${item.asOf}`));
}

function completeWithoutScene() {
  if (sceneStatus.phase === 'loading' || sceneStatus.phase === 'ready' || !state.result || state.playback.status === 'complete') return;
  const revision = state.planRevision;
  queueMicrotask(() => {
    if (state.planRevision === revision && state.result && state.playback.status !== 'complete' && sceneStatus.phase !== 'ready') session.dispatch({ type: 'PLAYBACK_CONTROL', command: 'skip' });
  });
}

function renderShell() {
  const game = state.mode === 'game';
  byId('game-panel').hidden = !game;
  byId('mode-game').setAttribute('aria-pressed', String(game));
  byId('mode-calculator').setAttribute('aria-pressed', String(!game));
  for (const projection of ['top', 'tilted']) {
    byId(`projection-${projection}`)?.setAttribute('aria-pressed', String(state.projection === projection));
  }
  const revealed = state.result && (!game || state.playback.status === 'complete');
  byId('personal-best').textContent = state.result && !revealed ? '—' : state.personalBest ? number(state.personalBest.score) : '—';
  for (const button of byId('region-buttons').children) button.setAttribute('aria-pressed', String(button.dataset.region === state.focusedRegion));
  byId('playback-panel').hidden = !state.result || !game;
  byId('playback-status').textContent = state.playback.status === 'complete' ? 'Прогноз готов' : state.playback.status === 'paused' ? 'На паузе' : 'Город меняется…';
  const pause = byId('playback-pause');
  pause.textContent = state.playback.status === 'paused' ? 'Продолжить' : 'Пауза';
  pause.disabled = sceneStatus.phase !== 'ready' || state.playback.status === 'complete';
  byId('playback-skip').disabled = state.playback.status === 'complete';
  byId('playback-replay').disabled = sceneStatus.phase !== 'ready' || state.playback.status !== 'complete';
  byId('playback-speed').value = String(state.playback.speed);
  byId('playback-speed').disabled = sceneStatus.phase !== 'ready';
  byId('calculate-button').disabled = !state.validation.valid;
  byId('calculate-button').textContent = 'Показать прогноз';
  if (revealed) showResult(state.result);
  else byId('results').hidden = true;
  renderInspector();
  completeWithoutScene();
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

adapter = createSceneAdapter({ root: byId('scene-root'), session, onStatus(status) {
  sceneStatus = status;
  const ready = status.phase === 'ready';
  byId('scene-notice').hidden = ready;
  byId('scene-status').textContent = status.phase === 'loading' ? 'Загружаем карту…' : 'Карта временно недоступна';
  byId('scene-retry').hidden = status.phase === 'loading' || ready;
  renderShell();
} });
adapter.connect();
window.addEventListener('pagehide', (event) => { if (event.persisted) return; adapter.destroy(); aiController?.abort(); unsubscribe(); session.destroy(); });
