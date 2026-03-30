import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Cart from './components/Cart';
import Footer from './components/Footer';
import Home from './pages/Home';
import Checkout from './pages/Checkout';
import Tracking from './pages/Tracking';
import { CartProvider } from './contexts/CartContext';
import './index.css';

function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <div className="app">
          <Header />
          
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/track" element={<Tracking />} />
            <Route path="/track/:trackingCode" element={<Tracking />} />
          </Routes>
          
          <Footer />
          <Cart />
        </div>
      </BrowserRouter>
    </CartProvider>
  );
}

export default App;
