import axios from "axios";
import faq from './faq.json' with { type: "json" };

const GEMMA_URL = process.env.GEMMA_URL || "http://localhost:1235/v1/chat/completions";

// Функция для вычисления коэффициента пересечения между двумя строками
function overlapRatio(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach(t => {
    if (B.has(t)) inter++;
  });
  return inter / Math.min(A.size, B.size);
}

// Токенизация текста
function tokens(s) {
  const RU_STOPWORDS = new Set([
    "и", "или", "а", "но", "что", "как", "в", "во", "на", "за", "по", "из", "от", "до", "для",
    "при", "над", "под", "о", "об", "про", "у", "к", "с", "со", "же", "ли", "бы", "то", "это",
    "этот", "эта", "эти", "тот", "та", "те", "мой", "моя", "мои", "твой", "твоя", "твои",
    "ваш", "ваша", "ваши", "их", "его", "ее", "есть", "нет", "не", "да", "же"
  ]);

  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(t => t && !RU_STOPWORDS.has(t));
}

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
    const overlap = overlapRatio(q, fq);
    return { origIndex: i, question: item.question, answer: item.answer, score: overlap, hasTag };
  });

  let subset = scored.filter(x => x.hasTag || x.score >= 0.12);
  if (!subset.length) subset = scored;
  subset.sort((a, b) => (b.hasTag - a.hasTag) || (b.score - a.score));
  return subset.slice(0, 25);
}

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

    if (!(subIdx >= 0 && subIdx < subset.length)) return null;
    if (conf < 0.85) return null;

    const picked = subset[subIdx];
    const overlap = overlapRatio(question, picked.question);
    if (overlap < 0.20) return null;

    return { type: "faq", answer: faq[picked.origIndex].answer, confidence: conf, index: picked.origIndex };
  } catch (err) {
    console.error("❌ Gemma FAQ error:", err.message);
    return null;
  }
}
