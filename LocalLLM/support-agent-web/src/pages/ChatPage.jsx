import React, { useState, useRef, useEffect } from 'react';
import ChatBubble from '../components/ChatBubble';
import InputField from '../components/InputField';
import Header from '../components/Header';
import { getAnswer, getHistory, clearHistory } from '../api';
import SimpleBar from 'simplebar-react';
import 'simplebar/dist/simplebar.min.css';
import './ChatPage.scss';

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [hasUserSentMessage, setHasUserSentMessage] = useState(false);
  const chatMessagesRef = useRef(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    async function loadHistory() {
      try {
        const history = await getHistory();
        setMessages(
          history.map((h) => ({
            text: h.content,
            isUser: h.role === 'user',
          }))
        );
      } catch (error) {
        console.error('Ошибка при загрузке истории:', error);
      }
    }
    loadHistory();
  }, []);

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text) => {
    if (!hasUserSentMessage) {
      setHasUserSentMessage(true);
    }

    setMessages((prev) => [...prev, { text, isUser: true }]);
    setInputValue('');

    try {
      const { answer, history } = await getAnswer(text);
      setMessages((prev) => [
        ...prev,
        { text: answer, isUser: false },
        ...history.map((h) => ({
          text: h.content,
          isUser: h.role === 'user',
        })),
      ]);
    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error);
      setMessages((prev) => [
        ...prev,
        { text: 'Ошибка сервера. Попробуйте позже.', isUser: false },
      ]);
    }
  };

  const handleClear = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmClear = async () => {
    const success = await clearHistory();
    if (success) {
      setMessages([]);
      setHasUserSentMessage(false);
    } else {
      alert('Ошибка при очистке чата');
    }
    setShowConfirmModal(false);
  };

  const handleCancelClear = () => {
    setShowConfirmModal(false);
  };

  return (
    <div className="chat-page-wrapper">
      <div className={`welcome-gradient ${messages.length === 0 ? 'visible' : ''}`}></div>
      <Header 
        hasUserSentMessage={hasUserSentMessage}
        onClear={handleClear}
      />
      <SimpleBar style={{ flex: 1, padding: 'var(--spacing-lg) 0' }} className="chat-messages">
        {messages.length === 0 ? (
          <div className="welcome-message">
            Добрый день! <br></br>Чем я могу Вам помочь?
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`message-wrapper ${msg.isUser ? 'user' : 'agent'}`}>
              {msg.isUser ? (
                <ChatBubble isUser={msg.isUser}>{msg.text}</ChatBubble>
              ) : (
                <div className="agent-message">
                  <h3>Ответ ИИ-Агента</h3>
                  <p>{msg.text}</p>
                </div>
              )}
            </div>
          ))
        )}
      </SimpleBar>
      <div className="input-container">
        <InputField
          value={inputValue}
          onChange={setInputValue}
          placeholder="Напишите сообщение..."
          onSubmit={handleSend}
        />
      </div>

      {showConfirmModal && (
        <div className="modal-overlay" onClick={handleCancelClear}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <p>Подтвердите очистку чата</p>
            <div className="modal-buttons">
              <button className="modal-btn confirm-btn" onClick={handleConfirmClear}>
                Очистить
              </button>
              <button className="modal-btn cancel-btn" onClick={handleCancelClear}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;