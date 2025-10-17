import fs from "fs";
import axios from "axios";
import { BANK_PROMPT } from "./prompt.js";
import { isAllowedQuestion, isOperatorRequest, classifySimple } from "./classifier.js";

console.log(BANK_PROMPT);

// Загружаем FAQ
const faq = JSON.parse(fs.readFileSync("./faq.json", "utf-8"));

// URL моделей из ENV (или дефолтные для локалки)
const GEMMA_URL = process.env.GEMMA_URL || "http://localhost:1235/v1/chat/completions";
const MISTRAL_URL = process.env.MISTRAL_URL || "http://localhost:1236/v1/chat/completions";

/* ────────────────────────────────────────────────────────────────────────────
 * Утилиты
 * ────────────────────────────────────────────────────────────────────────────*/
const RU_STOPWORDS = new Set([
  "и","или","а","но","что","как","в","во","на","за","по","из","от","до","для",
  "при","над","под","о","об","про","у","к","с","со","же","ли","бы","то","это",
  "этот","эта","эти","тот","та","те","мой","моя","мои","твой","твоя","твои",
  "ваш","ваша","ваши","их","его","ее","есть","нет","не","да","же"
]);

function tokens(s) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(t => t && !RU_STOPWORDS.has(t));
}

function overlapRatio(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach(t => { if (B.has(t)) inter++; });
  return inter / Math.min(A.size, B.size);
}

function hasHttpCode(s) {
  const m = s.match(/\b(4\d\d|5\d\d)\b/);
  return m ? m[0] : null;
}

function buildFaqSubset(question) {
  const q = question.toLowerCase();
  const tags = [];
  if (/парол|логин|вход|аккаунт/.test(q)) tags.push("парол", "логин", "вход", "аккаунт");
  if (/оплат|карт|подписк|чек|счет|счёт/.test(q)) tags.push("оплат", "карт", "подписк", "чек", "счет", "счёт");
  if (/ошибк|вылета|не работает|зависает|баг|код/.test(q)) tags.push("ошибк","вылета","работает","зависает","баг","код");
  if (/email|почт/.test(q)) tags.push("email","почт");

  const scored = faq.map((item, i) => {
    const fq = item.question.toLowerCase();
    const hasTag = tags.some(t => fq.includes(t));
    const ov = overlapRatio(q, fq);
    return { origIndex: i, question: item.question, answer: item.answer, score: ov, hasTag };
  });

  let subset = scored.filter(x => x.hasTag || x.score >= 0.12);
  if (!subset.length) subset = scored;
  subset.sort((a,b) => (b.hasTag - a.hasTag) || (b.score - a.score));
  return subset.slice(0, 25);
}

/* ────────────────────────────────────────────────────────────────────────────
 * 1) FAQ через Gemma
 * ────────────────────────────────────────────────────────────────────────────*/
export async function searchFAQWithGemma(question) {
  try {
    const subset = buildFaqSubset(question);
    const listForModel = subset.map((it, i) => `[${i}] ${it.question}`).join("\n");

    console.log(`🔎 Gemma FAQ: subset=${subset.length}`);
    const response = await axios.post(GEMMA_URL, {
      model: "google/gemma-3-1b",
      messages: [
        {
          role: "system",
          content: `Ты — поисковик FAQ банка. Верни СТРОГО JSON:
{"index": ЧИСЛО, "confidence": ЧИСЛО_0_1}
Если нет подходящих — {"index": -1, "confidence": 0.0}.`
        },
        {
          role: "user",
          content: `Вопрос: "${question}"\n\nСписок FAQ:\n${listForModel}`
        }
      ],
      temperature: 0
    });

    let raw = response.data.choices?.[0]?.message?.content?.trim() ?? "";
    raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1) raw = raw.slice(start, end + 1);

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { return null; }

    const subIdx = Number(parsed.index);
    const conf   = Number(parsed.confidence);

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

    return { type: "faq-gemma", answer: faq[picked.origIndex].answer, confidence: conf, index: picked.origIndex };
  } catch (err) {
    console.error("❌ Gemma FAQ error:", err.message);
    return null;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 2) Основной ответ от Mistral/Llama
 * ────────────────────────────────────────────────────────────────────────────*/
