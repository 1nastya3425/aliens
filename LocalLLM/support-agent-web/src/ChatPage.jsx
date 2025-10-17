import React, { useState, useEffect, useRef } from "react";
import { getAnswer, getHistory, clearHistory } from "./api";
import "./styles.css";

export default function ChatPage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Загружаем историю при старте
  useEffect(() => {
    async function load() {
      const history = await getHistory();
      setMessages(
        history.map((h) => ({
          from: h.role === "assistant" ? "agent" : "user",
          text: h.content,
        }))
      );
    }
    load();
  }, []);

  // Автоскролл вниз
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!question.trim()) return;

    // добавляем временно в UI
    setMessages((prev) => [...prev, { from: "user", text: question }]);

    const currentQuestion = question;
    setQuestion("");
    setLoading(true);

    const { answer, history } = await getAnswer(currentQuestion);
    setLoading(false);

    // рендерим по истории с бэка
    setMessages(
      history.map((h) => ({
        from: h.role === "assistant" ? "agent" : "user",
        text: h.content,
      }))
    );
  }

  async function handleClear() {
    if (!window.confirm("Вы уверены, что хотите очистить чат?")) return;
    await clearHistory();
    setMessages([]);
  }

  return (
    <div className="chat-wrapper">
      <div className="chat-container">
        <div className="chat-header">
          <img
            src="https://cdn-icons-png.flaticon.com/512/4712/4712107.png"
            alt="bank logo"
            className="chat-logo"
          />
          <span>🏦 Банк Онлайн Поддержка</span>
          <button className="clear-btn" onClick={handleClear}>
            🗑 Очистить чат
          </button>
        </div>

        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-wrapper ${msg.from}`}>
              {msg.from === "agent" && (
                <img
                  src="https://cdn-icons-png.flaticon.com/512/4712/4712107.png"
                  alt="agent"
                  className="avatar"
                />
              )}
              <div className={`message ${msg.from} fade-in`}>
                {msg.text}
              </div>
              {msg.from === "user" && (
                <img
                  src="https://cdn-icons-png.flaticon.com/512/1077/1077012.png"
                  alt="user"
                  className="avatar"
                />
              )}
            </div>
          ))}

          {loading && (
            <div className="message-wrapper agent">
              <img
                src="https://cdn-icons-png.flaticon.com/512/4712/4712107.png"
                alt="agent"
                className="avatar"
              />
              <div className="message agent typing-indicator">
                ИИ печатает<span>.</span><span>.</span><span>.</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="chat-input">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Введите ваш вопрос..."
          />
          <button type="submit">▶</button>
        </form>
      </div>
    </div>
  );
}
