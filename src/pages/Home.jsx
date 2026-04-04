import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import ProductGrid from '../components/ProductGrid';
import ProductModal from '../components/ProductModal';
import './Home.css';

const ITEMS_PER_PAGE = 8;

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

const fetchFromProxy = async (requests) => {
  const proxyUrl = import.meta.env.VITE_DECATHLON_PROXY_URL;
  // console.log('[Proxy Request]', requests);

  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ requests })
  });

  const data = await res.json();
  //console.log('[Proxy Response]', data);
  return data;
};

const Home = () => {
  const [allOriginalProducts, setAllOriginalProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { id: productIdFromUrl } = useParams();
  const navigate = useNavigate();

  const loaderRef = useRef(null);

  // Refactor: Introduce deduplication and caching mechanisms
  const processingRef = useRef(new Set()); // Tracks IDs that have completely resolved
  const inFlightRef = useRef(new Set()); // Tracks URLs currently being fetched to prevent duplicates
  const cacheRef = useRef(new Map()); // In-memory cache for API responses

  const tab = searchParams.get('tab') || 'categories';
  const currentCategory = searchParams.get('category') || 'Todo';

  // 1. Initial Fetch of all raw products from Google Sheet
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const endpoint = import.meta.env.VITE_API_ENDPOINT;
        if (!endpoint || endpoint.includes('AKfycb')) {
          setAllOriginalProducts([
            { nombre: 'Audífonos Premium', pAntes: 199, pCombo: 149, img: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80', url: '#' },
            { nombre: 'Teclado Mecánico', pAntes: 129, pCombo: 99, img: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=500&q=80', url: '#' },
            { nombre: 'Mouse Gamer', pAntes: 79, pCombo: 59, img: 'https://images.unsplash.com/photo-1527814050087-3793815479bd?w=500&q=80', url: '#' },
            { nombre: 'Monitor 4K', pAntes: 499, pCombo: 399, img: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&q=80', url: '#' },
          ]);
          setLoading(false);
          return;
        }

        const response = await fetch(endpoint);
        if (!response.ok) throw new Error('Error al conectar con el servidor');
        const json = await response.json();
        const rawData = json.data || [];

        // To display all individual products without grouping
        setAllOriginalProducts(rawData);
      } catch (err) {
        console.error('Error al obtener productos iniciales:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // UseMemo: Stabilize dependencies and avoid duplicate evaluations per render
  const filteredList = useMemo(() => {
    return allOriginalProducts.filter(p => {
      if (tab === 'categories') {
        if (currentCategory === 'Todo') return true;
        const pCat = p.categoria || getProductName(p).split(' ')[0] || 'Otros';
        return pCat === currentCategory;
      }
      return true;
    });
  }, [allOriginalProducts, tab, currentCategory]);

  const displayList = useMemo(() => {
    return filteredList.slice(0, visibleCount);
  }, [filteredList, visibleCount]);

  // 3. Incremental Proxy Fetching for visible products
  useEffect(() => {
    // Helper to merge fetched or cached data into state
    const processFetchedResults = (results) => {
      setProducts(prev => {
        const newProducts = [...prev];
        results.forEach(({ p, key, data, hasError }) => {
          if (hasError) {
            // Even if failed, mark as processed to prevent infinite blocking loops
            processingRef.current.add(key);
            return;
          }

          const realData = (data && data.length > 0) ? data[0] : null;

          if (!realData || !realData.additional_attributes) {
            processingRef.current.add(key);
            return;
          }

          const { current_price, original_price } = realData.additional_attributes;
          const currentPriceNum = Number(current_price);
          const originalPriceNum = Number(original_price);
          const hasOffer = (!isNaN(originalPriceNum) && !isNaN(currentPriceNum))
            ? originalPriceNum > currentPriceNum
            : false;

          const updatedP = {
            ...p,
            nombre: realData.name || p.nombre,
            pAntes: original_price,
            pCombo: current_price,
            hasOffer,
            isSuperDeal: hasOffer,
            isCombo: p.tipo === 'Multi',
            variations: data,
            isProcessed: true
          };

          const existingIdx = newProducts.findIndex(item => String(item.prodId || item.id) === key);
          if (existingIdx >= 0) {
            newProducts[existingIdx] = updatedP;
          } else {
            newProducts.push(updatedP);
          }
          processingRef.current.add(key);
        });
        return newProducts;
      });
    };

    const fetchProxyDataForVisible = async () => {
      // 1. Skip items already processed
      const productsToProcess = displayList.filter(p => {
        const key = String(p.prodId || p.id);
        return !processingRef.current.has(key);
      });

      if (productsToProcess.length === 0) return;

      const proxyTasks = [];
      const cachedItems = [];

      // 2. Separate into cached vs network tasks and check for in-flight collisions
      productsToProcess.forEach(p => {
        const key = String(p.prodId || p.id);

        if (p.trigger && p.prodId && p.trigger.includes('-')) {
          const [superModelId, idAttribute] = p.trigger.split('-');
          const url = `https://www.decathlon.com.co/module/oneshop_oneff/sizeselector?superModelId=${superModelId}&idAttribute=${idAttribute}&modelId=${p.prodId}&lat=4.7344442&lng=-74.0667869&postalCode=111156&usage=PRODUCT_ACTION`;

          if (cacheRef.current.has(url)) {
            // Already cached - skip fetch
            cachedItems.push({ p, key, data: cacheRef.current.get(url) });
          } else if (!inFlightRef.current.has(url)) {
            // Not in flight - need to fetch
            inFlightRef.current.add(url);
            proxyTasks.push({ p, key, url });
          }
        } else {
          // No valid target, drop it so it avoids infinite loops
          processingRef.current.add(key);
        }
      });

      // Synchronously process any cache hits directly
      if (cachedItems.length > 0) {
        processFetchedResults(cachedItems);
      }

      if (proxyTasks.length === 0) return;

      // 3. Queue network requests
      setFetchingMore(true);
      const CHUNK_SIZE = 5;

      for (let i = 0; i < proxyTasks.length; i += CHUNK_SIZE) {
        const chunk = proxyTasks.slice(i, i + CHUNK_SIZE);

        try {
          const requestsToProxy = chunk.map((task, idx) => ({
            index: idx,
            url: task.url,
            meta: {
              id: String(task.p.prodId || task.p.id || ''),
              name: task.p.nombre || '',
              image: task.p.img || '',
              link: `${import.meta.env.VITE_PUBLIC_SITE_URL}/#/product/${task.p.prodId || task.p.id}`
            }
          }));

          const jsonRes = await fetchFromProxy(requestsToProxy);

          if (jsonRes.success && jsonRes.results) {
            const results = chunk.map((task, idx) => {
              const proxyResult = jsonRes.results.find(r => r.index === idx);
              let decathlonData = [];
              let hasError = true;

              if (proxyResult && proxyResult.data) {
                decathlonData = proxyResult.data;
                hasError = false;
                // Store successful data in memory cache
                cacheRef.current.set(task.url, decathlonData);
              }

              // Always clean up in-flight tracker when done
              inFlightRef.current.delete(task.url);

              return { p: task.p, key: task.key, data: decathlonData, hasError };
            });

            processFetchedResults(results);
          } else {
            throw new Error("Proxy error or unsuccessful response");
          }
        } catch (err) {
          console.warn("Proxy processing failed for chunk", err);
          chunk.forEach(task => {
            processingRef.current.add(task.key);
            inFlightRef.current.delete(task.url);
          });
        }
      }
      setFetchingMore(false);
    };

    if (displayList.length > 0) {
      fetchProxyDataForVisible();
    }
  }, [displayList]); // displayList is now memoized, meaning clean trigger conditions

  // 4. Infinite Scroll Observer
  const handleObserver = useCallback((entries) => {
    const target = entries[0];
    if (target.isIntersecting && !loading && !fetchingMore) {
      setVisibleCount(prev => prev + ITEMS_PER_PAGE);
    }
  }, [loading, fetchingMore]);

  // UseMemos for layout processing to avoid recreation
  const availableCategories = useMemo(() => {
    return ['Todo', ...new Set(allOriginalProducts.map(p => {
      if (p.categoria) return p.categoria;
      const firstWord = getProductName(p).split(' ')[0] || 'Otros';
      return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
    }))].filter(cat => cat.length > 2);
  }, [allOriginalProducts]);

  const finalDisplayList = useMemo(() => {
    return displayList
      .map(p => products.find(up => String(up.prodId || up.id) === String(p.prodId || p.id)))
      .filter(p => !!p)
      .filter(p => {
        if (tab === 'deals') return p.hasOffer === true;
        return true;
      });
  }, [displayList, products, tab]);

  const isInitialProxyLoading = useMemo(() => {
    return displayList.length > 0 && finalDisplayList.length === 0 && displayList.some(p => !processingRef.current.has(String(p.prodId || p.id)));
  }, [displayList, finalDisplayList]);

  useEffect(() => {
    const option = { threshold: 0.1 };
    const observer = new IntersectionObserver(handleObserver, option);
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [handleObserver]);

  // Helper to get heading info
  const getHeaderInfo = () => {
    switch (tab) {
      case 'deals':
        return { title: '🔥 Ofertas Imperdibles', subtitle: 'Los mejores descuentos disponibles ahora mismo.' };
      case 'categories':
      default:
        return { title: '🛍️ Categorías', subtitle: 'Explora nuestro catálogo completo o filtra por categoría.' };
    }
  };

  const { title, subtitle } = getHeaderInfo();

  const handleCategoryClick = (cat) => {
    setSearchParams({ tab: 'categories', category: cat });
    setVisibleCount(ITEMS_PER_PAGE);
    processingRef.current.clear();
  };

  const selectedProduct = useMemo(() => {
    if (!productIdFromUrl) return null;
    return products.find(p => String(p.prodId || p.id) === productIdFromUrl)
      || allOriginalProducts.find(p => String(p.prodId || p.id) === productIdFromUrl)
      || null;
  }, [productIdFromUrl, products, allOriginalProducts]);

  const isSelectedProductProcessed = selectedProduct?.isProcessed;

  useEffect(() => {
    const processSingleResult = (key, url, data) => {
      setProducts(prev => {
        const existingIdx = prev.findIndex(item => String(item.prodId || item.id) === key);
        const baseProduct = existingIdx >= 0 ? prev[existingIdx] : selectedProduct;
        
        const newProducts = [...prev];
        const realData = (data && data.length > 0) ? data[0] : null;

        if (!realData || !realData.additional_attributes) {
          processingRef.current.add(key);
          if (url) inFlightRef.current.delete(url);
          const updatedFail = { ...baseProduct, isProcessed: true };
          if (existingIdx >= 0) newProducts[existingIdx] = updatedFail;
          else newProducts.push(updatedFail);
          return newProducts;
        }

        const { current_price, original_price } = realData.additional_attributes;
        const currentPriceNum = Number(current_price);
        const originalPriceNum = Number(original_price);
        const hasOffer = (!isNaN(originalPriceNum) && !isNaN(currentPriceNum))
          ? originalPriceNum > currentPriceNum
          : false;

        const updatedP = {
          ...baseProduct,
          nombre: realData.name || baseProduct.nombre,
          pAntes: original_price,
          pCombo: current_price,
          hasOffer,
          isSuperDeal: hasOffer,
          isCombo: baseProduct.tipo === 'Multi',
          variations: data,
          isProcessed: true
        };

        if (existingIdx >= 0) {
          newProducts[existingIdx] = updatedP;
        } else {
          newProducts.push(updatedP);
        }
        processingRef.current.add(key);
        if (url) inFlightRef.current.delete(url);
        return newProducts;
      });
    };

    const fetchSingleProduct = async () => {
      if (!selectedProduct || isSelectedProductProcessed) return;

      const key = String(selectedProduct.prodId || selectedProduct.id);
      if (processingRef.current.has(key)) return;

      if (selectedProduct.trigger && selectedProduct.prodId && selectedProduct.trigger.includes('-')) {
        const [superModelId, idAttribute] = selectedProduct.trigger.split('-');
        const url = `https://www.decathlon.com.co/module/oneshop_oneff/sizeselector?superModelId=${superModelId}&idAttribute=${idAttribute}&modelId=${selectedProduct.prodId}&lat=4.7344442&lng=-74.0667869&postalCode=111156&usage=PRODUCT_ACTION`;

        if (cacheRef.current.has(url)) {
          processSingleResult(key, url, cacheRef.current.get(url));
        } else if (!inFlightRef.current.has(url)) {
          inFlightRef.current.add(url);
          try {
            const jsonRes = await fetchFromProxy([{
              index: 0,
              url,
              meta: {
                id: key,
                name: selectedProduct.nombre || '',
                image: selectedProduct.img || '',
                link: `${import.meta.env.VITE_PUBLIC_SITE_URL}/#/product/${key}`
              }
            }]);

            const proxyResult = jsonRes?.results?.find(r => r.index === 0);
            let decathlonData = [];
            
            if (jsonRes.success && proxyResult && proxyResult.data) {
              decathlonData = proxyResult.data;
              cacheRef.current.set(url, decathlonData);
            }
            processSingleResult(key, url, decathlonData);
          } catch (err) {
            console.warn("Proxy processing failed for single product", err);
            processingRef.current.add(key);
            inFlightRef.current.delete(url);
            
            setProducts(prev => {
              const newProducts = [...prev];
              const existingIdx = newProducts.findIndex(item => String(item.prodId || item.id) === key);
              const updatedFail = { ...(existingIdx >= 0 ? newProducts[existingIdx] : selectedProduct), isProcessed: true };
              if (existingIdx >= 0) newProducts[existingIdx] = updatedFail;
              else newProducts.push(updatedFail);
              return newProducts;
            });
          }
        }
      } else {
        processSingleResult(key, null, null);
      }
    };

    fetchSingleProduct();
  }, [selectedProduct, isSelectedProductProcessed]);

  useEffect(() => {
    if (selectedProduct && window.fbq) {
      window.fbq('track', 'ViewContent', {
        content_name: getProductName(selectedProduct),
        value: Number(selectedProduct.pCombo || selectedProduct.pAntes || 0),
        currency: 'COP'
      });
    }
  }, [selectedProduct]);

  const handleCloseModal = useCallback(() => {
    navigate("/");
  }, [navigate]);

  return (
    <main className="page-container">
      <div className="home-header">
        <h2 className="home-title">{title}</h2>
        <p className="home-subtitle">{subtitle}</p>
      </div>

      {tab === 'categories' && !loading && !error && (
        <div className="category-filter">
          {availableCategories.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className={`category-btn ${currentCategory === cat || (!currentCategory && cat === 'Todo') ? 'active' : ''}`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {loading || isInitialProxyLoading ? (
        <div className="loader-container">
          <div className="loader" />
        </div>
      ) : error ? (
        <div className="glass-panel error-container">
          <h3 className="error-title">Error al cargar productos</h3>
          <p>{error}</p>
        </div>
      ) : tab === 'categories' && !currentCategory ? (
        <div className="glass-panel empty-state">
          <h3 className="empty-title">Selecciona una Categoría</h3>
          <p className="empty-text">Elige una categoría arriba para empezar a explorar.</p>
        </div>
      ) : finalDisplayList.length === 0 ? (
        <div className="glass-panel empty-state">
          <h3 className="empty-title">No se encontraron productos</h3>
          <p className="empty-text">Intenta seleccionar un filtro diferente.</p>
        </div>
      ) : (
        <>
          <ProductGrid products={finalDisplayList} />
          {visibleCount < filteredList.length && (
            <div ref={loaderRef} className="loading-trigger">
              {fetchingMore && <div className="mini-loader" />}
            </div>
          )}
        </>
      )}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={handleCloseModal}
        />
      )}
    </main>
  );
};

export default Home;
