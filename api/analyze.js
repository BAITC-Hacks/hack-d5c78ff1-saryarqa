import { calculatePlan } from "../simulator.js";

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

  if (!Array.isArray(input.plan)) {
    return send(res, 400, { error: "PLAN_REQUIRED" });
  }

  const result = calculatePlan(input.plan);
  if (!result.valid) {
    return send(res, 422, { error: "INVALID_PLAN", details: result.errors });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return send(res, 503, { error: "AI_NOT_CONFIGURED" });
  }

  const facts = {
    plan: result.plan,
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
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
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
          instructions: "Ты аналитик городского симулятора. Ответь на русском кратко, тремя абзацами с подписями «Сильные стороны», «Риски и компромиссы», «Следующий шаг». Используй только факты из переданного JSON. Не рассчитывай и не придумывай числовые показатели; числовые значения показывает отдельный детерминированный движок. Не утверждай, что синтетические данные отражают реальный город. Если фактов не хватает, скажи об этом.",
          input: JSON.stringify(facts),
        }),
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      return send(res, 502, { error: "AI_PROVIDER_UNAVAILABLE" });
    }
    const payload = await response.json();
    const analysis = modelText(payload);
    if (!analysis) {
      return send(res, 502, { error: "AI_EMPTY_RESPONSE" });
    }
    return send(res, 200, { analysis, score: result.score, source: "openai" });
  } catch {
    return send(res, 502, { error: "AI_PROVIDER_UNAVAILABLE" });
  }
}
