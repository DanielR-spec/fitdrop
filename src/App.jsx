import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Header from './components/Header';
import Cart from './components/Cart';
import Footer from './components/Footer';
import Home from './pages/Home';
import Checkout from './pages/Checkout';
import Tracking from './pages/Tracking';
import { CartProvider } from './contexts/CartContext';
import './index.css';

const PixelTracker = () => {
  const location = useLocation();

  useEffect(() => {
    if (window.fbq) {
      window.fbq('track', 'PageView');
    }
  }, [location]);

  return null;
};

function App() {
  return (
    <CartProvider>
      <HashRouter>
        <PixelTracker />
        <div className="app">
          <Header />
          
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/product/:id" element={<Home />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/track" element={<Tracking />} />
            <Route path="/track/:trackingCode" element={<Tracking />} />
          </Routes>
          
          <Footer />
          <Cart />
        </div>
      </HashRouter>
    </CartProvider>
  );
}

export default App;
