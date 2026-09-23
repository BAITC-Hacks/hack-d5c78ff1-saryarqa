import { BASELINE, INDICATORS, MEASURES, calculatePlan } from '../simulator.js';
import { createForecast } from './forecast.js';

const number = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
const name = id => MEASURES.find(measure => measure.id === id)?.name ?? id;

/** Offline explanations consume the exact same engine result as the UI. */
export function explainLocally(plan, question = '', mode = 'analysis') {
  const result = calculatePlan(plan);
  if (!result.valid) return 'Сначала соберите корректный план из пяти решений. ' + result.errors.map(error => error.message).join(' ');
  const query = question.toLocaleLowerCase('ru-RU');
  const heading = `Индекс вашего плана — ${number(result.score)}; изменение к исходному городу — +${number(result.delta)}.`;
  if (mode === 'advice' || /улучш|замен|совет|оптим|лучш.*план/.test(query)) {
    const suggestion = createForecast(result).suggestions[0];
    if (!suggestion) return `${heading}\n\nПроверенные варианты с одной заменой не улучшают этот план. Глобальный оптимум этим поиском не доказан.`;
    return `${heading}\n\nПроверенный вариант: ${name(suggestion.replaced.id)} (${suggestion.replaced.district ?? 'весь город'}) → ${name(suggestion.replacement.id)} (${suggestion.replacement.district ?? 'весь город'}).\nИндекс варианта — ${number(suggestion.result.score)}, бюджет — ${suggestion.result.cost}/100, прирост к вашему плану — +${number(suggestion.delta)}. Это расчёт одной замены; применить её можно в блоке «Как улучшить план».`;
  }
  if (/бюджет|стоим|деньг|цен/.test(query)) {
    return `Использовано ${result.cost} из 100 единиц, осталось ${result.remaining}. Неиспользованный бюджет не даёт бонуса.\n\n` + result.plan.map(choice => `${name(choice.id)}: ${MEASURES.find(item => item.id === choice.id).cost} ед. · ${choice.district ?? 'весь город'}`).join('\n');
  }
  if (/формул|счита|расч[её]т|балл|индекс|оценк/.test(query)) {
    return `${heading}\n\nФормула: 0,7 × среднее по населению + 0,3 × индекс слабейшего района − число показателей строго ниже 40.\nСреднее по городу: ${number(result.cityAverage)}. Слабейший район: ${result.weakestDistrict.name}, ${number(result.weakestDistrict.score)}. Критических показателей: ${result.criticalCount}.\nСначала движок учитывает задержки мер, затем фиксированные бонусы сочетаний, ограничение показателей от 0 до 100 и веса. Значения здесь округлены только для отображения.`;
  }
  const district = result.districts.find(item => query.includes(item.name.toLocaleLowerCase('ru-RU')));
  if (district) {
    const changes = INDICATORS.filter(indicator => district.after[indicator.id] !== district.before[indicator.id]);
    return `${district.name}: ${number(district.scoreBefore)} → ${number(district.scoreAfter)} (+${number(district.scoreDelta)}).\n\n` + (changes.length ? changes.map(indicator => `${indicator.name}: ${number(district.before[indicator.id])} → ${number(district.after[indicator.id])}`).join('\n') : 'Выбранный план не меняет показатели этого района.');
  }
  if (/сочетан|синерг|бонус/.test(query)) {
    return result.synergies.length ? result.synergies.map(item => `${item.measures.map(name).join(' + ')}: ${INDICATORS.find(indicator => indicator.id === item.indicator)?.name ?? item.indicator} +${number(item.amount)} в районе ${item.district}.`).join('\n') : 'В этом плане нет сочетаний с дополнительным фиксированным бонусом.';
  }
  const risks = result.criticalCells.map(cell => `${cell.district}: ${INDICATORS.find(indicator => indicator.id === cell.indicator)?.name ?? cell.indicator} — ${number(cell.value)}`);
  const negatives = result.districts.flatMap(item => INDICATORS.filter(indicator => item.after[indicator.id] < item.before[indicator.id]).map(indicator => `${item.name}: ${indicator.name.toLowerCase()} ${number(item.before[indicator.id])} → ${number(item.after[indicator.id])}`));
  if (/риск|слаб|критич|хуже|компромисс|проблем/.test(query)) return `Слабейший район — ${result.weakestDistrict.name} (${number(result.weakestDistrict.score)}).\n\n${risks.length ? 'Ниже критического порога:\n' + risks.join('\n') : 'Показателей строго ниже 40 нет.'}\n\n${negatives.length ? 'Компромиссы:\n' + negatives.join('\n') : 'Снижения показателей относительно исходных данных нет.'}\nЭто учебная модель: она не оценивает реальные строительные, финансовые или политические риски.`;
  const strongest = [...result.districts].sort((a, b) => b.scoreDelta - a.scoreDelta)[0];
  return `${heading}\n\nНаибольший рост: ${strongest.name}, +${number(strongest.scoreDelta)}. Слабейший район: ${result.weakestDistrict.name}, ${number(result.weakestDistrict.score)}. Критических показателей: ${BASELINE.criticalCount} → ${result.criticalCount}. Бюджет: ${result.cost}/100.\n\n${risks.length ? 'Остаются проблемы: ' + risks.join('; ') + '.' : 'Все показатели достигли критического порога или выше.'}${negatives.length ? '\nКомпромисс: ' + negatives.join('; ') + '.' : ''}\n\nМогу объяснить бюджет, формулу, риски, конкретный район, сочетания мер или проверенное улучшение плана.`;
}

