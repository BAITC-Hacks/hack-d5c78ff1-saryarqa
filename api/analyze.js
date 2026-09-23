import { calculatePlan, MEASURES } from "../simulator.js";
import { createForecast } from "../game/forecast.js";

const MAX_BODY_BYTES = 4096;
const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";

function send(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function requestBody(req) {
  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
    throw new Error("REQUEST_TOO_LARGE");
  }
  return JSON.parse(raw);
}

function modelText(payload) {
  return (payload.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text)
    .join("\n")
    .trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  let input;
  try {
    input = requestBody(req);
  } catch {
    return send(res, 400, { error: "INVALID_REQUEST" });
  }

  if (!input || !Array.isArray(input.plan)) {
    return send(res, 400, { error: "PLAN_REQUIRED" });
  }
  const mode = input.mode ?? "analysis";
  if (!["analysis", "advice"].includes(mode)) {
    return send(res, 400, { error: "INVALID_MODE" });
  }

  const result = calculatePlan(input.plan);
  if (!result.valid) {
    return send(res, 422, { error: "INVALID_PLAN", details: result.errors });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return send(res, 503, { error: "AI_NOT_CONFIGURED" });
  }

  const forecast = createForecast(result);
  const facts = {
    plan: result.plan.map(choice => ({ ...choice, name: MEASURES.find(measure => measure.id === choice.id).name })),
    cost: result.cost,
    remaining: result.remaining,
    score: result.score,
    baseline: result.baseline,
    delta: result.delta,
    cityAverage: result.cityAverage,
    weakestDistrict: result.weakestDistrict,
    criticalCells: result.criticalCells,
    districts: result.districts,
    synergies: result.synergies,
    measureEffects: result.measureEffects,
    forecast: {
      ...forecast,
      suggestions: forecast.suggestions.map(({ label, plan, result: candidate, delta, costDelta }) => ({
        label, plan, score: candidate.score, delta, cost: candidate.cost, costDelta,
        criticalCount: candidate.criticalCount, weakestDistrict: candidate.weakestDistrict,
      })),
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          reasoning: { effort: "low" },
          max_output_tokens: 550,
          store: false,
          instructions: `Ты аналитик учебного городского симулятора. Ответь кратко по-русски, без вводных фраз. ${mode === "advice" ? "Объясни лучшую из переданных suggestions: что заменить, в каком районе и какой компромисс виден из фактов. Не предлагай другие меры. Если suggestions пуст, напиши: «Локальная замена не улучшает результат; глобальный оптимум этим поиском не доказан»." : "Дай три коротких абзаца: «Что улучшится», «Риски», «Вывод». Объясни изменения районов и оставшиеся критические показатели из forecast."} Используй только переданный JSON, не вычисляй новые значения. Ответ строго качественный: никаких цифр, числительных, процентов, числовых ID мер или показателей; названия мер и показателей пиши словами. Числа выводит интерфейс из движка. Не обещай реальные результаты, сроки или вероятность; горизонт учебной модели не является прогнозом реального города. Не приписывай отдельной мере полный прирост балла, поскольку эффекты взаимодействуют. Не выдумывай угрозы и не называй иллюстративные геоданные результатами измерений.`,
          input: JSON.stringify(facts),
        }),
      });
    if (!response.ok) {
      // Never expose the upstream message: authentication errors can echo part
      // of a credential. Return only application-owned error categories.
      let providerCode;
      try { providerCode = (await response.json())?.error?.code; } catch { /* non-JSON provider failure */ }
      const error = response.status === 401 ? "AI_AUTH_FAILED"
        : providerCode === "model_not_found" ? "AI_MODEL_UNAVAILABLE"
        : providerCode === "insufficient_quota" ? "AI_QUOTA_EXCEEDED"
        : response.status === 429 ? "AI_RATE_LIMITED"
        : "AI_PROVIDER_UNAVAILABLE";
      return send(res, 502, { error });
    }
    const payload = await response.json();
    const analysis = modelText(payload);
    if (!analysis) {
      return send(res, 502, { error: "AI_EMPTY_RESPONSE" });
    }
    // Numeric predictions must stay in engine-owned UI. Refuse provider text
    // containing digits, numeric symbols or common spelled-out quantities.
    if (/[\p{N}%‰]/u.test(analysis) || /(?:^|[^\p{L}])(?:ноль|нул[ьяю]|один|одна|одно|одну|одной|дв[ае]|двух|три|тр[её]х|четыре|пять|шесть|семь|восемь|девять|десять|сто|тысяч[аиу]?|миллион\p{L}*|процент\p{L}*|вдвое|втрое|zero|one|two|three|four|five|six|seven|eight|nine|ten|hundred|percent)(?=$|[^\p{L}])/iu.test(analysis)) {
      return send(res, 502, { error: "AI_UNSUPPORTED_NUMBERS" });
    }
    return send(res, 200, { analysis, score: result.score, source: "openai", mode });
  } catch {
    return send(res, 502, { error: "AI_PROVIDER_UNAVAILABLE" });
  } finally {
    clearTimeout(timeout);
  }
}
