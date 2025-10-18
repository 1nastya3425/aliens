import React from 'react';
import './Header.scss';
import trashbinIcon from '../../assets/TrashbinIcon.png';

const Header = ({ onClear }) => {
  return (
    <header className="header">
      <h1 className="header-title">ИИ-агент</h1>
      <div className="header-actions">
        {/* Корзина всегда видна, убираем условие hasUserSentMessage */}
        <button className="clear-btn" onClick={onClear}>
          <img src={trashbinIcon} alt="clear button" />
          <span className="clear-btn-text">Очистить чат</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
