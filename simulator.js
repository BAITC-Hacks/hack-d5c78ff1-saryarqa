/** Deterministic rules for the HackAlem district simulator. No network or AI calls. */
export const RULES_VERSION = 'hackalem-v1';
export const SIMULATION_HORIZON = 8;
export const INDICATORS = Object.freeze([
  { id: 'T1', name: 'Разгрузка дорог', direction: 'Транспорт', weight: 0.10 },
  { id: 'T2', name: 'Доступность общественного транспорта', direction: 'Транспорт', weight: 0.10 },
  { id: 'E1', name: 'Озеленение', direction: 'Экология', weight: 0.09 },
  { id: 'E2', name: 'Качество воздуха', direction: 'Экология', weight: 0.11 },
  { id: 'S1', name: 'Школы и детские сады', direction: 'Социальная сфера', weight: 0.11 },
  { id: 'S2', name: 'Поликлиники и первичная помощь', direction: 'Социальная сфера', weight: 0.11 },
  { id: 'B1', name: 'Безопасность улиц', direction: 'Безопасность', weight: 0.09 },
  { id: 'B2', name: 'Безопасность дорог', direction: 'Безопасность', weight: 0.09 },
  { id: 'C1', name: 'Надёжность коммунальных сетей', direction: 'Сервисы', weight: 0.10 },
  { id: 'C2', name: 'Обработка обращений жителей', direction: 'Сервисы', weight: 0.10 },
]);

export const DISTRICTS = Object.freeze([
  { name: 'Есиль', population: 0.27, indicators: { T1: 45, T2: 62, E1: 68, E2: 72, S1: 48, S2: 55, B1: 78, B2: 60, C1: 75, C2: 70 } },
  { name: 'Алматы', population: 0.24, indicators: { T1: 40, T2: 75, E1: 50, E2: 55, S1: 60, S2: 65, B1: 62, B2: 52, C1: 50, C2: 60 } },
  { name: 'Сарыарка', population: 0.20, indicators: { T1: 50, T2: 70, E1: 42, E2: 40, S1: 62, S2: 68, B1: 58, B2: 55, C1: 45, C2: 55 } },
  { name: 'Байконур', population: 0.13, indicators: { T1: 52, T2: 68, E1: 55, E2: 50, S1: 58, S2: 60, B1: 52, B2: 58, C1: 55, C2: 58 } },
  { name: 'Нура', population: 0.16, indicators: { T1: 55, T2: 40, E1: 45, E2: 65, S1: 38, S2: 35, B1: 55, B2: 50, C1: 60, C2: 50 } },
]);

export const MEASURES = Object.freeze([
  { id: 'M1', name: 'Выделенные автобусные полосы', direction: 'Транспорт', scope: 'district', cost: 18, lag: 2, effects: { T1: 6, T2: 9 } },
  { id: 'M2', name: 'Адаптивные умные светофоры', direction: 'Транспорт', scope: 'city', cost: 22, lag: 2, effects: { T1: 4, B2: 3 } },
  { id: 'M3', name: 'Линия или расширение ЛРТ', direction: 'Транспорт', scope: 'district', cost: 30, lag: 4, effects: { T1: 16, T2: 20, E2: 4 } },
  { id: 'M4', name: 'Парк или сквер', direction: 'Экология', scope: 'district', cost: 15, lag: 2, effects: { E1: 12, E2: 3, B1: 2 } },
  { id: 'M5', name: 'Чистое топливо для частного сектора', direction: 'Экология', scope: 'district', cost: 25, lag: 3, effects: { E2: 14, C1: 4 } },
  { id: 'M6', name: 'Городская программа озеленения и ветрозащиты', direction: 'Экология', scope: 'city', cost: 20, lag: 4, effects: { E1: 5, E2: 3 } },
  { id: 'M7', name: 'Модульная школа и детский сад', direction: 'Социальная сфера', scope: 'district', cost: 24, lag: 3, effects: { S1: 16 } },
  { id: 'M8', name: 'Центр семейного здоровья', direction: 'Социальная сфера', scope: 'district', cost: 20, lag: 3, effects: { S2: 14 } },
  { id: 'M9', name: 'Дворовые спортивные хабы', direction: 'Социальная сфера', scope: 'district', cost: 10, lag: 1, effects: { S1: 3, S2: 3, B1: 3 } },
  { id: 'M10', name: 'Освещение и камеры Безопасный город', direction: 'Безопасность', scope: 'district', cost: 12, lag: 1, effects: { B1: 12, B2: 2 } },
  { id: 'M11', name: 'Безопасные переходы и школьные зоны', direction: 'Безопасность', scope: 'district', cost: 10, lag: 1, effects: { B2: 12, T1: -2 } },
  { id: 'M12', name: 'Единая цифровая платформа обращений', direction: 'Сервисы', scope: 'city', cost: 14, lag: 1, effects: { C2: 5 } },
  { id: 'M13', name: 'Модернизация сетей тепла и воды', direction: 'Сервисы', scope: 'district', cost: 28, lag: 4, effects: { C1: 18, E2: 2 } },
  { id: 'M14', name: 'Аварийные коммунальные бригады и раннее оповещение', direction: 'Сервисы', scope: 'city', cost: 16, lag: 1, effects: { C1: 5, C2: 2 } },
]);

