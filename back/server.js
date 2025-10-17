import express from "express";
import cors from "cors";
import fs from "fs";
import { getAnswer } from "./agent/agent.js";

const app = express();
app.use(cors());
app.use(express.json());

const CHAT_FILE = "./agent/chat_history.json";

// читаем историю безопасно
function loadHistory() {
  if (!fs.existsSync(CHAT_FILE)) return [];
  try {
    const raw = fs.readFileSync(CHAT_FILE, "utf-8").trim();
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("⚠️ Ошибка чтения истории, сбрасываю:", e.message);
    return [];
  }
}

// сохраняем историю
function saveHistory(history) {
  fs.writeFileSync(CHAT_FILE, JSON.stringify(history, null, 2));
}

app.post("/ask", async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ answer: "❌ Вопрос пустой", history: [] });
  }

  let history = loadHistory(); // [{role, content}, ...]

  const { answer } = await getAnswer(question);

  // сохраняем в формате role/content
  history.push({ role: "user", content: question });
  history.push({ role: "assistant", content: answer });

  saveHistory(history);

  res.json({ answer, history }); // фронт получает готовую историю
});

app.get("/history", (req, res) => {
  res.json(loadHistory());
});

// 🗑 очистка истории
app.delete("/history", (req, res) => {
  saveHistory([]);
  res.json({ success: true, message: "История очищена" });
});

app.listen(3001, () => console.log("🚀 API: http://localhost:3001"));
