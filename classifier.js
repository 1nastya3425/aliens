// classifier.js

// 🚫 Запрещённые слова
const bannedWords = ["сосать", "секс", "порно", "эротика", "мат", "ху", "еб"];

// 🆘 Слова для вызова оператора
const operatorWords = [
  "оператор",
  "живой человек",
  "специалист",
  "позови",
  "позвать поддержку",
  "передай специалисту"
];

// 📂 Категории
const categories = {
  "Аутентификация": ["вход", "логин", "пароль", "аккаунт"],
  "Оплата": ["оплата", "счет", "карта", "подписка", "чек"],
  "Ошибки": ["ошибка", "500", "не работает", "вылетает", "зависает", "баг"],
  "Технический вопрос": ["настройка", "установка", "подключение"]
};

/**
 * Проверка на допустимость вопроса
 */
export function isAllowedQuestion(question) {
  return !bannedWords.some(word => question.toLowerCase().includes(word));
}

/**
 * Проверка — пользователь явно просит оператора
 */
export function isOperatorRequest(question) {
  return operatorWords.some(word => question.toLowerCase().includes(word));
}

/**
 * Простая классификация по ключевым словам
 */
export function classifySimple(question) {
  const q = question.toLowerCase();

  // Ошибки проверяем первыми, чтобы не пересекалось с другими категориями
  if (/(ошибка|500|не работает|вылетает|зависает|баг)/.test(q)) {
    return "Ошибки";
  }

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(word => q.includes(word))) {
      return category;
    }
  }

  return "Другое";
}