export async function askLLM(question) {
  try {
    console.log("🚀 Mistra вызов...");
    const response = await axios.post(MISTRAL_URL, {
      model: "fireball-meta-llama-3.2-8b-instruct-agent-003-128k-code-dpo",
      messages: [
        { role: "system", content: BANK_PROMPT },
        { role: "user", content: question }
      ],
      temperature: 0.3
    });

    let answer = response.data.choices?.[0]?.message?.content?.trim() ?? "";
    const sentences = answer.split(/(?<=[.!?])\s+/);
    if (sentences.length > 2) answer = sentences.slice(0, 2).join(" ");

    return { type: "llm", answer };
  } catch (err) {
    console.error("❌ Ошибка Mistra:", err.message);
    return { type: "error", answer: `Ошибка LM Studio: ${err.message}` };
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Логирование и история
 * ────────────────────────────────────────────────────────────────────────────*/
function logInteraction(question, category, source, answer, extra = "") {
  const logLine =
    `[${new Date().toISOString()}] Категория: ${category} | Источник: ${source}${extra ? " " + extra : ""}\n` +
    `Вопрос: ${question}\nОтвет: ${answer}\n\n`;
  fs.appendFileSync("logs.txt", logLine, "utf8");
}

function saveHistory(userMsg, assistantMsg) {
  let history = [];
  if (fs.existsSync("chat_history.json")) {
    try { history = JSON.parse(fs.readFileSync("chat_history.json", "utf-8")) || []; }
    catch { history = []; }
  }
  history.push(userMsg, assistantMsg);
  fs.writeFileSync("chat_history.json", JSON.stringify(history, null, 2));
}

/* ────────────────────────────────────────────────────────────────────────────
 * Главный обработчик
 * ────────────────────────────────────────────────────────────────────────────*/
export async function getAnswer(question) {
  const clean = question.toLowerCase().trim();

  if (["спасибо", "благодарю"].includes(clean)) {
    const msg = "Пожалуйста!";
    logInteraction(question, "Вежливость", "rule", msg);
    saveHistory({ role: "user", content: question }, { role: "assistant", content: msg });
    return { answer: msg };
  }
  if (["привет", "здравствуй", "добрый день"].includes(clean)) {
    const msg = "Здравствуйте!";
    logInteraction(question, "Приветствие", "rule", msg);
    saveHistory({ role: "user", content: question }, { role: "assistant", content: msg });
    return { answer: msg };
  }

  if (!isAllowedQuestion(question)) {
    const msg = "⚠️ Ваш запрос не относится к техподдержке.";
    logInteraction(question, "Запрещённый", "filter", msg);
    saveHistory({ role: "user", content: question }, { role: "assistant", content: msg });
    return { answer: msg };
  }

  const category = classifySimple(question);

  if (isOperatorRequest(question)) {
    const msg = "🧑‍💻 Передаю обращение специалисту поддержки. Ожидайте ответа.";
    logInteraction(question, category, "operator", msg);
    saveHistory({ role: "user", content: question }, { role: "assistant", content: msg });
    return { answer: msg };
  }

  // 1) FAQ через Gemma
  const faqGemma = await searchFAQWithGemma(question);
  if (faqGemma) {
    const msg = `📚 Ответ из базы знаний: ${faqGemma.answer}`;
    logInteraction(question, category, "FAQ-Gemma", msg, `(index=${faqGemma.index}, confidence=${faqGemma.confidence})`);
    saveHistory({ role: "user", content: question }, { role: "assistant", content: msg });
    return { answer: msg };
  }

  // 2) Основная LLM
  const llm = await askLLM(question);
  let finalAnswer;

  if (
    llm.type === "llm" &&
    (llm.answer.toLowerCase().includes("не знаю") ||
     llm.answer.toLowerCase().includes("не могу помочь") ||
     llm.answer.length < 15)
  ) {
    finalAnswer = "🧑‍💻 Передаю обращение специалисту поддержки. Ожидайте ответа.";
    logInteraction(question, category, "operator", finalAnswer);
  } else if (llm.type === "llm") {
    finalAnswer = `🤖 Ответ от mistra: ${llm.answer}`;
    logInteraction(question, category, "mistra", finalAnswer);
  } else {
    finalAnswer = "🧑‍💻 Передаю обращение специалисту поддержки. Ожидайте ответа.";
    logInteraction(question, category, "operator(fallback)", finalAnswer);
  }

  saveHistory({ role: "user", content: question }, { role: "assistant", content: finalAnswer });
  return { answer: finalAnswer };
}
