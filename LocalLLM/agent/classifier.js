// classifier.js

// --- Нормализация -----------------------------------------------------------
function normalize(s) {
  // Убираем все символы, которые не буквы, цифры или пробелы, и приводим строку к нижнему регистру
  const normalized = s
    .toLowerCase()
    .replace(/ё/g, "е")                    // заменяем "ё" на "е"
    .replace(/[^a-zа-я0-9\s]/gi, "")        // оставляем только буквы и цифры, удаляем все остальные символы
    .replace(/\s+/g, " ")                  // заменяем несколько пробелов на один
    .trim();                               // убираем пробелы в начале и в конце

  return normalized;
}

// Токенизация с улучшенным стеммингом (расширим окончания)
function tokenize(s) {
  const endings = /(ами|ями|ами|ями|ого|его|ому|ему|ах|ях|ов|ев|ам|ям|ой|ей|ою|ею|ых|их|ый|ий|ое|ее|ая|яя|ые|ие|ов|ев|ью|ья|ии|ие|ия|ий|ам|ям|у|е|ы|и|а|я|о|е|ть|ться|ться|тся)$/;
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
  "хуй", "пизд", "ебан", "нахер", "секс", "порно", "эротик",
  "huy", "fuck"  // на всякий случай
];

// Оператор (рус/англ фразы и формы)
const operatorPatterns = [
  "оператор", 
  "живой человек", 
  "специалист", 
  "позови", 
  "позовите", 
  "поддержка", 
  "поддержку", 
  "передай специалисту", 
  "human", 
  "agent"
];

// --- Категории (IT, HR, Accounting) -----------------------------------------
// Каждая категория: список паттернов с весами для точности
const CATEGORIES = {
  "IT": [
    { pattern: "приложен", weight: 0.8 },
    { pattern: "сеть", weight: 0.7 },
    { pattern: "оборудован", weight: 0.6 },
    { pattern: "ошибк", weight: 0.5 },
    { pattern: "сервер", weight: 0.7 },
    { pattern: "настройк", weight: 0.6 }
  ],
  "HR": [
    { pattern: "отпуск", weight: 0.9 },
    { pattern: "зарплат", weight: 0.8 },
    { pattern: "документ", weight: 0.7 },
    { pattern: "больничн", weight: 0.6 },
    { pattern: "кадр", weight: 0.5 }
  ],
  "Accounting": [
    { pattern: "счет", weight: 0.9 },
    { pattern: "отчет", weight: 0.8 },
    { pattern: "налог", weight: 0.7 },
    { pattern: "фактур", weight: 0.6 },
    { pattern: "расчет", weight: 0.5 }
  ]
};

// Доп. быстрые ключи для релевантности домена
const DOMAIN_HINTS = [
  "IT", "HR", "accounting", "техподдержк", "кадр", "бухгалтер"
];

// --- API --------------------------------------------------------------------
export function isAllowedQuestion(question) {
  const { norm } = prep(question);
  return !bannedPatterns.some(pattern => norm.includes(pattern));
}

export function isOperatorRequest(question) {
  const { norm } = prep(question);
  const result = operatorPatterns.some(pattern => norm.includes(pattern.toLowerCase()));
  return result;
}

/**
 * Возвращает лучшую категорию + метаданные:
 * { category: string, confidence: 0..1, matched: string[] }
 */
export function classify(question) {
  const { norm, tokens } = prep(question);

  // Приоритет "ошибки" в IT
  const errorHit = CATEGORIES["IT"].some(item => norm.includes(item.pattern) && /ошибк/.test(norm));

  const scores = {};
  const matched = {};

  for (const [cat, patterns] of Object.entries(CATEGORIES)) {
    let score = 0;
    let hits = [];
    for (const { pattern, weight } of patterns) {
      if (norm.includes(pattern)) {
        score += weight; // Используем веса для точности
        hits.push(pattern);
      }
    }
    if (score > 0) {
      scores[cat] = score;
      matched[cat] = hits;
    }
  }

  // Если ничего не сработало — проверим общую релевантность
  const isDomainRelevant = DOMAIN_HINTS.some(hint => norm.includes(hint));
  if (!Object.keys(scores).length) {
    return {
      category: isDomainRelevant ? "Другое (релевантное)" : "Нерелевантное",
      confidence: isDomainRelevant ? 0.3 : 0.0,
      matched: []
    };
  }

  // Усилим "IT" при наличии ошибок
  if (errorHit) scores["IT"] = (scores["IT"] || 0) + 0.5;

  // Выберем max
  let best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const [category] = best;
  const rawScore = best[1];
  const confidence = Math.min(1, rawScore / 2); // Нормируем confidence (максимум 2 веса = 1)

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
