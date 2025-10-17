// classifier.js

// --- Нормализация -----------------------------------------------------------
function normalize(s) {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // убрать знаки
    .replace(/\s+/g, " ")               // схлопнуть пробелы
    .trim();
}

// Токенизация с простым стеммингом по русским окончаниям (очень грубо)
function tokenize(s) {
  const endings = /(ами|ями|ами|ями|ого|его|ому|ему|ах|ях|ов|ев|ам|ям|ой|ей|ою|ею|ых|их|ый|ий|ое|ее|ая|яя|ые|ие|ов|ев|ью|ья|ии|ие|ия|ий|ам|ям|у|е|ы|и|а|я|о|е)$/;
  return normalize(s)
    .split(" ")
    .map(t => t.replace(endings, ""))
    .filter(Boolean);
}

// Быстрый доступ к токенам и цельной строке
function prep(question) {
  const norm = normalize(question || "");
  const tokens = tokenize(question || "");
  const set = new Set(tokens);
  return { norm, tokens, set };
}

// --- Запрещённые и служебные триггеры --------------------------------------
// Мат/нежелательное (включая вариации и транслит/обфускацию)
const bannedPatterns = [
  /\bху+(й|и|я|е)\b/u, /\bп(и|е)зд/u, /\bебан/u, /\bнах(ер|уй)?\b/u,
  /\bсекс\b/u, /\bпорно\b/u, /\bэротик/u,
  /h(u|oo)y/i, /f(u|oo)ck/i // на всякий
];

// Оператор (рус/англ фразы и формы)
const operatorPatterns = [
  /\bоператор\b/u, /\bживой человек\b/u, /\bспециалист\b/u,
  /\bпозов(и|ите)\b/u, /\bподдержк[ау]\b/u,
  /\bпередай специалисту\b/u, /\bhuman\b/i, /\bagent\b/i
];

// --- Категории (банк) -------------------------------------------------------
// Каждая категория: список паттернов и фраз; считаем очки за совпадения.
const CATEGORIES = {
  "Аутентификация": [
    /\bвход\b/u, /\bлогин\b/u, /\bпарол/u, /\bаккаунт\b/u, /\bсмс-код\b/u,
    /\bдвухфактор/u, /\bbiometr/i, /\bface ?id\b/i, /\btouch ?id\b/i
  ],
  "Интернет-банк": [/\bинтернет[- ]?банк\b/u, /\bвеб[- ]?верси/u, /\bбраузер\b/u],
  "Мобильное приложение": [
    /\bмобильн/u, /\bприложен/u, /\bапп\b/i, /\bандроид\b/u, /\bios\b/i, /\bайфон\b/u
  ],
  "Карты": [
    /\bкарт[аые]\b/u, /\bдебетов/u, /\bкредитн/u, /\bвыпуск\b/u, /\bактивац/u, /\bблокиров/u
  ],
  "Переводы": [
    /\bперевод/u, /\bp2p\b/i, /\bмежбанк/u, /\bsbp\b/i, /\bсбп\b/u
  ],
  "Платежи": [
    /\bплатеж/u, /\bоплат/u, /\bквитанц/u, /\bчек\b/u, /\bкоммунал/u, /\bналог/u
  ],
  "Ошибки": [
    /\bошибк/u, /\b500\b/, /\b403\b/, /\b404\b/, /\bтаймаут\b/u,
    /\bне работ/u, /\bвылета/u, /\bзависа/u, /\bбаг\b/u
  ],
  "Банкоматы": [/\bбанкомат/u, /\batm\b/i, /\bснять налич/u, /\bвнесени/u],
  "Лимиты и тарифы": [/\bлимит/u, /\bтариф/u, /\bкомисси/u],
  "Подписки/автоплатежи": [/\bподписк/u, /\bавтоплат/u, /\bсписани/u, /\bрегулярн/u],
  "Кошельки/Pay": [/\bapple ?pay\b/i, /\bgoogle ?pay\b/i, /\bsamsung ?pay\b/i, /\bwallet\b/i]
};

// Доп. быстрые ключи для «банковскости» (если нужно только проверить релевантность)
const BANK_HINTS = [
  /\bбанк\b/u, /\bкар[ат]\b/u, /\bсчет\b/u, /\bперевод\b/u, /\bплатеж\b/u, /\bбанкомат\b/u
];

// --- API --------------------------------------------------------------------
export function isAllowedQuestion(question) {
  const { norm } = prep(question);
  return !bannedPatterns.some(rx => rx.test(norm));
}

export function isOperatorRequest(question) {
  const { norm } = prep(question);
  return operatorPatterns.some(rx => rx.test(norm));
}

/**
 * Возвращает лучшую категорию + метаданные:
 * { category: string, confidence: 0..1, matched: string[] }
 */
export function classify(question) {
  const { norm } = prep(question);
  // Приоритет "Ошибки" — поверх остальных
  const errorHit = CATEGORIES["Ошибки"].some(rx => rx.test(norm));

  const scores = {};
  const matched = {};

  for (const [cat, patterns] of Object.entries(CATEGORIES)) {
    let score = 0;
    let hits = [];
    for (const rx of patterns) {
      if (rx.test(norm)) {
        score += 1;            // очко за каждый сработавший паттерн
        hits.push(rx.source);
      }
    }
    if (score > 0) {
      scores[cat] = score;
      matched[cat] = hits;
    }
  }

  // Если ничего не сработало — проверим общую «банковскость»
  const isBankish = BANK_HINTS.some(rx => rx.test(norm));
  if (!Object.keys(scores).length) {
    return {
      category: isBankish ? "Другое (банковское)" : "Небанковское",
      confidence: isBankish ? 0.3 : 0.0,
      matched: []
    };
  }

  // Усилим «Ошибки», если присутствует
  if (errorHit) scores["Ошибки"] = (scores["Ошибки"] || 0) + 1;

  // Выберем max
  let best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const [category, rawScore] = best;

  // Нормируем confidence (очень грубо): 1.0 = >=3 совпадения
  const confidence = Math.min(1, rawScore / 3);

  return {
    category,
    confidence,
    matched: matched[category] || []
  };
}

/**
 * Упрощённая классификация с обратной совместимостью
 */
export function classifySimple(question) {
  const res = classify(question);
  return res.category;
}
