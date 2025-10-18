// agent/metrics.js
import { Registry, collectDefaultMetrics, Counter, Histogram } from "prom-client";

// создаём реестр и включаем дефолтные метрики (CPU, память и т.п.)
export const register = new Registry();
collectDefaultMetrics({ register });

// === Счётчики ===
export const totalQuestions = new Counter({
  name: "chat_questions_total",
  help: "Всего получено вопросов"
});

export const answeredByFAQ = new Counter({
  name: "chat_answered_by_faq_total",
  help: "Ответы из базы знаний (FAQ)"
});

export const answeredByLLM = new Counter({
  name: "chat_answered_by_llm_total",
  help: "Ответы от LLM"
});

// 👇 теперь с лейблом "reason"
export const forwardedToOperator = new Counter({
  name: "chat_forwarded_to_operator_total",
  help: "Сколько обращений передано оператору",
  labelNames: ["reason"]
});

// Инициализация, чтобы метрики появились сразу с 0
forwardedToOperator.labels("explicit").inc(0);
forwardedToOperator.labels("fallback").inc(0);

// === Гистограмма времени ответа ===
export const responseTime = new Histogram({
  name: "chat_response_time_ms",
  help: "Время ответа (ms)",
  buckets: [50, 100, 300, 1000, 3000, 10000]
});

// регистрируем все метрики
register.registerMetric(totalQuestions);
register.registerMetric(answeredByFAQ);
register.registerMetric(answeredByLLM);
register.registerMetric(forwardedToOperator);
register.registerMetric(responseTime);

export async function getMetrics(req, res) {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
}