const measureById = new Map(MEASURES.map((measure) => [measure.id, measure]));
const districtNames = new Set(DISTRICTS.map((district) => district.name));
const indicatorIds = INDICATORS.map((indicator) => indicator.id);
const scoreDistrict = (values) => INDICATORS.reduce((sum, indicator) => sum + indicator.weight * values[indicator.id], 0);
const clamp = (value) => Math.min(100, Math.max(0, value));
const ordered = (plan) => [...plan].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
const error = (code, message) => ({ code, message });

/** Lag-adjusted indicator effects shared by scoring and draft previews. */
export function realizedMeasureEffects(measure) {
  const factor = (SIMULATION_HORIZON - measure.lag) / SIMULATION_HORIZON;
  const effects = Object.fromEntries(Object.entries(measure.effects).map(([id, full]) => [id, full * factor]));
  return { factor, effects };
}

/** Returns explicit errors and cost; never alters the supplied plan. */
export function validatePlan(plan) {
  if (!Array.isArray(plan)) {
    return { valid: false, errors: [error('EXACTLY_FIVE_REQUIRED', 'Выберите ровно 5 мероприятий.')], cost: 0 };
  }
  const errors = [];
  if (plan.length !== 5) errors.push(error('EXACTLY_FIVE_REQUIRED', 'Выберите ровно 5 мероприятий.'));
  const seen = new Set();
  const directions = new Map();
  const selected = new Map();
  let cost = 0;
  for (const choice of plan) {
    const id = choice && typeof choice === 'object' ? choice.id : undefined;
    const measure = measureById.get(id);
    if (!measure) {
      errors.push(error('UNKNOWN_MEASURE', `Неизвестное мероприятие: ${String(id)}.`));
      continue;
    }
    if (seen.has(id)) errors.push(error('DUPLICATE_MEASURE', `${id} выбрано более одного раза.`));
    seen.add(id);
    selected.set(id, choice);
    cost += measure.cost;
    directions.set(measure.direction, (directions.get(measure.direction) || 0) + 1);
    if (measure.scope === 'district') {
      if (choice.district === null || choice.district === undefined || choice.district === '') {
        errors.push(error('DISTRICT_REQUIRED', `Укажите район для ${id}.`));
      } else if (!districtNames.has(choice.district)) {
        errors.push(error('UNKNOWN_DISTRICT', `Неизвестный район для ${id}: ${String(choice.district)}.`));
      }
    } else if (choice.district !== null && choice.district !== undefined) {
      errors.push(error('DISTRICT_FORBIDDEN', `${id} действует на весь город: район не выбирается.`));
    }
  }
  if (cost > 100) errors.push(error('BUDGET_EXCEEDED', `Стоимость ${cost} превышает бюджет 100.`));
  for (const [direction, count] of directions) {
    if (count > 2) errors.push(error('DIRECTION_LIMIT_EXCEEDED', `Направление «${direction}»: максимум 2 мероприятия.`));
  }
  if (selected.has('M1') && selected.has('M3')) {
    errors.push(error('INCOMPATIBLE_GLOBAL_PAIR', 'M1 и M3 нельзя выбрать вместе.'));
  }
  for (const [first, second] of [['M4', 'M7'], ['M5', 'M13']]) {
    if (selected.has(first) && selected.has(second) && selected.get(first).district === selected.get(second).district && districtNames.has(selected.get(first).district)) {
      errors.push(error('INCOMPATIBLE_DISTRICT_PAIR', `${first} и ${second} нельзя назначить в один район.`));
    }
  }
  return { valid: errors.length === 0, errors, cost };
}

