import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load cart from local storage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('marketplace-cart');
      if (savedCart) {
        setCartItems(JSON.parse(savedCart));
      }
    } catch (e) {
      console.error('Failed to parse cart from local storage', e);
    }
  }, []);

  // Save cart to local storage on change
  useEffect(() => {
    localStorage.setItem('marketplace-cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (product) => {
    setCartItems(prev => {
      // Create a relatively unique ID based on available data
      const id = product.nombre || product.url || Math.random().toString();
      const existing = prev.find(item => item.id === id);

      if (existing) {
        return prev.map(item =>
          item.id === id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      // Compute the price using the same logic as ProductCard
      const priceSource = product.pCombo || product.pAntes || '0';
      const numStr = typeof priceSource === 'string' ? priceSource.replace(/[^0-9]/g, '') : priceSource.toString();
      const basePrice = parseInt(numStr, 10) || 0;
      const price = basePrice * 1.3;

      return [...prev, { ...product, id, price, quantity: 1 }];
    });
    setIsCartOpen(true); // Open sidebar automatically when adding
  };

  const removeFromCart = (id) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id, quantity) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCartItems(prev => prev.map(item => item.id === id ? { ...item, quantity } : item));
  };

  const toggleCart = () => setIsCartOpen(!isCartOpen);

  const clearCart = () => setCartItems([]);

  const cartTotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  const itemCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      cartItems,
      isCartOpen,
      addToCart,
      removeFromCart,
      updateQuantity,
      toggleCart,
      clearCart,
      cartTotal,
      itemCount
    }}>
      {children}
    </CartContext.Provider>
  );
};
