import axios from "axios";

export async function getAnswer(question) {
  try {
    const res = await axios.post("http://localhost:3000/ask", { question });
    return res.data; // ⬅️ теперь возвращаем { answer, history }
  } catch {
    return { answer: "⚠️ Ошибка сервера.", history: [] };
  }
}

export async function getHistory() {
  try {
    const res = await axios.get("http://localhost:3000/history");
    return res.data; // [{ role: "user", content: "..."}, { role: "assistant", content: "..."}]
  } catch {
    return [];
  }
}

export async function clearHistory() {
  try {
    await axios.delete("http://localhost:3000/history");
    return true;
  } catch {
    return false;
  }
}