function evaluate(plan) {
  const values = Object.fromEntries(DISTRICTS.map((district) => [district.name, { ...district.indicators }]));
  const measureEffects = [];
  for (const choice of plan) {
    const measure = measureById.get(choice.id);
    const { factor, effects } = realizedMeasureEffects(measure);
    const targets = measure.scope === 'city' ? DISTRICTS.map((district) => district.name) : [choice.district];
    for (const target of targets) {
      for (const [id, amount] of Object.entries(effects)) values[target][id] += amount;
    }
    measureEffects.push({ id: choice.id, district: choice.district ?? null, scope: measure.scope, lag: measure.lag, factor, targets, effects });
  }
  const chosen = new Map(plan.map((choice) => [choice.id, choice]));
  const synergies = [];
  for (const [first, second, indicator, amount] of [
    ['M1', 'M2', 'T1', 2],
    ['M5', 'M6', 'E2', 2],
    ['M10', 'M12', 'B1', 2],
  ]) {
    if (chosen.has(first) && chosen.has(second)) {
      const district = chosen.get(first).district;
      values[district][indicator] += amount;
      synergies.push({ measures: [first, second], district, indicator, amount });
    }
  }
  const clipping = [];
  const districts = DISTRICTS.map((district) => {
    const before = { ...district.indicators };
    const after = {};
    for (const id of indicatorIds) {
      after[id] = clamp(values[district.name][id]);
      if (after[id] !== values[district.name][id]) clipping.push({ district: district.name, indicator: id, raw: values[district.name][id], clipped: after[id] });
    }
    const scoreBefore = scoreDistrict(before);
    const scoreAfter = scoreDistrict(after);
    return { name: district.name, population: district.population, before, after, scoreBefore, scoreAfter, scoreDelta: scoreAfter - scoreBefore };
  });
  const cityAverage = districts.reduce((sum, district) => sum + district.population * district.scoreAfter, 0);
  const weakest = districts.reduce((lowest, district) => district.scoreAfter < lowest.scoreAfter ? district : lowest);
  const criticalCells = districts.flatMap((district) => indicatorIds.filter((id) => district.after[id] < 40).map((indicator) => ({ district: district.name, indicator, value: district.after[indicator] })));
  const criticalCount = criticalCells.length;
  const score = 0.7 * cityAverage + 0.3 * weakest.scoreAfter - criticalCount;
  return { score, cityAverage, weakestDistrict: { name: weakest.name, score: weakest.scoreAfter }, criticalCount, criticalCells, districts, measureEffects, synergies, clipping };
}

const baseResult = evaluate([]);
export const BASELINE = Object.freeze({ score: baseResult.score, cityAverage: baseResult.cityAverage, weakestDistrict: baseResult.weakestDistrict, criticalCount: baseResult.criticalCount, criticalCells: baseResult.criticalCells, districts: baseResult.districts });

/** Scores a valid plan. Invalid plans have no score or partial score. */
export function calculatePlan(input) {
  const validation = validatePlan(input);
  const common = { valid: validation.valid, errors: validation.errors, cost: validation.cost, remaining: 100 - validation.cost };
  if (!validation.valid) return { ...common, score: null, baseline: BASELINE.score, delta: null };
  const plan = ordered(input.map((choice) => ({ id: choice.id, district: choice.district ?? null })));
  const result = evaluate(plan);
  return { ...common, ...result, plan, baseline: BASELINE.score, delta: result.score - BASELINE.score };
}
