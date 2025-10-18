import fs from "fs";

const HISTORY_FILE = "/app/data/chat_history.json";

// Функция для загрузки истории
function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) {
    return [];
  }

  try {
    // Читаем файл
    const fileContent = fs.readFileSync(HISTORY_FILE, "utf-8");

    // Если файл пустой, возвращаем пустой массив
    if (!fileContent.trim()) {
      return [];
    }

    // Парсим JSON
    return JSON.parse(fileContent) || [];
  } catch (error) {
    // Логируем ошибку при парсинге
    console.error("Ошибка при загрузке истории:", error);

    // Если ошибка парсинга, создаём новый пустой файл
    if (error instanceof SyntaxError) {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify([])); // Создаем пустой файл
    }

    return [];
  }
}

// Функция для обрезки истории до определённого лимита по токенам
function trimHistory(history, maxTokens = 2000) {
  let totalTokens = 0;
  let trimmedHistory = [];

  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i];
    const tokens = message.content.split(/\s+/).length;
    totalTokens += tokens;

    if (totalTokens > maxTokens) break;

    trimmedHistory.unshift(message);
  }

  return trimmedHistory;
}

// Функция для сохранения истории
function saveHistory(userMsg, assistantMsg) {
  let history = [];

  if (fs.existsSync(HISTORY_FILE)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8")) || [];
    } catch (error) {
      console.error("Ошибка при загрузке истории:", error);
      history = [];
    }
  }

  // Добавляем новое сообщение в историю
  history.push(userMsg, assistantMsg);
  
  // Сохраняем обновлённую историю
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// Функция для очистки истории
function clearHistory() {
  try {
    // Записываем пустой массив в файл истории
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));
  } catch (error) {
    console.error("Ошибка при очистке истории:", error);
  }
}

export { loadHistory, trimHistory, saveHistory, clearHistory };
