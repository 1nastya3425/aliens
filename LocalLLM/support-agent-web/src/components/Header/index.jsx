import React from 'react';
import './Header.scss';
import trashbinIcon from '../../assets/TrashbinIcon.png';

const Header = ({ hasUserSentMessage, onClear }) => {
  return (
    <header className="header">
      <h1 className="header-title">ИИ-агент</h1>
      <div className="header-actions">
        {hasUserSentMessage && (
          <button className="clear-btn" onClick={onClear}>
            <img src={trashbinIcon} alt="clear button"></img>
            <span class="clear-btn-text">Очистить чат</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;