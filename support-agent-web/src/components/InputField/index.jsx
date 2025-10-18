import React, { useRef, useEffect } from 'react';
import './InputField.scss';
import sendIcon from '../../assets/SendIcon.png';

const InputField = ({ value, onChange, placeholder, onSubmit }) => {
  const textareaRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSubmit(value);
      }
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;

      const lineHeight = parseFloat(getComputedStyle(textareaRef.current).lineHeight);
      const paddingTop = parseFloat(getComputedStyle(textareaRef.current).paddingTop);
      const paddingBottom = parseFloat(getComputedStyle(textareaRef.current).paddingBottom);
      const totalPadding = paddingTop + paddingBottom;

      const maxLines = 5;
      const maxHeight = lineHeight * maxLines + totalPadding;

      if (scrollHeight > maxHeight) {
        textareaRef.current.style.height = `${maxHeight}px`;
        textareaRef.current.style.overflowY = 'auto';
      } else {
        textareaRef.current.style.height = `${scrollHeight}px`;
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [value]);

  return (
    <form onSubmit={handleSubmit} className="input-field">
      <textarea
        ref={textareaRef}
        type="text"
        value={value}
        onKeyDown={handleKeyDown}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <button type="submit">
        <img src={sendIcon} alt="submit button"></img>
      </button>
    </form>
  );
};

export default InputField;