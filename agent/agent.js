import { searchFAQWithGemma } from "./util/faq.js";
import { loadHistory, saveHistory } from "./util/history.js";
import { classify, isAllowedQuestion, isOperatorRequest } from "./util/classifier.js";
import {
  totalQuestions,
  answeredByFAQ,
  answeredByLLM,
  forwardedToOperator,
  responseTime
} from "./metrics.js";
import fs from "fs";  // Импортируем fs для записи логов
import axios from "axios";  // Для работы с запросами к модели
import { BANK_PROMPT } from "./prompt.js"; // Импортируем prompt из prompt.js

const LOG_FILE = "./data/logs.txt";  // Файл для логов
const LLAMA_URL = process.env.LLAMA_URL || "http://localhost:1235/v1/chat/completions"; // URL для модели LLM

// Функция для записи логов
function logInteraction(question, category, source, answer) {
  const logLine =
    `[${new Date().toISOString()}] Категория: ${category} | Источник: ${source}\n` +
    `Вопрос: ${question}\nОтвет: ${answer}\n\n`;
  fs.appendFileSync(LOG_FILE, logLine, "utf8");
}

// Функция для отправки запроса к модели LLM
async function askLLMWithHistory(question, history) {
  // Фильтруем историю, убирая некорректные записи
  const filteredHistory = history.filter(msg => msg && msg.role && msg.content);

  const messages = [
    { role: "system", content: BANK_PROMPT },  // Используем BANK_PROMPT как системное сообщение
    ...filteredHistory.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: "user", content: question }
  ];

  try {
    const response = await axios.post(LLAMA_URL, {
      model: "fireball-meta-llama-3.2-8b-instruct-agent-003-128k-code-dpo",
      messages: messages,
      temperature: 0.3, // Настройка "температуры" модели для разнообразия ответов
    });

    return { answer: response.data.choices[0].message.content.trim() };
  } catch (error) {
    console.error("Ошибка при запросе к модели LLM:", error);
    return { answer: "Ошибка при обработке запроса." };
  }
}

// Основной обработчик запросов
export async function getAnswer(question) {
  totalQuestions.inc(); // Увеличиваем счетчик всех вопросов
  const start = Date.now(); // Начало измерения времени

  let finalAnswer, source;
  let category = "Неизвестно";

  // Проверяем запрос на оператора
  if (isOperatorRequest(question)) {
    finalAnswer = "🧑‍💻 Передаю обращение автооператору. Ожидайте ответа.";
    source = "operator";
    forwardedToOperator.inc(); // Увеличиваем счетчик переданных оператору запросов
  } else if (!isAllowedQuestion(question)) {
    finalAnswer = "⚠️ Ваш запрос не относится к техподдержке.";
    source = "filter";
  } else {
    // Применяем классификатор
    category = await classify(question);

    if (category === "Ошибки") {
      // Сначала пытаемся найти ответ в базе FAQ через Gemma
      const faqGemma = await searchFAQWithGemma(question);
      if (faqGemma) {
        finalAnswer = `${faqGemma.answer}`;
        source = "faq";
        answeredByFAQ.inc(); // Увеличиваем счетчик ответов из FAQ
      } else {
        // Если Gemma не нашла ответ, отправляем запрос в LLM
        const history = loadHistory();
        const { answer } = await askLLMWithHistory(question, history);
        finalAnswer = answer;
        source = "llm";
        answeredByLLM.inc(); // Увеличиваем счетчик ответов от LLM
      }
    } else {
      // Для других категорий сначала ищем в FAQ через Gemma
      const faqGemma = await searchFAQWithGemma(question);
      if (faqGemma) {
        finalAnswer = `${faqGemma.answer}`;
        source = "faq";
        answeredByFAQ.inc(); // Увеличиваем счетчик ответов из FAQ
      } else {
        // Если Gemma не нашла ответ, отправляем запрос в LLM
        const history = loadHistory();
        const { answer } = await askLLMWithHistory(question, history);
        finalAnswer = answer;
        source = "llm";
        answeredByLLM.inc(); // Увеличиваем счетчик ответов от LLM
      }
    }
  }

  const elapsedTime = Date.now() - start; // Время выполнения запроса
  responseTime.observe(elapsedTime); // Записываем время ответа

  saveHistory({ role: "user", content: question }, { role: "assistant", content: finalAnswer });

  // Записываем взаимодействие в логи
  logInteraction(question, category, source, finalAnswer);

  return { answer: finalAnswer, meta: { source } };
}
