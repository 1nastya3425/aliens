import fs from "fs";
import axios from "axios";
import { BANK_PROMPT } from "./prompt.js";
import { isAllowedQuestion, isOperatorRequest, classify } from "./classifier.js";

// Метрики из prom-client
import {
  totalQuestions,
  answeredByFAQ,
  answeredByLLM,
  forwardedToOperator,
  responseTime
} from "./metrics.js";

// Загружаем FAQ
const faq = JSON.parse(fs.readFileSync("./faq.json", "utf-8"));

// URL моделей
const GEMMA_URL = process.env.GEMMA_URL || "http://localhost:1235/v1/chat/completions";
const MISTRAL_URL = process.env.MISTRAL_URL || "http://localhost:1236/v1/chat/completions";

// Пути для логов и истории
const HISTORY_FILE = "/app/data/chat_history.json";
const LOG_FILE = "/app/data/logs.txt";

function trimHistory(history, maxTokens = 2000) {
  let totalTokens = 0;
  let trimmedHistory = [];

  // Перебираем историю в обратном порядке
  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i];
    const tokens = message.content.split(/\s+/).length;  // Считаем количество токенов в сообщении
    totalTokens += tokens;

    // Если общая длина превышает лимит, останавливаемся
    if (totalTokens > maxTokens) break;

    trimmedHistory.unshift(message);  // Добавляем сообщение в начало массива
  }

  return trimmedHistory;
}

function saveHistory(userMsg, assistantMsg) {
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try { history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8")) || []; }
    catch { history = []; }
  }
  history.push(userMsg, assistantMsg);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8")) || [];
  } catch (error) {
    console.error("Ошибка при загрузке истории:", error);
    return [];
  }
}

// --- Утилиты ---
// Стоп-слова для русского языка
const RU_STOPWORDS = new Set([
  "и", "или", "а", "но", "что", "как", "в", "во", "на", "за", "по", "из", "от", "до", "для",
  "при", "над", "под", "о", "об", "про", "у", "к", "с", "со", "же", "ли", "бы", "то", "это",
  "этот", "эта", "эти", "тот", "та", "те", "мой", "моя", "мои", "твой", "твоя", "твои",
  "ваш", "ваша", "ваши", "их", "его", "ее", "есть", "нет", "не", "да", "же"
]);

// Токенизация текста
function tokens(s) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(t => t && !RU_STOPWORDS.has(t));
}

// Функция для вычисления коэффициента пересечения между двумя строками
function overlapRatio(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach(t => { if (B.has(t)) inter++; });
  return inter / Math.min(A.size, B.size);
}

// Функция для поиска HTTP кодов в тексте
function hasHttpCode(s) {
  const m = s.match(/\b(4\d\d|5\d\d)\b/);
  return m ? m[0] : null;
}

// Функция для построения подмножества FAQ на основе вопроса
function buildFaqSubset(question) {
  const q = question.toLowerCase();
  const tags = [];
  if (/парол|логин|вход|аккаунт/.test(q)) tags.push("парол", "логин", "вход", "аккаунт");
  if (/оплат|карт|подписк|чек|счет|счёт/.test(q)) tags.push("оплат", "карт", "подписк", "чек", "счет", "счёт");
  if (/ошибк|вылета|не работает|зависает|баг|код/.test(q)) tags.push("ошибк", "вылета", "работает", "зависает", "баг", "код");
  if (/email|почт/.test(q)) tags.push("email", "почт");

  const scored = faq.map((item, i) => {
    const fq = item.question.toLowerCase();
    const hasTag = tags.some(t => fq.includes(t));
    const ov = overlapRatio(q, fq);
    return { origIndex: i, question: item.question, answer: item.answer, score: ov, hasTag };
  });

  let subset = scored.filter(x => x.hasTag || x.score >= 0.12);
  if (!subset.length) subset = scored;
  subset.sort((a, b) => (b.hasTag - a.hasTag) || (b.score - a.score));
  return subset.slice(0, 25);
}

// --- FAQ через Gemma ---
export async function searchFAQWithGemma(question) {
  const start = Date.now();
  try {
    const subset = buildFaqSubset(question);
    const listForModel = subset.map((it, i) => `[${i}] ${it.question}`).join("\n");

    const response = await axios.post(GEMMA_URL, {
      model: "google/gemma-3-1b",
      messages: [
        { role: "system", content: `Ты — поисковик FAQ банка. Верни СТРОГО JSON: {"index": ЧИСЛО, "confidence": ЧИСЛО_0_1}` },
        { role: "user", content: `Вопрос: "${question}"\n\nСписок FAQ:\n${listForModel}` }
      ],
      temperature: 0
    });

    let raw = response.data.choices?.[0]?.message?.content?.trim() ?? "";
    raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
    if (s !== -1 && e !== -1) raw = raw.slice(s, e + 1);

    const parsed = JSON.parse(raw);
    const subIdx = Number(parsed.index);
    const conf = Number(parsed.confidence);

    responseTime.observe(Date.now() - start);

    if (!(subIdx >= 0 && subIdx < subset.length)) return null;
    if (conf < 0.85) return null;

    const picked = subset[subIdx];
    const ov = overlapRatio(question, picked.question);
    if (ov < 0.20) return null;

    const qCode = hasHttpCode(question);
    if (qCode) {
      const faqCode = hasHttpCode(picked.question);
      if (qCode !== faqCode) return null;
    }

    return { type: "faq", answer: faq[picked.origIndex].answer, confidence: conf, index: picked.origIndex };
  } catch (err) {
    console.error("❌ Gemma FAQ error:", err.message);
    return null;
  }
}

