import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import './Tracking.css';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;

const formatPrice = (price) => {
  return `$ ${price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
};

const statusMap = {
  'PENDING': 'PENDIENTE',
  'PAID': 'PAGADO',
  'SHIPED': 'ENVIADO',
  'SHIPPED': 'ENVIADO',
  'REFUNDED': 'REEMBOLSADO',
  'CANCELLED': 'CANCELADO',
  "ON IT'S WAY": 'EN CAMINO',
  'DELIVERED': 'ENTREGADO'
};

const Tracking = () => {
  const { trackingCode } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(!!trackingCode);
  const [error, setError] = useState(null);
  const [searchId, setSearchId] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchId.trim()) {
      navigate(`/track/${searchId.trim()}`);
    }
  };

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL') {
        setError('Configuración de API no encontrada.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${APPS_SCRIPT_URL}?trackingCode=${trackingCode}`);
        const data = await response.json();
        
        if (data.success) {
          setOrder(data.order);
        } else {
          setError(data.error || 'Pedido no encontrado');
        }
      } catch (err) {
        setError('Error al obtener detalles del pedido. Intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    if (trackingCode) {
      fetchOrder();
    }
  }, [trackingCode]);

  if (!trackingCode) {
    return (
      <main className="page-container tracking-container animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="tracking-search-glass glass-panel" style={{ maxWidth: '500px', width: '100%', textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
          <h1 className="tracking-title text-gradient" style={{ marginBottom: '1rem' }}>Rastrea tu Pedido</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Ingresa el código de seguimiento que enviamos a tu correo electrónico o que se generó al confirmar la compra.
          </p>
          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input
              type="text"
              className="form-input"
              style={{ textAlign: 'center', fontSize: '1.2rem', padding: '1rem', letterSpacing: '1px' }}
              placeholder="Ej: TEST-1234... o ORD-..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              required
            />
            <button type="submit" className="checkout-btn" style={{ width: '100%', marginTop: '0.5rem' }}>
              Buscar Pedido
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <div className="page-container tracking-loading">
        <div className="loader"></div>
        <p>Buscando detalles de tu pedido...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container tracking-error">
        <div className="glass-panel error-card">
          <div className="error-icon">⚠️</div>
          <h2 className="error-title">¡Ups!</h2>
          <p>{error}</p>
          <Link to="/" className="back-btn">Volver a la Tienda</Link>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const items = JSON.parse(order.items_json || '[]');

  return (
    <main className="page-container tracking-container animate-fade-in">
      <div className="tracking-content glass-panel">
        <div className="tracking-header">
          <div className="status-badge" data-status={order.status}>
            {statusMap[order.status] || order.status}
          </div>
          <h1 className="tracking-title">Pedido #{order.order_id}</h1>
          <p className="tracking-date">Realizado el {new Date(order.created_at).toLocaleDateString()}</p>
        </div>

        <div className="tracking-grid">
          <div className="tracking-main">
            <h3 className="section-subtitle">Productos</h3>
            <div className="tracking-items">
              {items.map((item, idx) => (
                <div key={idx} className="tracking-item">
                  <div className="item-info">
                    <span className="item-name">{item.name}</span>
                    <span className="item-qty">x {item.quantity}</span>
                  </div>
                  <span className="item-price">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
 
            <div className="tracking-total">
              <div className="total-row">
                <span>Subtotal</span>
                <span>{formatPrice(order.total)}</span>
              </div>
              <div className="total-row">
                <span>Envío</span>
                <span className="free">Gratis</span>
              </div>
              <div className="total-row grand-total">
                <span>Total</span>
                <span className="text-gradient">{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          <div className="tracking-sidebar">
            <div className="info-block">
              <h3 className="section-subtitle">Dirección de Envío</h3>
              <p>{order.shipping_address}</p>
            </div>
            <div className="info-block">
              <h3 className="section-subtitle">Contacto</h3>
              <p>{order.email}</p>
            </div>
            <div className="info-block">
              <h3 className="section-subtitle">Código de Seguimiento</h3>
              <code className="tracking-code-display">{order.tracking_code}</code>
            </div>
          </div>
        </div>
        
        <div className="tracking-footer">
          <Link to="/" className="back-btn">Continuar comprando</Link>
        </div>
      </div>
    </main>
  );
};

export default Tracking;
