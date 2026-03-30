import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import './Header.css';

const Header = () => {
  const { itemCount, toggleCart } = useCart();

  return (
    <header className="header glass-panel">
      <div className="header-container page-container">
        <Link to="/" className="logo-link">
          <h1 className="logo-text text-gradient">FitDrop</h1>
        </Link>
        <nav className="nav-links">
          <Link to="/?tab=categories" className="nav-item">🛍️ Categorías</Link>
          <Link to="/?tab=deals" className="nav-item">🔥 Ofertas</Link>
          <Link to="/track" className="nav-item">📦 Rastrear</Link>
          
          <button 
            className="cart-toggle-btn"
            onClick={toggleCart}
            aria-label="Ver carrito"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
              <path d="M3 6h18"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            {itemCount > 0 && (
              <span className="cart-badge">
                {itemCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
