import React from 'react';
import './ChatBubble.scss';

const ChatBubble = ({ children, isUser = false }) => {
  return (
    <div className={`chat-bubble ${isUser ? 'user' : ''}`}>
      {children}
    </div>
  );
};

export default ChatBubble;