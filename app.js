import { DISTRICTS, INDICATORS, MEASURES, BASELINE, validatePlan, calculatePlan } from './simulator.js';

const $ = (selector) => document.querySelector(selector);
const byId = (id) => document.getElementById(id);
const number = (value, digits = 2) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const groups = [...new Set(MEASURES.map((measure) => measure.direction))];
const state = { plan: [], result: null, requestedAI: false };

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
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', `${selected ? 'Убрать' : 'Выбрать'}: ${item.name}, стоимость ${item.cost}, ${item.scope === 'city' ? 'весь город' : 'выбрать район'}`);
      button.disabled = !selected && state.plan.length >= 5;
      const top = el('div', 'measure-card-top');
      top.append(el('span', 'measure-id', item.id), el('span', 'measure-check', selected ? '✓' : '+'));
      const bottom = el('div', 'measure-card-bottom');
      bottom.append(el('span', '', item.scope === 'city' ? 'Весь город' : 'Один район'), el('span', 'measure-cost', `${item.cost} ед.`));
      button.append(top, el('div', 'measure-title', item.name), bottom);
      button.addEventListener('click', () => toggleMeasure(item.id));
      list.append(button);
    }
    group.append(list);
    container.append(group);
  }
}

function toggleMeasure(id) {
  const current = state.plan.findIndex((choice) => choice.id === id);
  if (current >= 0) state.plan.splice(current, 1);
  else if (state.plan.length < 5) state.plan.push({ id, district: measure(id).scope === 'city' ? null : null });
  clearResults();
  render();
}

function renderSelections() {
  const list = byId('selected-list');
  list.replaceChildren();
  if (state.plan.length === 0) {
    list.append(el('li', 'selected-empty', 'Пока нет решений. Выберите меру слева.'));
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
        choice.district = event.target.value || null;
        clearResults();
        renderValidation();
      });
      body.append(select);
    }
    row.append(body);
    const remove = el('button', 'selected-remove', '×');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Убрать ${item.name}`);
    remove.addEventListener('click', () => toggleMeasure(choice.id));
    row.append(remove);
    list.append(row);
  });
}

function renderValidation() {
  const validation = validatePlan(state.plan);
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
  state.result = null;
  state.requestedAI = false;
  byId('results').hidden = true;
  byId('ai-button').disabled = false;
  byId('ai-output').hidden = true;
  byId('ai-output').replaceChildren();
  byId('ai-status').textContent = 'ИИ объясняет готовый расчёт. Для ответа нужен подключённый API.';
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
  state.result = result;
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
  byId('results').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}

function calculate() {
  const result = calculatePlan(state.plan);
  if (!result.valid) {
    renderValidation();
    const status = byId('validation');
    if (state.plan.length !== 5) status.textContent = `Нужно выбрать ровно 5 мер. Сейчас выбрано ${state.plan.length}.`;
    status.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  showResult(result);
}

async function requestAI() {
  if (!state.result || state.requestedAI) return;
  const button = byId('ai-button');
  const status = byId('ai-status');
  button.disabled = true;
  status.textContent = 'ИИ анализирует рассчитанный сценарий…';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: state.result.plan }), signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (typeof data.analysis !== 'string' || data.analysis.trim().length === 0 || data.source !== 'openai' || Math.abs(data.score - state.result.score) > 1e-7) throw new Error('Некорректный ответ');
    const output = byId('ai-output');
    output.textContent = data.analysis;
    output.hidden = false;
    status.textContent = 'Ответ ИИ. Числовой результат рассчитан алгоритмом.';
    state.requestedAI = true;
  } catch {
    status.textContent = 'ИИ сейчас недоступен. Разбор рассчитанных данных выше остаётся доступным.';
    button.disabled = false;
  } finally {
    clearTimeout(timeout);
    if (state.requestedAI) button.disabled = true;
  }
}

byId('baseline-score').textContent = number(BASELINE.score);
byId('baseline-weakest').textContent = BASELINE.weakestDistrict.name;
byId('baseline-critical').textContent = String(BASELINE.criticalCount);
byId('sample-button').addEventListener('click', () => {
  state.plan = [
    { id: 'M7', district: 'Нура' },
    { id: 'M8', district: 'Нура' },
    { id: 'M10', district: 'Нура' },
    { id: 'M12', district: null },
    { id: 'M5', district: 'Сарыарка' },
  ];
  clearResults();
  render();
  $('#measures').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
byId('reset-button').addEventListener('click', () => { state.plan = []; clearResults(); render(); });
byId('calculate-button').addEventListener('click', calculate);
byId('back-button').addEventListener('click', () => $('#measures').scrollIntoView({ behavior: 'smooth', block: 'start' }));
byId('ai-button').addEventListener('click', requestAI);
render();
