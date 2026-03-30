import React, { useState, useEffect } from 'react';
import { useCart } from '../contexts/CartContext';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';
import './Checkout.css';

const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY || 'TEST-1aeb6f8c-cc75-43a9-a79d-dcb63836fc3f';
initMercadoPago(MP_PUBLIC_KEY, { locale: 'es-CO' });

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;
const MP_ACCESS_TOKEN = import.meta.env.VITE_MP_ACCESS_TOKEN;
const MP_SANDBOX = import.meta.env.VITE_MP_SANDBOX === 'true';

const formatPrice = (price) => {
  return `$ ${price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
};

const getProductName = (product) => {
  if (product.nombre) return product.nombre;
  if (!product.url) return 'Producto Desconocido';
  try {
    const parts = product.url.split('/');
    let last = parts[parts.length - 1].split('?')[0].replace('.html', '');
    last = last.replace(/^[0-9]+(?:-[0-9]+)*-/, '');
    last = last.replace(/-/g, ' ');
    return last.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  } catch (e) {
    return 'Producto';
  }
};

const Checkout = () => {
  const { cartItems, cartTotal, clearCart } = useCart();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const processedRef = React.useRef(false);

  // Derived states from searchParams to handle UI view reliably
  const currentCollectionStatus = searchParams.get('collection_status');
  const trackingCode = searchParams.get('external_reference');
  const orderPlaced = (currentCollectionStatus === 'approved' || currentCollectionStatus === 'pending') && !!trackingCode;
  const isRejected = currentCollectionStatus === 'rejected' || currentCollectionStatus === 'null';

  const formDataRef = React.useRef({
    name: '',
    email: '',
    phone: '',
    identification: '',
    address: '',
    streetNumber: '',
    neighborhood: '',
    city: '',
    state: '',
    zip: '',
    complement: ''
  });

  // MercadoPago redirects back with these params after payment
  useEffect(() => {
    if (orderPlaced && trackingCode && !processedRef.current) {
      processedRef.current = true;
      clearCart();

      // Update order status in Apps Script
      fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          action: 'updateStatus',
          tracking_code: trackingCode,
          new_status: currentCollectionStatus === 'approved' ? 'PAID' : 'PENDING'
        })
      });
    }
  }, [orderPlaced, trackingCode, currentCollectionStatus, clearCart]);

  const handleChange = (e) => {
    formDataRef.current[e.target.name] = e.target.value;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
  };

  const handlePaymentSubmit = async (cardFormData) => {
    if (!MP_ACCESS_TOKEN || MP_ACCESS_TOKEN === 'YOUR_MP_ACCESS_TOKEN') {
      alert('Por favor configura VITE_MP_ACCESS_TOKEN en el archivo .env');
      return;
    }

    setIsSubmitting(true);

    try {
      const localTrackingCode = crypto.randomUUID();

      const orderItems = cartItems.map(item => ({
        id: item.id,
        name: getProductName(item),
        price: item.price,
        quantity: item.quantity,
        img: item.img
      }));

      // Call MercadoPago Orders API directly
      const formData = formDataRef.current;
      const [firstName, ...lastNameParts] = formData.name.trim().split(' ');
      const lastName = lastNameParts.join(' ') || firstName;
      const totalAmount = Number(cartTotal).toFixed(2);

      const mpPayload = {
        transaction_amount: Number(totalAmount),
        token: cardFormData.token,
        description: 'Compra en FitDrop',
        installments: Number(cardFormData.installments),
        payment_method_id: cardFormData.paymentMethodId,
        issuer_id: cardFormData.issuerId,
        payer: {
          email: cardFormData.payer?.email || formData.email?.trim() || 'test@test.com',
          first_name: firstName,
          last_name: lastName,
          identification: {
            type: cardFormData.payer?.identification?.type || 'CC',
            number: cardFormData.payer?.identification?.number || formData.identification?.trim()
          }
        }
      };

      const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
          'X-Idempotency-Key': localTrackingCode,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mpPayload)
      });

      const paymentResult = await mpResponse.json();

      if (paymentResult.status === 'approved' || paymentResult.status === 'in_process') {
        const response = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify({
            action: 'createOrder',
            email: cardFormData.payer?.email || formData.email?.trim() || 'test@test.com',
            name: formData.name?.trim(),
            phone: formData.phone?.trim(),
            identification: formData.identification?.trim(),
            total: cartTotal,
            items: orderItems,
            shipping_address: `${formData.address} ${formData.streetNumber}, ${formData.city}, ${formData.state}, ${formData.zip}`,
            tracking_code: localTrackingCode
          })
        });

        // Verification Loop: Google Apps Script Web App POSTs are blind (no-cors), 
        // so we GET the tracking code to guarantee the row was successfully appended.
        let orderCreatedInSheet = false;
        for (let i = 0; i < 3; i++) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2s
          try {
            const checkData = await fetch(`${APPS_SCRIPT_URL}?trackingCode=${localTrackingCode}`);
            const resultCheck = await checkData.json();
            if (resultCheck && resultCheck.success) {
              orderCreatedInSheet = true;
              break;
            }
          } catch (e) {
            console.error('Verification ping failed:', e);
          }
        }

        if (orderCreatedInSheet) {
          const collection_status = paymentResult.status; 
          navigate(`/checkout?collection_status=${collection_status}&external_reference=${localTrackingCode}`);
        } else {
          setIsSubmitting(false);
          alert(`El pago en MercadoPago fue ¡APROBADO!, pero el servidor de Google Sheets no generó el comprobante. \n\nSolución: Probablemente tú sigues ejecutando la versión antigua de "Code.gs". Por favor ve a Apps Script, pega la última versión del código en apps-script/Code.gs, haz clic en "Implementar > Nueva Implementación" y vuelve a intentarlo.`);
        }
      } else {
        console.error('Payment rejected:', paymentResult);
        setIsSubmitting(false);
        navigate(`/checkout?collection_status=rejected&external_reference=${localTrackingCode}`);
      }
    } catch (error) {
      console.error('Error en el proceso de pago:', error);
      alert('Hubo un error al procesar tu pedido. Por favor intenta de nuevo.');
      setIsSubmitting(false);
    }
  };

  if (isRejected) {
    return (
      <main className="page-container" style={{ display: 'flex', justifyContent: 'center', minHeight: '60vh', alignItems: 'center' }}>
        <div className="glass-panel success-container animate-fade-in" style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          <div className="success-icon-container" style={{ background: 'rgba(239, 68, 68, 0.2)' }}>
             <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
               <line x1="18" y1="6" x2="6" y2="18"></line>
               <line x1="6" y1="6" x2="18" y2="18"></line>
             </svg>
          </div>
          <h2 className="success-title" style={{ color: '#ef4444' }}>Pago Rechazado</h2>
          <p className="success-message">
            Lo sentimos, tu pago no pudo ser procesado. Por favor revisa los datos de tu tarjeta y asegúrate de que el titular coincida, o intenta con otro medio de pago.
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'center' }}>
            <Link 
              to="/checkout" 
              className="checkout-btn" 
              style={{ margin: '0', padding: '0.8rem 1.5rem', background: '#ef4444', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
            >
              Reintentar
            </Link>
            <Link 
              to="/" 
              className="back-btn" 
              style={{ margin: '0', padding: '0.8rem 1.5rem', textAlign: 'center' }}
            >
              Volver a la Tienda
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (orderPlaced) {
    return (
      <main className="page-container" style={{ display: 'flex', justifyContent: 'center', minHeight: '60vh', alignItems: 'center' }}>
        <div className="glass-panel success-container animate-fade-in">
          <div className="success-icon-container">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <h2 className="success-title text-gradient">¡Pedido Confirmado!</h2>
          <p className="success-message">
            ¡Gracias por tu compra! Tu pedido está siendo procesado.
            <br />
            Código de Seguimiento: <b style={{ color: 'var(--accent-primary)' }}>{trackingCode || 'Revisa tu correo'}</b>
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link 
              to={`/track/${trackingCode}`}
              className="checkout-btn" 
              style={{ margin: '0', width: 'auto', padding: '0.8rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
            >
              📦 Rastrear Pedido
            </Link>
            <Link 
              to="/" 
              className="back-btn" 
              style={{ margin: '0', padding: '0.8rem 1.5rem', textAlign: 'center' }}
            >
              Volver a la Tienda
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (isSubmitting) {
    return (
      <main className="page-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="loader" style={{ margin: '0 auto 1.5rem', width: '60px', height: '60px', borderBottomColor: 'var(--accent-primary)' }}></div>
        <h2 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '1rem', textAlign: 'center', width: '100%' }}>Procesando tu pago...</h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', width: '100%' }}>Por favor no cierres ni recargues esta página.</p>
      </main>
    );
  }

  if (cartItems.length === 0) {
    return (
      <main className="page-container" style={{ padding: '6rem 1rem', textAlign: 'center' }}>
        <h2 className="checkout-title">Tu carrito está vacío.</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>Agrega algunos productos antes de proceder al pago.</p>
        <Link to="/" className="checkout-btn" style={{ width: 'auto', display: 'inline-block' }}>
          Volver a la Tienda
        </Link>
      </main>
    );
  }

  return (
    <main className="page-container checkout-container animate-fade-in">
      <div className="checkout-content glass-panel">
        <h2 className="checkout-title">Detalles de la compra</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3 className="section-title">Información de Contacto</h3>
            <div className="form-row split">
              <input type="text" name="name" placeholder="Nombre Completo" required defaultValue={formDataRef.current.name} onChange={handleChange} className="form-input" />
              <input type="email" name="email" placeholder="Correo Electrónico" required defaultValue={formDataRef.current.email} onChange={handleChange} className="form-input" />
            </div>
            <div className="form-row split">
              <input type="text" name="identification" placeholder="NIT / Cédula" required defaultValue={formDataRef.current.identification} onChange={handleChange} className="form-input" />
              <input type="tel" name="phone" placeholder="Teléfono (ej: 3001234567)" required defaultValue={formDataRef.current.phone} onChange={handleChange} className="form-input" />
            </div>
          </div>

          <div className="form-section">
            <h3 className="section-title">Dirección de Envío</h3>
            <div className="form-row split">
              <input type="text" name="address" placeholder="Calle / Carrera" required defaultValue={formDataRef.current.address} onChange={handleChange} className="form-input" />
              <input type="text" name="streetNumber" placeholder="Número" required defaultValue={formDataRef.current.streetNumber} onChange={handleChange} className="form-input" />
            </div>
            <div className="form-row split">
              <input type="text" name="neighborhood" placeholder="Barrio" required defaultValue={formDataRef.current.neighborhood} onChange={handleChange} className="form-input" />
              <input type="text" name="complement" placeholder="Complemento (Apto, Piso...)" defaultValue={formDataRef.current.complement} onChange={handleChange} className="form-input" />
            </div>
            <div className="form-row split">
              <input type="text" name="city" placeholder="Ciudad" required defaultValue={formDataRef.current.city} onChange={handleChange} className="form-input" />
              <input type="text" name="state" placeholder="Departamento" required defaultValue={formDataRef.current.state} onChange={handleChange} className="form-input" />
            </div>
            <div className="form-row">
              <input type="text" name="zip" placeholder="Código Postal" required defaultValue={formDataRef.current.zip} onChange={handleChange} className="form-input" />
            </div>
          </div>

          <div className="form-section">
            <h3 className="section-title">Datos de Pago</h3>
            <div className="payment-container" style={{ marginTop: '1rem' }}>
              <CardPayment
                initialization={{ amount: Number(cartTotal) }}
                onSubmit={async (param) => {
                  try {
                    await handlePaymentSubmit(param);
                  } catch (e) {
                    console.error("Error al procesar pago", e);
                  }
                }}
                locale="es-CO"
                customization={{
                  visual: {
                    style: {
                      theme: 'default'
                    }
                  }
                }}
              />
            </div>
          </div>
        </form>
      </div>

      <div className="checkout-summary glass-panel">
        <h2 className="checkout-title">Resumen del Pedido</h2>
        <div className="summary-items">
          {cartItems.map(item => (
            <div key={item.id} className="summary-item">
              <div className="summary-item-img-container">
                <img src={item.img || 'https://via.placeholder.com/64'} alt={getProductName(item)} className="summary-item-img" />
                <span className="summary-item-quantity">{item.quantity}</span>
              </div>
              <div className="summary-item-info">
                <h4 className="summary-item-name">{getProductName(item)}</h4>
                <p className="summary-item-price">{formatPrice(item.price)}</p>
              </div>
              <div className="summary-item-total">
                {formatPrice(item.price * item.quantity)}
              </div>
            </div>
          ))}
        </div>

        <div className="totals-section">
          <div className="total-row subtotal">
            <span>Subtotal</span>
            <span>{formatPrice(cartTotal)}</span>
          </div>
          <div className="total-row shipping">
            <span>Envío</span>
            <span style={{ color: '#22c55e', fontWeight: 600 }}>Gratis</span>
          </div>
          <div className="total-row grand-total">
            <span>Total</span>
            <span className="text-gradient">{formatPrice(cartTotal)}</span>
          </div>
        </div>
      </div>

      <style>{`
        .loader-mini {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
};

export default Checkout;
