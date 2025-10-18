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

const LOG_FILE = "./data/logs.txt";  // Файл для логов

// Функция для записи логов
function logInteraction(question, category, source, answer) {
  const logLine =
    `[${new Date().toISOString()}] Категория: ${category} | Источник: ${source}\n` +
    `Вопрос: ${question}\nОтвет: ${answer}\n\n`;
  fs.appendFileSync(LOG_FILE, logLine, "utf8");
}

// основной обработчик запросов
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
      const faqGemma = await searchFAQWithGemma(question);
      if (faqGemma) {
        finalAnswer = `${faqGemma.answer}`;
        source = "faq";
        answeredByFAQ.inc(); // Увеличиваем счетчик ответов из FAQ
      } else {
        finalAnswer = "🧑‍💻 Передаю обращение специалисту поддержки. Ожидайте ответа.";
        source = "operator-fallback";
        forwardedToOperator.inc(); // Увеличиваем счетчик переданных оператору запросов
      }
    } else {
      const faqGemma = await searchFAQWithGemma(question);
      if (faqGemma) {
        finalAnswer = `${faqGemma.answer}`;
        source = "faq";
        answeredByFAQ.inc(); // Увеличиваем счетчик ответов из FAQ
      } else {
        finalAnswer = "🧑‍💻 Передаю обращение специалисту поддержки. Ожидайте ответа.";
        source = "operator-fallback";
        forwardedToOperator.inc(); // Увеличиваем счетчик переданных оператору запросов
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
