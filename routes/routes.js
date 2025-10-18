import { getAnswer } from "../agent/agent.js";
import { loadHistory, saveHistory, clearHistory } from "../agent/util/history.js";
import { getMetrics } from "../agent/metrics.js";

// Максимальный размер истории, который можно хранить
const MAX_HISTORY_LENGTH = 1000;  // Ограничение по количеству сообщений

export function setupRoutes(app) {
  app.post("/ask", async (req, res) => {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ answer: "❌ Вопрос пустой", history: [] });
    }

    let history = loadHistory();
    const { answer } = await getAnswer(question);

    // Добавляем новый вопрос и ответ в историю
    history.push({ role: "user", content: question });
    history.push({ role: "assistant", content: answer });

    // Обрезаем историю, если ее размер превышает максимальный лимит
    if (history.length > MAX_HISTORY_LENGTH) {
      history = history.slice(history.length - MAX_HISTORY_LENGTH);  // Оставляем только последние MAX_HISTORY_LENGTH сообщений
    }

    res.json({ answer, history });
  });

  app.get("/history", (req, res) => {
    res.json(loadHistory());
  });

  app.delete("/history", (req, res) => {
    clearHistory([]);  // Очистка истории
    res.json({ success: true, message: "История очищена" });
  });

  app.get("/metrics", getMetrics);
}
