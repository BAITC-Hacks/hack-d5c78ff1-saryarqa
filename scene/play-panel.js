import { MEASURES, DISTRICTS, BASELINE } from '../simulator.js';

const EXAMPLE_PLAN = [
  { id: 'M7', district: 'Нура' },
  { id: 'M8', district: 'Нура' },
  { id: 'M10', district: 'Нура' },
  { id: 'M12', district: null },
  { id: 'M5', district: 'Сарыарка' },
];
const measureNames = new Map(MEASURES.map((measure) => [measure.id, measure.name]));
const directionMarks = { 'Транспорт': '≋', 'Экология': '✳', 'Социальная сфера': '+', 'Безопасность': '◇', 'Сервисы': '⌘' };
const measureById = new Map(MEASURES.map((measure) => [measure.id, measure]));
const indicatorNames = { T1: 'Разгрузка дорог', T2: 'Общественный транспорт', E1: 'Озеленение', E2: 'Качество воздуха', S1: 'Школы и детские сады', S2: 'Первичная медицина', B1: 'Безопасность улиц', B2: 'Безопасность дорог', C1: 'Коммунальные сети', C2: 'Обращения жителей' };
const formatNumber = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const signed = (value) => `${value > 0 ? '+' : ''}${formatNumber.format(value)}`;
const describeError = (error) => String(error.message ?? error).replace(/\bM\d+\b/g, (id) => `«${measureNames.get(id) ?? id}»`);
let nextPanelId = 0;
let styleUsers = 0;
let styleElement = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, className = '') {
  const node = element('button', className, text);
  node.type = 'button';
  return node;
}
function loadStyles() {
  if (!styleElement) {
    styleElement = document.createElement('link');
    styleElement.rel = 'stylesheet';
    styleElement.href = new URL('./play-panel.css', import.meta.url).href;
    document.head.append(styleElement);
  }
  styleUsers += 1;
  return () => {
    styleUsers -= 1;
    if (!styleUsers) { styleElement?.remove(); styleElement = null; }
  };
}

