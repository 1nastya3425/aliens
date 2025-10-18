import { getAnswer } from "../agent/agent.js";
import { loadHistory, saveHistory, clearHistory } from "../agent/util/history.js";
import { getMetrics } from "../agent/metrics.js";

export function setupRoutes(app) {
  app.post("/ask", async (req, res) => {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ answer: "❌ Вопрос пустой", history: [] });
    }

    let history = loadHistory();
    const { answer } = await getAnswer(question);

    history.push({ role: "user", content: question });
    history.push({ role: "assistant", content: answer });
    saveHistory(history);

    res.json({ answer, history });
  });

  app.get("/history", (req, res) => {
    res.json(loadHistory());
  });

  app.delete("/history", (req, res) => {
    clearHistory([]);
    res.json({ success: true, message: "История очищена" });
  });

  app.get("/metrics", getMetrics);
}
