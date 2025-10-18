import { exec as execCb } from 'child_process';
import { promisify } from 'util';

// --- Нормализация -----------------------------------------------------------
function normalize(s) {
  const normalized = s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s]/gi, "")        // оставляем только буквы и цифры, удаляем все остальные символы
    .replace(/\s+/g, " ")                  // заменяем несколько пробелов на один
    .trim();                               // убираем пробелы в начале и в конце
  return normalized;
}

// Токенизация с улучшенным стеммингом
function tokenize(s) {
  const endings = /(ами|ями|ами|ями|ого|его|ому|ему|ах|ях|ов|ев|ам|ям|ой|ей|ою|ею|ых|их|ый|ий|ое|ее|ая|яя|ые|ие|ов|ев|ью|ья|ии|ие|ия|ий|ам|ям|у|е|ы|и|а|я|о|е|ть|ться|тся)$/;
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

// --- Категории и проверка запроса ------------------------------------------
const categories = {
  "Аутентификация": ["вход", "логин", "пароль", "аккаунт", "сессия", "восстановление"],
  "Оплата": ["оплата", "счет", "карта", "подписка", "платеж", "перевод", "платеж не прошел"],
  "Ошибки": ["ошибка", "не работает", "платеж не прошел", "системная ошибка", "зависает", "ошибка 500", "не открывается"],
  "Технический вопрос": ["настройка", "установка", "подключение", "система", "работа программы", "обновление"],
  "Безопасность": ["двухфакторная аутентификация", "код безопасности", "биометрия", "проверка безопасности"]
};

// --- Запрещённые и служебные триггеры --------------------------------------
const bannedPatterns = [
  "хуй", "пизд", "ебан", "нахер", "секс", "порно", "эротик",
  "huy", "fuck"  // на всякий случай
];

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

// --- Интеграция с моделью для классификации -------------------------------
const exec = promisify(execCb);
async function classifyWithAI(question) {
  return new Promise((resolve, reject) => {
    exec(`/venv/bin/python /app/agent/model/predict.py "${question}"`, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        reject(`Ошибка: ${error.message}`);
        return;
      }
      if (stderr) {
        reject(`stderr: ${stderr}`);
        return;
      }
      // Возвращаем результат из Python-скрипта (предсказанную категорию)
      resolve(stdout.trim());
    });
  });
}

// --- Проверка запроса -----------------------------------
// Проверка на допустимый вопрос
export function isAllowedQuestion(question) {
  const { norm } = prep(question);
  return !bannedPatterns.some(pattern => norm.includes(pattern));
}

// Проверка запроса на оператора
export function isOperatorRequest(question) {
  const { norm } = prep(question);
  return operatorPatterns.some(pattern => norm.includes(pattern.toLowerCase()));
}

// Классификация вопроса на основе категорий
export async function classify(question) {
  const { norm, tokens } = prep(question);

  // Проверка на запрещённые слова
  if (!isAllowedQuestion(question)) {
    return "Запрещённый запрос. Пожалуйста, не используйте оскорбительные слова.";
  }

  // Проверка на запрос оператора
  if (isOperatorRequest(question)) {
    return "Запрос на оператора. Мы передадим ваш запрос специалисту.";
  }

  // Отправляем запрос на модель AI для классификации
  const aiClassification = await classifyWithAI(question);

  // Если модель вернула категорию, возвращаем её
  if (aiClassification) {
    return `${aiClassification}`;
  }

  // Определение категории на основе ключевых слов (если AI не может классифицировать)
  for (let category in categories) {
    if (categories[category].some(keyword => tokens.includes(keyword))) {
      return `${category}`;
    }
  }

  // Если не удалось классифицировать, вернуть общий ответ
  return "Не удалось классифицировать запрос. Пожалуйста, уточните ваш вопрос.";
}