/** A map HUD backed exclusively by the host's shared game session. */
export function createPlayPanel({ root, session }) {
  if (!root || !session?.subscribe || !session?.dispatch) throw new TypeError('createPlayPanel requires a root and a game session.');
  const removeStyles = loadStyles();
  const panelId = `atlas-plan-${++nextPanelId}`;
  let expanded = false;
  let destroyed = false;
  let snapshot = null;
  let actionError = '';
  let lastResult = null;
  const events = new AbortController();
  const on = (node, event, handler) => node.addEventListener(event, handler, { signal: events.signal });
  root.classList.add('atlas-play-panel');
  root.setAttribute('aria-label', 'План развития Астаны');
  const panel = element('section', 'atlas-play-content');
  const eyebrow = element('div', 'atlas-play-eyebrow', 'Кабинет акима');
  const header = element('div', 'atlas-play-header');
  const title = element('h2', '', 'План развития');
  const toggle = button('Выбрать', 'atlas-play-toggle');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', `${panelId}-editor`);
  header.append(title, toggle);
  const metrics = element('div', 'atlas-play-metrics');
  const budgetBox = element('div');
  const budget = element('strong', '', '100');
  budgetBox.append(budget, element('span', '', 'ед. осталось'));
  const countBox = element('div');
  const count = element('strong', '', '0 / 5');
  countBox.append(count, element('span', '', 'решений выбрано'));
  metrics.append(budgetBox, countBox);
  const progress = element('div', 'atlas-play-progress');
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-label', 'Оставшийся бюджет');
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', '100');
  const progressBar = element('span');
  progress.append(progressBar);
  const slots = element('div', 'atlas-play-slots');
  slots.setAttribute('aria-label', 'Пять решений городского плана');
  const slotButtons = Array.from({ length: 5 }, (_, index) => {
    const slot = button(String(index + 1).padStart(2, '0'), 'atlas-play-slot');
    slot.setAttribute('aria-label', `Выбрать решение ${index + 1}`);
    on(slot, 'click', () => {
      setExpanded(true);
      const selected = snapshot?.plan[index];
      if (selected) rows.get(selected.id)?.add.focus();
      else catalog.querySelector('button:not(:disabled)')?.focus();
    });
    slots.append(slot);
    return slot;
  });
  const planSummary = element('p', 'atlas-play-summary', 'Выбери пять решений для будущего города.');
  const editor = element('div', 'atlas-play-editor');
  editor.id = `${panelId}-editor`;
  editor.hidden = true;
  const rules = element('p', 'atlas-play-rules', 'Выбери пять решений в пределах 100 единиц. До двух в каждом направлении.');
  const catalog = element('div', 'atlas-play-catalog');
  const rows = new Map();
  for (const direction of [...new Set(MEASURES.map((measure) => measure.direction))]) {
    const group = element('section', 'atlas-play-group');
    const groupTitle = element('h3');
    const groupMark = element('span', 'atlas-play-direction-mark', directionMarks[direction]);
    groupMark.setAttribute('aria-hidden', 'true');
    groupTitle.append(groupMark, element('span', '', direction));
    group.append(groupTitle);
    for (const measure of MEASURES.filter((item) => item.direction === direction)) {
      const card = element('article', 'atlas-play-measure');
      const top = element('div', 'atlas-play-measure-top');
      const name = element('div', 'atlas-play-measure-name', measure.name);
      const add = button('+', 'atlas-play-add');
      add.setAttribute('aria-label', `Добавить: ${measure.name}`);
      top.append(name, add);
      const meta = element('div', 'atlas-play-measure-meta');
      const cost = element('span', 'atlas-play-measure-cost', `${measure.cost} ед.`);
      const scope = element('span', '', measure.scope === 'city' ? 'Весь город' : 'Один район');
      meta.append(cost, scope);
      const timing = element('p', 'atlas-play-measure-timing', `Начало эффекта через ${measure.lag} ${measure.lag === 1 ? 'квартал' : 'квартала'}`);
      const assignment = element('label', 'atlas-play-assignment');
      assignment.hidden = true;
      const label = element('span', '', 'Район реализации');
      const select = element('select');
      select.setAttribute('aria-label', `Район: ${measure.name}`);
      const placeholder = element('option', '', 'Выбери район');
      placeholder.value = '';
      select.append(placeholder);
      for (const district of DISTRICTS) {
        const option = element('option', '', district.name);
        option.value = district.name;
        select.append(option);
      }
      const unavailable = element('option', '', 'Сарайшық · вне расчёта');
      unavailable.disabled = true;
      unavailable.value = 'saraishyk';
      select.append(unavailable);
      assignment.append(label, select);
      card.append(top, meta, timing, assignment);
      on(add, 'click', () => {
        const selected = snapshot?.plan.some((decision) => decision.id === measure.id);
        dispatch({ type: selected ? 'REMOVE_MEASURE' : 'ADD_MEASURE', id: measure.id, district: null });
      });
      on(select, 'change', () => dispatch({ type: 'ASSIGN_MEASURE', id: measure.id, district: select.value || null }));
      rows.set(measure.id, { card, add, assignment, select, measure });
      group.append(card);
    }
    catalog.append(group);
  }
  const errors = element('ul', 'atlas-play-errors');
  const boundaryNote = element('p', 'atlas-play-boundary-note', 'В этом сценарии решения доступны для пяти районов. Сарайшық можно изучить на карте.');
  editor.append(rules, catalog, errors, boundaryNote);
  const status = element('p', 'atlas-play-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const launch = button('Запустить сценарий', 'atlas-play-primary');
  launch.disabled = true;
  const shortcuts = element('div', 'atlas-play-shortcuts');
  const example = button('Пример плана', 'atlas-play-text-button');
  const reset = button('Очистить', 'atlas-play-text-button');
  shortcuts.append(example, reset);
  const playback = element('div', 'atlas-play-playback');
  playback.hidden = true;
  const playbackHeading = element('p', 'atlas-play-playback-heading');
  const playbackButtons = element('div', 'atlas-play-playback-buttons');
  const pause = button('Пауза');
  const skip = button('К результату');
  const replay = button('Повторить');
  const speedLabel = element('label', 'atlas-play-speed');
  speedLabel.append(element('span', '', 'Скорость'));
  const speed = element('select');
  speed.setAttribute('aria-label', 'Скорость сценария');
  for (const value of [0.25, 0.5, 1, 2, 4]) {
    const option = element('option', '', `${formatNumber.format(value)}×`);
    option.value = String(value);
    speed.append(option);
  }
  speedLabel.append(speed);
  playbackButtons.append(pause, skip, replay);
  playback.append(playbackHeading, playbackButtons, speedLabel);
  const resultPanel = element('section', 'atlas-play-result');
  resultPanel.hidden = true;
  resultPanel.setAttribute('aria-label', 'Результат сценария');
  const resultHeader = element('div', 'atlas-play-result-header');
  const resultScore = element('strong');
  const resultDelta = element('span');
  resultHeader.append(resultScore, resultDelta);
  const resultDescription = element('p', '', 'Индекс городской жизни · сценарий');
  const gains = element('div', 'atlas-play-gains');
  const tradeoffs = element('div', 'atlas-play-tradeoffs');
  resultPanel.append(element('h3', '', 'Город после решений'), resultHeader, resultDescription, gains, tradeoffs);
  const best = element('p', 'atlas-play-best');
  const disclaimer = element('p', 'atlas-play-disclaimer', 'Игровой сценарий на реальной карте Астаны.');
  panel.append(eyebrow, header, metrics, progress, slots, planSummary, editor, status, launch, shortcuts, playback, resultPanel, best, disclaimer);
  root.append(panel);

  function dispatch(action) {
    actionError = '';
    const outcome = session.dispatch(action);
    if (outcome?.ok === false) {
      actionError = describeError(outcome.error);
      status.textContent = actionError;
      status.dataset.state = 'error';
    }
    return outcome;
  }
  function setExpanded(value) {
    expanded = value;
    editor.hidden = !value;
    toggle.textContent = value ? 'Свернуть' : snapshot?.plan.length ? 'Изменить' : 'Выбрать';
    toggle.setAttribute('aria-expanded', String(value));
    root.classList.toggle('is-expanded', value);
  }
  on(toggle, 'click', () => setExpanded(!expanded));
  on(panel, 'keydown', (event) => {
    if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      event.stopPropagation();
      setExpanded(false);
      toggle.focus();
    }
  });
  // Keep map gestures and map keyboard shortcuts out of native form controls.
  for (const eventName of ['pointerdown', 'dblclick', 'wheel']) on(panel, eventName, (event) => event.stopPropagation());
  on(panel, 'keydown', (event) => event.stopPropagation());
  on(example, 'click', () => dispatch({ type: 'LOAD_PLAN', plan: EXAMPLE_PLAN }));
  on(reset, 'click', () => dispatch({ type: 'RESET' }));
  on(launch, 'click', () => {
    if (dispatch({ type: 'FINALIZE' })?.ok !== false) setExpanded(false);
  });
  on(pause, 'click', () => dispatch({ type: 'PLAYBACK_CONTROL', command: snapshot?.playback.status === 'paused' ? 'play' : 'pause' }));
  on(skip, 'click', () => dispatch({ type: 'PLAYBACK_CONTROL', command: 'skip' }));
  on(replay, 'click', () => dispatch({ type: 'PLAYBACK_CONTROL', command: 'replay' }));
  on(speed, 'change', () => dispatch({ type: 'PLAYBACK_CONTROL', command: 'speed', speed: Number(speed.value) }));

  function renderResult(result) {
    resultScore.textContent = formatNumber.format(result.score);
    resultDelta.textContent = `${signed(result.delta)} к старту`;
    resultDelta.dataset.sign = result.delta < 0 ? 'negative' : 'positive';
    gains.replaceChildren();
    for (const district of result.districts) {
      const row = element('div', 'atlas-play-gain');
      const detail = element('span', '', `${formatNumber.format(district.scoreBefore)} → ${formatNumber.format(district.scoreAfter)}`);
      const delta = element('strong', '', signed(district.scoreDelta));
      delta.dataset.sign = district.scoreDelta < 0 ? 'negative' : 'positive';
      row.append(element('span', '', district.name), detail, delta);
      gains.append(row);
    }
    tradeoffs.replaceChildren();
    const negatives = result.districts.flatMap((district) => Object.keys(district.after).filter((id) => district.after[id] < district.before[id]).map((id) => `${district.name}: ${indicatorNames[id] ?? id} ${signed(district.after[id] - district.before[id])}`));
    if (negatives.length) {
      tradeoffs.append(element('h4', '', 'Обратная сторона решений'));
      for (const text of negatives) tradeoffs.append(element('p', '', text));
    }
    const critical = element('p', 'atlas-play-critical', `Критических показателей: ${result.criticalCount} (было ${BASELINE.criticalCount}).`);
    tradeoffs.append(critical);
  }
  function render(current) {
    if (destroyed) return;
    snapshot = current;
    const plan = current.plan ?? [];
    const validation = current.validation ?? { valid: false, cost: 0, errors: [] };
    const planById = new Map(plan.map((decision) => [decision.id, decision]));
    const remaining = 100 - validation.cost;
    budget.textContent = String(remaining);
    budgetBox.classList.toggle('is-over-budget', remaining < 0);
    count.textContent = `${plan.length} / 5`;
    progress.setAttribute('aria-valuenow', String(Math.max(0, remaining)));
    progress.setAttribute('aria-valuetext', `Осталось ${remaining} из 100 единиц`);
    progress.classList.toggle('is-over-budget', remaining < 0);
    progressBar.style.width = `${Math.max(0, Math.min(100, remaining))}%`;
    toggle.textContent = expanded ? 'Свернуть' : plan.length ? 'Изменить' : 'Выбрать';
    slotButtons.forEach((slot, index) => {
      const decision = plan[index];
      const measure = measureById.get(decision?.id);
      slot.classList.toggle('is-filled', Boolean(measure));
      slot.classList.toggle('is-unassigned', Boolean(measure && measure.scope === 'district' && !decision.district));
      slot.textContent = measure ? directionMarks[measure.direction] : String(index + 1).padStart(2, '0');
      const description = measure ? `${measure.name} · ${decision.district || (measure.scope === 'city' ? 'Весь город' : 'Выбери район')}` : `Выбрать решение ${index + 1}`;
      slot.title = description;
      slot.setAttribute('aria-label', description);
    });
    planSummary.textContent = plan.length ? [...new Set(plan.map((choice) => choice.district || (measureById.get(choice.id)?.scope === 'city' ? 'Весь город' : 'Выбери район')))].join(' · ') : 'Выбери пять решений для будущего города.';
    for (const [id, row] of rows) {
      const decision = planById.get(id);
      const selected = Boolean(decision);
      row.card.classList.toggle('is-selected', selected);
      row.add.textContent = selected ? '−' : '+';
      row.add.disabled = !selected && plan.length >= 5;
      row.add.setAttribute('aria-pressed', String(selected));
      row.add.setAttribute('aria-label', `${selected ? 'Убрать' : 'Добавить'}: ${row.measure.name}`);
      row.assignment.hidden = !selected || row.measure.scope === 'city';
      const nextDistrict = decision?.district ?? '';
      if (row.select.value !== nextDistrict) row.select.value = nextDistrict;
    }
    errors.replaceChildren(...(validation.errors ?? []).map((error) => element('li', '', describeError(error))));
    errors.hidden = validation.valid;
    const valid = validation.valid;
    launch.disabled = !valid;
    launch.hidden = Boolean(current.result);
    status.dataset.state = actionError ? 'error' : valid ? 'ready' : 'draft';
    status.textContent = actionError || (current.result ? '' : valid ? 'План готов к запуску.' : plan.length === 0 ? '' : `Осталось уточнить план · ${validation.errors?.length ?? 0}`);
    status.hidden = !status.textContent;
    reset.disabled = plan.length === 0;
    const playing = current.playback?.status === 'playing';
    const paused = current.playback?.status === 'paused';
    const revealed = Boolean(current.result) && (current.mode === 'calculator' || current.playback?.status === 'complete');
    playback.hidden = !current.result;
    playbackHeading.textContent = revealed ? 'Сценарий завершён' : paused ? 'Сценарий на паузе' : 'Решения меняют город…';
    pause.hidden = !playing && !paused;
    pause.textContent = paused ? 'Продолжить' : 'Пауза';
    skip.hidden = revealed;
    replay.hidden = !revealed;
    speedLabel.hidden = revealed;
    if (speed.value !== String(current.playback?.speed ?? 1)) speed.value = String(current.playback?.speed ?? 1);
    resultPanel.hidden = !revealed;
    if (revealed && lastResult !== current.result) {
      renderResult(current.result);
      lastResult = current.result;
    }
    best.hidden = !current.personalBest || (Boolean(current.result) && !revealed);
    best.textContent = current.personalBest ? `Твой лучший результат · ${formatNumber.format(current.personalBest.score)}` : '';
  }
  const unsubscribe = session.subscribe(render);
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      events.abort();
      panel.remove();
      root.classList.remove('atlas-play-panel', 'is-expanded');
      root.removeAttribute('aria-label');
      removeStyles();
    },
  };
}
