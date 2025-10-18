import express from "express";
import cors from "cors";
import fs from "fs";
import { getAnswer } from "./agent/agent.js";
import { register } from "./agent/metrics.js";  // 👈 только импортируем реестр

const app = express();
app.use(cors());
app.use(express.json());

const CHAT_FILE = "./data/chat_history.json";

function loadHistory() {
  if (!fs.existsSync(CHAT_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(CHAT_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveHistory(history) {
  fs.writeFileSync(CHAT_FILE, JSON.stringify(history, null, 2));
}

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
  saveHistory([]);
  res.json({ success: true, message: "История очищена" });
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.listen(3000, () => console.log("🚀 API: http://localhost:3000"));
