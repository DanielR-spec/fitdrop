import React, { useState, useEffect } from 'react';
import { useCart } from '../contexts/CartContext';
import './ProductModal.css';

const formatAndInflatePrice = (price) => {
  if (price === null || price === undefined) return null;
  const numStr = typeof price === 'string' ? price.replace(/[^0-9]/g, '') : price.toString();
  if (!numStr) return null;

  const inflatedPrice = Math.round(parseInt(numStr, 10) * 1.3);

  return `$ ${inflatedPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
};

const ProductModal = ({ product, onClose }) => {
  const { addToCart } = useCart();

  const [selectedVariation, setSelectedVariation] = useState(null);

  useEffect(() => {
    if (product?.variations && product.variations.length > 0) {
      setSelectedVariation(product.variations[0]);
    } else {
      setSelectedVariation(null);
    }
  }, [product]);

  if (!product) return null;

  const displayPriceAntes = selectedVariation?.additional_attributes?.original_price
    || parseFloat(product.pAntes || 0);
  const displayPriceCurrent = selectedVariation?.additional_attributes?.current_price
    || parseFloat(product.pCombo || product.pAntes || 0);

  // Decathlon stores names under size_name, name, or we fallback to script name
  let variationLabel = '';
  if (selectedVariation) {
    if (selectedVariation.size && selectedVariation.name) {
      variationLabel = `${selectedVariation.name} - ${selectedVariation.size}`;
    } else if (selectedVariation.name) {
      variationLabel = selectedVariation.name;
    }
  }
  const displayName = variationLabel || product.nombre || 'Producto';

  const priceCurrent = formatAndInflatePrice(displayPriceCurrent);
  const isPriceLoading = !product?.isProcessed;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel animate-fade-in" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>&times;</button>
        <div className="modal-layout">
          <div className="modal-image-container">
            <img
              src={product.img || 'https://via.placeholder.com/300?text=No+Image'}
              alt={displayName}
              className="modal-image"
            />
          </div>
          <div className="modal-info">
            <h2 className="modal-title">{displayName}</h2>
            {isPriceLoading ? (
              <div className="price-loading" style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontStyle: 'italic', fontSize: '1.2rem' }}>Cargando precio...</div>
            ) : (
              <>
                {displayPriceAntes && displayPriceAntes > displayPriceCurrent && (
                  <p className="modal-price-before">Antes: {formatAndInflatePrice(displayPriceAntes)}</p>
                )}
                {priceCurrent && <p className="modal-price-current">{priceCurrent}</p>}
              </>
            )}

            <div className="modal-description">
              <h3>Detalles</h3>
              <p>Este es un excelente producto garantizado para ofrecer el mejor rendimiento. Aprovecha el precio especial y llévatelo hoy mismo.</p>
              <ul>
                <li>Envío gratis garantizado</li>
                <li>Alta calidad y duración</li>
                <li>Soporte y garantía incluidos</li>
              </ul>
            </div>

            {product.variations && product.variations.length > 1 && (
              <div className="product-variations" style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Selecciona una opción:</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {product.variations.map((v, idx) => {
                    const label = v.size || v.name || `Opción ${idx + 1}`;
                    const isSelected = selectedVariation === v;
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedVariation(v)}
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          border: isSelected ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)',
                          background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)',
                          color: isSelected ? 'var(--accent-primary)' : 'white',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: isSelected ? 'bold' : 'normal',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <button
              className="modal-add-btn"
              onClick={() => {
                addToCart({
                  ...product,
                  id: selectedVariation ? `${product.prodId || product.id}-${selectedVariation.idAttribute || selectedVariation._id || Date.now()}` : (product.prodId || product.id),
                  nombre: displayName,
                  pAntes: displayPriceAntes,
                  pCombo: displayPriceCurrent,
                  selectedVariation
                });
                onClose();
              }}
            >
              Agregar al Carrito
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
