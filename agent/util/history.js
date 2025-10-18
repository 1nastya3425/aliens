import fs from "fs";

const HISTORY_FILE = "/app/data/chat_history.json";
const MAX_HISTORY_LENGTH = 10;  // Максимальное количество сообщений в истории

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
      const fileContent = fs.readFileSync(HISTORY_FILE, "utf-8");
      // Если файл пустой, возвращаем пустой массив
      if (!fileContent.trim()) {
        history = [];
      } else {
        history = JSON.parse(fileContent);
      }
    } catch (error) {
      console.error("Ошибка при загрузке истории:", error);
      history = []; // В случае ошибки, создаём пустой массив
    }
  }

  // Преобразуем новые сообщения в формат массива
  const newHistory = [userMsg, assistantMsg];

  // Удаляем пустые значения и массивы из истории
  history = history.filter(item => item && item.role && item.content); 

  // Ограничиваем количество сообщений в истории до MAX_HISTORY_LENGTH
  const MAX_HISTORY_LENGTH = 10;
  const updatedHistory = [...history.slice(-MAX_HISTORY_LENGTH + 1), ...newHistory];

  // Записываем обновлённую историю в файл
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(updatedHistory, null, 2));
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
