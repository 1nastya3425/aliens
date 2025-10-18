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
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const simpleBarRef = useRef();

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
  }, []); // История загружается только один раз при монтировании компонента

  useEffect(() => {
    if (simpleBarRef.current && simpleBarRef.current.getScrollElement()) {
      const scrollElement = simpleBarRef.current.getScrollElement();
      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  const handleSend = async (text) => {
    if (isLoading || !text.trim()) {
      return;
    }

    setIsLoading(true);
    
    if (!hasUserSentMessage) {
      setHasUserSentMessage(true);
    }

    // Добавляем сообщение пользователя
    setMessages((prev) => [...prev, { text, isUser: true }]);
    setInputValue(''); // Очищаем поле ввода

    const loadingMessage = { text: "думает", isUser: false, isTyping: true };
    setMessages(prev => [...prev, loadingMessage]);
    
    try {
      const { answer } = await getAnswer(text);
      setMessages(prev => {
        const updatedMessages = [...prev];
        const typingIndex = updatedMessages.findIndex(msg => msg.isTyping);
        if (typingIndex !== -1) {
          updatedMessages[typingIndex] = { text: answer, isUser: false };
        }
        return updatedMessages;
      });
    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error);
      setMessages(prev => {
        const updatedMessages = [...prev];
        const typingIndex = updatedMessages.findIndex(msg => msg.isTyping);
        if (typingIndex !== -1) {
          updatedMessages[typingIndex] = { text: 'Ошибка сервера. Попробуйте позже.', isUser: false };
        }
        return updatedMessages;
      });
    } finally {
      setIsLoading(false); // Сбрасываем состояние загрузки
    }
  };

  const handleClear = () => {
    setShowConfirmModal(true); // Показываем модальное окно подтверждения
  };

  const handleConfirmClear = async () => {
    const success = await clearHistory(); // Очищаем историю на сервере
    if (success) {
      setMessages([]); // Очистка сообщений в UI
      setHasUserSentMessage(false); // Сбрасываем состояние отправки
    } else {
      alert('Ошибка при очистке чата');
    }
    setShowConfirmModal(false); // Закрываем модальное окно
  };

  const handleCancelClear = () => {
    setShowConfirmModal(false); // Закрываем модальное окно
  };

  return (
    <div className="chat-page-wrapper">
      <div className={`welcome-gradient ${messages.length === 0 ? 'visible' : ''}`}></div>
      <Header 
        hasUserSentMessage={hasUserSentMessage}
        onClear={handleClear}
      />
      {messages.length === 0 ? (
        <div className="welcome-screen">
          <div className="welcome-message">
            Добрый день! <br />Чем я могу Вам помочь?
          </div>
        </div>
      ) : (
        <SimpleBar
          ref={simpleBarRef}
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          className="chat-messages"
        >
          {messages.map((msg, i) => (
            <div key={i} className={`message-wrapper ${msg.isUser ? 'user' : 'agent'}`}>
              {msg.isUser ? (
                <ChatBubble isUser={msg.isUser}>{msg.text}</ChatBubble>
              ) : (
                <div className="agent-message">
                  <h3>Ответ ИИ-Агента</h3>
                  <p className={msg.isTyping ? 'typing-indicator' : ''}>
                    {msg.text}
                  </p>
                </div>
              )}
            </div>
          ))}
        </SimpleBar>
      )}
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
