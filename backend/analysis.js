import { INDICATORS, MEASURES } from '../simulator.js';
import { createForecast } from '../game/forecast.js';

const number = value => value.toFixed(2).replace('.', ',');
const measureById = new Map(MEASURES.map(item => [item.id, item]));
const indicatorById = new Map(INDICATORS.map(item => [item.id, item.name]));

/** Only computed facts can become model-selected explanation text. */
export function analysisFacts(result) {
  const facts = { strengths: [], risks: [], next: [] };
  const add = (kind, text, extra = {}) => facts[kind].push({ id: `${kind}-${facts[kind].length}`, text, ...extra });
  add('strengths', `Индекс качества жизни: ${number(result.score)}; изменение к старту: +${number(result.delta)}. Средний показатель города: ${number(result.cityAverage)}.`);
  add('strengths', `Бюджет плана: ${result.cost} из 100 единиц; остаток: ${result.remaining}. Неиспользованный бюджет не даёт дополнительного балла.`);
  add('strengths', 'Итоговый балл: 0,7 × среднее по населению + 0,3 × индекс слабейшего района − количество показателей строго ниже 40. Значения показателей предварительно учитывают задержки мер, фиксированные бонусы сочетаний и ограничение шкалы от 0 до 100.');
  for (const district of [...result.districts].sort((a, b) => b.scoreDelta - a.scoreDelta)) {
    if (district.scoreDelta > 0) add('strengths', `${district.name}: районный индекс вырос с ${number(district.scoreBefore)} до ${number(district.scoreAfter)} (+${number(district.scoreDelta)}).`);
  }
  if (!result.criticalCount) add('strengths', 'После плана не осталось показателей ниже критического порога 40; штраф за критические значения отсутствует.');
  for (const synergy of result.synergies) add('strengths', `Сочетание «${measureById.get(synergy.measures[0]).name}» и «${measureById.get(synergy.measures[1]).name}» даёт дополнительный эффект: ${indicatorById.get(synergy.indicator)} +${number(synergy.amount)} в районе ${synergy.district}.`);
  add('risks', `Наименьший районный индекс остаётся у района ${result.weakestDistrict.name}: ${number(result.weakestDistrict.score)}. Этот район влияет на итоговый балл отдельно от среднего по городу.`);
  for (const cell of result.criticalCells) add('risks', `${cell.district}: «${indicatorById.get(cell.indicator)}» остаётся ниже 40 (${number(cell.value)}) и приносит отдельный штраф.`);
  for (const effect of result.measureEffects) {
    for (const [indicator, delta] of Object.entries(effect.effects)) {
      if (delta < 0) add('risks', `Компромисс «${measureById.get(effect.id).name}»: «${indicatorById.get(indicator)}» изменяется на ${number(delta)} (${effect.district || 'весь город'}).`);
    }
  }
  const delayed = [...result.measureEffects].sort((a, b) => b.lag - a.lag)[0];
  add('risks', `Эффект «${measureById.get(delayed.id).name}» учитывается с задержкой ${delayed.lag} квартала: за горизонт 8 кварталов реализуется ${number(delayed.factor * 100)}% полного эффекта.`);
  for (const clip of result.clipping) add('risks', `${clip.district}: значение «${indicatorById.get(clip.indicator)}» ограничено шкалой модели: ${number(clip.raw)} → ${number(clip.clipped)}.`);
  add('risks', 'Результат описывает учебную модель. Фактическая стоимость, сроки и влияние проектов на жителей требуют отдельной проверки.');
  for (const suggestion of createForecast(result).suggestions) {
    add('next', `Сравните замену «${suggestion.label}»: проверенный движком балл ${number(suggestion.result.score)} (+${number(suggestion.delta)} к вашему плану), бюджет ${suggestion.result.cost} из 100. Все ограничения соблюдены.`, {
      plan: suggestion.plan, score: suggestion.result.score, cost: suggestion.result.cost,
    });
  }
  if (!facts.next.length) add('next', 'Ни одна допустимая замена одного решения или перенос одной районной меры не улучшает балл этого плана. Для другого компромисса сравните план с несколькими изменениями; глобальная оптимальность не утверждается.');
  return facts;
}

export function selectionSchema(facts) {
  return {
    type: 'object', additionalProperties: false,
    properties: Object.fromEntries(Object.entries(facts).map(([kind, rows]) => [kind, {
      type: 'array', minItems: 1, maxItems: kind === 'next' ? 1 : 2,
      items: { type: 'string', enum: rows.map(row => row.id) },
    }])), required: ['strengths', 'risks', 'next'],
  };
}

/** Reject invented text, numbers, citations and plans, including spelled-out quantities. */
export function verifiedAnalysis(selection, facts, mode = 'analysis') {
  if (!selection || typeof selection !== 'object' || Object.keys(selection).sort().join() !== 'next,risks,strengths') return null;
  const sections = {};
  for (const kind of ['strengths', 'risks', 'next']) {
    const ids = selection[kind];
    if (!Array.isArray(ids) || !ids.length || ids.length > (kind === 'next' ? 1 : 2) || new Set(ids).size !== ids.length) return null;
    const rows = ids.map(id => facts[kind].find(row => row.id === id));
    if (rows.some(row => !row)) return null;
    sections[kind] = rows;
  }
  const analysis = mode === 'advice'
    ? `Следующий шаг: ${sections.next.map(row => row.text).join(' ')}\n\nРиски и компромиссы: ${sections.risks.map(row => row.text).join(' ')}`
    : [`Сильные стороны: ${sections.strengths.map(row => row.text).join(' ')}`,
      `Риски и компромиссы: ${sections.risks.map(row => row.text).join(' ')}`,
      `Следующий шаг: ${sections.next.map(row => row.text).join(' ')}`].join('\n\n');
  return { analysis, evidence: sections,
    recommendations: sections.next.filter(row => row.plan).map(({ plan, score, cost }) => ({ plan, score, cost })),
  };
}