export function mountAdvisorChat({ panel, getState, motion }) {
  const section = document.createElement('section');
  section.className = 'advisor-chat';
  section.innerHTML = `<div class="advisor-chat-heading"><strong>Спросите советника</strong><span>О вашем рассчитанном плане</span></div><div class="advisor-prompts"><button type="button">Какие риски?</button><button type="button">Как улучшить план?</button><button type="button">Почему такой индекс?</button></div><div class="advisor-messages" role="log" aria-live="polite" aria-label="Диалог с советником"></div><form class="advisor-form"><label for="advisor-question" class="sr-only">Вопрос о вашем плане</label><textarea id="advisor-question" rows="2" maxlength="600" placeholder="Например: что изменится в Нуре?" required></textarea><button class="button button-primary" type="submit">Отправить</button></form><p class="advisor-chat-status" role="status">При недоступности AI отвечает локальный помощник по данным расчёта.</p>`;
  panel.append(section);
  const log = section.querySelector('.advisor-messages');
  const form = section.querySelector('form');
  const input = section.querySelector('textarea');
  const sendButton = form.querySelector('button');
  const status = section.querySelector('.advisor-chat-status');
  let controller = null;
  let history = [];
  function addMessage(role, text) {
    const bubble = document.createElement('div');
    bubble.className = `advisor-message advisor-message-${role}`;
    const label = document.createElement('strong');
    label.textContent = role === 'user' ? 'Вы' : 'Советник';
    const content = document.createElement('p');
    content.textContent = text;
    bubble.append(label, content); log.append(bubble);
    log.scrollTo({ top: log.scrollHeight, behavior: motion.matches ? 'instant' : 'smooth' });
  }
  async function ask(question) {
    const state = getState();
    if (controller || !state.result || !question.trim()) return;
    const revision = state.planRevision;
    const result = state.result;
    const request = new AbortController(); controller = request;
    const timer = setTimeout(() => request.abort(), 15000);
    const current = () => controller === request && getState().planRevision === revision;
    addMessage('user', question); input.value = ''; sendButton.disabled = true;
    status.textContent = 'Советник изучает рассчитанный план…';
    let answer; let source = 'local';
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: result.plan, mode: 'chat', question, history: history.slice(-2).map(item => ({ role: 'user', content: item.content.slice(0, 180) })) }), signal: request.signal });
      const data = await response.json();
      if (!response.ok || data.source !== 'openai' || typeof data.analysis !== 'string' || !Number.isFinite(data.score) || Math.abs(data.score - result.score) > 1e-7) throw new Error('AI_UNAVAILABLE');
      answer = data.analysis; source = 'openai';
    } catch { answer = explainLocally(result.plan, question); }
    finally { clearTimeout(timer); }
    if (!current()) return;
    addMessage('assistant', answer);
    history.push({ role: 'user', content: question });
    history = history.slice(-4);
    status.textContent = source === 'openai' ? 'Ответ AI по проверенному расчёту. Баллы определяет движок.' : 'Локальный помощник · AI недоступен. Ответ составлен из результатов движка.';
    controller = null; sendButton.disabled = false; input.focus({ preventScroll: true });
  }
  form.addEventListener('submit', event => { event.preventDefault(); ask(input.value.trim()); });
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
  for (const button of section.querySelectorAll('.advisor-prompts button')) button.addEventListener('click', () => ask(button.textContent));
  return {
    reset() { controller?.abort(); controller = null; history = []; log.replaceChildren(); sendButton.disabled = false; status.textContent = 'Задайте вопрос о новом плане. При недоступности AI отвечает локальный помощник.'; },
    destroy() { controller?.abort(); },
  };
}