// --- Основной ответ от LLM с учетом истории ---
export async function askLLMWithHistory(question) {
  const start = Date.now();
  const history = loadHistory();

  // Обрезаем историю, чтобы она не превышала лимит по токенам
  const historyForLLM = trimHistory(history);

  // Подготавливаем сообщения для LLM, включая историю чата
  const messages = [
    { role: "system", content: BANK_PROMPT },
    ...historyForLLM.map(msg => ({ role: msg.role, content: msg.content })),
    { role: "user", content: question }
  ];

  try {
    const response = await axios.post(MISTRAL_URL, {
      model: "fireball-meta-llama-3.2-8b-instruct-agent-003-128k-code-dpo",
      messages: messages,
      temperature: 0.3
    });

    let answer = response.data.choices?.[0]?.message?.content?.trim() ?? "";
    const sentences = answer.split(/(?<=[.!?])\s+/);
    if (sentences.length > 2) answer = sentences.slice(0, 2).join(" "); // Ограничиваем ответ для краткости

    responseTime.observe(Date.now() - start);
    return { type: "llm", answer };
  } catch (err) {
    console.error("❌ Ошибка Mistra:", err.message);
    return { type: "error", answer: `Ошибка LM Studio: ${err.message}` };
  }
}

// --- Логирование и история ---
// Логирование взаимодействия с чатом
function logInteraction(question, category, source, answer) {
  const logLine =
    `[${new Date().toISOString()}] Категория: ${category} | Источник: ${source}\n` +
    `Вопрос: ${question}\nОтвет: ${answer}\n\n`;
  fs.appendFileSync(LOG_FILE, logLine, "utf8");
}

// Главный обработчик запросов
export async function getAnswer(question) {
  totalQuestions.inc();

  const clean = question.toLowerCase().trim();
  let finalAnswer, source;
  let category = "Неизвестно";

  // Проверяем запрос на оператора (автооператор)
  if (isOperatorRequest(clean)) {
    finalAnswer = "🧑‍💻 Передаю обращение автооператору. Ожидайте ответа.";
    forwardedToOperator.labels("explicit").inc(); 
    source = "operator";  
  } else if (["спасибо", "благодарю"].includes(clean)) {
    finalAnswer = "Пожалуйста!";
    source = "rule";
  } else if (["привет", "здравствуй", "добрый день"].includes(clean)) {
    finalAnswer = "Здравствуйте!";
    source = "rule";
  } else if (!isAllowedQuestion(question)) {
    finalAnswer = "⚠️ Ваш запрос не относится к техподдержке.";
    source = "filter";
  } else {
    // Применяем классификатор
    category = await classify(question);

    // Если категоризация не сработала, оставляем дефолтное значение для category
    if (!category) {
      category = "Неизвестно"; 
    }

    if (category === "Ошибки") {
      const faqGemma = await searchFAQWithGemma(question);
      if (faqGemma) {
        answeredByFAQ.inc();
        finalAnswer = `${faqGemma.answer}`;
        source = "faq";
      } else {
        finalAnswer = "🧑‍💻 Передаю обращение специалисту поддержки. Ожидайте ответа.";
        forwardedToOperator.labels("fallback").inc();
        source = "operator-fallback";
      }
    } else {
      const faqGemma = await searchFAQWithGemma(question); 
      if (faqGemma) {
        answeredByFAQ.inc();
        finalAnswer = `${faqGemma.answer}`;
        source = "faq";
      } else {
        const llm = await askLLMWithHistory(question); 
        if (llm.type === "llm") {
          answeredByLLM.inc();
          finalAnswer = `${llm.answer}`;
          source = "llm";
        } else {
          forwardedToOperator.labels("fallback").inc();
          finalAnswer = "🧑‍💻 Передаю обращение специалисту поддержки. Ожидайте ответа.";
          source = "operator-fallback";
        }
      }
    }
  }

  saveHistory({ role: "user", content: question }, { role: "assistant", content: finalAnswer });

  // Логирование с категорией, которая теперь всегда определена
  await logInteraction(question, category, source, finalAnswer); 

  return { answer: finalAnswer, meta: { source } };
}


