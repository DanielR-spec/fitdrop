import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import './Cart.css';

const formatPrice = (price) => {
  return `$ ${price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
};

const getProductName = (product) => {
  if (product.nombre) return product.nombre;
  if (!product.url) return 'Producto';
  try {
    const parts = product.url.split('/');
    let last = parts[parts.length - 1].split('?')[0].replace('.html', '');
    last = last.replace(/^[0-9]+(?:-[0-9]+)*-/, '');
    last = last.replace(/-/g, ' ');
    return last.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  } catch (e) {
    return 'Product';
  }
};

const Cart = () => {
  const { cartItems, isCartOpen, toggleCart, removeFromCart, updateQuantity, cartTotal, clearCart } = useCart();
  const navigate = useNavigate();

  return (
    <>
      {isCartOpen && <div className="cart-overlay" onClick={toggleCart}></div>}
      <div className={`cart-sidebar ${isCartOpen ? 'open' : ''}`}>
        <div className="cart-header">
          <h2>Tu Carrito</h2>
          <button onClick={toggleCart} className="close-btn" aria-label="Close cart">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div className="cart-content">
          {cartItems.length === 0 ? (
            <div className="empty-cart">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                onClick={clearCart}
                title="Vaciar carrito"
                width="64" 
                height="64" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                style={{ margin: '0 auto 1.5rem', display: 'block', opacity: 0.3 }}
              >
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
                <path d="M3 6h18"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '4rem' }}>Tu carrito está vacío</p>
            </div>
          ) : (
            <ul className="cart-items">
              {cartItems.map(item => (
                <li key={item.id} className="cart-item">
                  <img src={item.img || 'https://via.placeholder.com/80'} alt={getProductName(item)} className="cart-item-img" />
                  <div className="cart-item-details">
                    <h4 className="cart-item-name">{getProductName(item)}</h4>
                    <span className="cart-item-price">{formatPrice(item.price)}</span>
                    <div className="quantity-controls">
                      <button className="quantity-btn" onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label="Decrease quantity">-</button>
                      <span className="quantity-value">{item.quantity}</span>
                      <button className="quantity-btn" onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label="Increase quantity">+</button>
                    </div>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="remove-btn" aria-label="Remove item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {cartItems.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total-row">
              <span className="cart-total-label">Total estimado</span>
              <span className="cart-total-value text-gradient">{formatPrice(cartTotal)}</span>
            </div>
            <button className="checkout-btn" onClick={() => { toggleCart(); navigate('/checkout'); }}>Ir a Pagar</button>
          </div>
        )}
      </div>
    </>
  );
};

export default Cart;
