import React from 'react';
import { useCart } from '../contexts/CartContext';
import ProductModal from './ProductModal';
import './ProductCard.css';

const getProductName = (product) => {
  if (product.nombre) return product.nombre;
  if (!product.url) return 'Producto Desconocido';
  try {
    const parts = product.url.split('/');
    let last = parts[parts.length - 1].split('?')[0].replace('.html', '');
    last = last.replace(/^[0-9]+(?:-[0-9]+)*-/, '');
    last = last.replace(/-/g, ' ');
    return last
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  } catch (e) {
    return 'Producto';
  }
};

const formatAndInflatePrice = (price) => {
  if (!price) return 'N/D';
  const numStr = typeof price === 'string'
    ? price.replace(/[^0-9]/g, '')
    : price.toString();

  if (!numStr) return price;

  const inflatedPrice = parseInt(numStr, 10);

  return `$ ${inflatedPrice
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
};

const ProductCard = ({ product }) => {
  const name = getProductName(product);
  const { addToCart } = useCart();
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const cleanPrice = (val) => {
    if (!val) return 0;
    const cleaned = val.toString().replace(/[^0-9]/g, '');
    return parseInt(cleaned, 10) || 0;
  };

  const displayPriceAntes = cleanPrice(product.pAntes);
  const displayPriceCurrent = cleanPrice(product.pCombo || product.pAntes);
  const computedName = product.nombre || name;

  let discountPercent = 0;
  if (displayPriceAntes > 0 && displayPriceCurrent > 0 && displayPriceCurrent < displayPriceAntes) {
    discountPercent = Math.round((1 - displayPriceCurrent / displayPriceAntes) * 100);
  }

  const mergedProduct = {
    ...product,
    nombre: computedName,
    pAntes: displayPriceAntes,
    pCombo: displayPriceCurrent
  };

  return (
    <>
      <div className="product-card glass-panel">
        <div
          className="product-image-container"
          onClick={() => setIsModalOpen(true)}
          style={{ cursor: 'pointer' }}
        >
          <img
            src={product.img || 'https://via.placeholder.com/300?text=No+Image'}
            alt={computedName}
            className="product-image"
            loading="lazy"
          />

          {product.isSuperDeal ? (
            <div className="badge badge-super">
              🔥 OFERTA {discountPercent > 0 ? `-${discountPercent}%` : ''}
            </div>
          ) : product.isTrending ? (
            <div className="badge badge-trending">
              📈 TENDENCIA
            </div>
          ) : null}
        </div>

        <div className="product-info">
          <h3 className="product-name">{computedName}</h3>

          <div className="product-footer">
            <div className="price-container">
              {displayPriceAntes && displayPriceAntes > displayPriceCurrent && (
                <span className="price-before">
                  {formatAndInflatePrice(displayPriceAntes)}
                </span>
              )}
              <span className="price-current">
                {formatAndInflatePrice(displayPriceCurrent)}
              </span>
            </div>

            <button
              className="add-to-cart-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                addToCart(mergedProduct);
              }}
            >
              Agregar al Carrito
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <ProductModal
          product={mergedProduct}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
};

export default ProductCard;