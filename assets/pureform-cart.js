(function () {
  'use strict';

  var storageKey = 'pureform.cart.v1';
  var memoryCart = [];

  var fallbackCatalog = {
    'pureform-4pc-set-grey': {
      id: 'pureform-4pc-set-grey',
      name: 'Grey 4-Piece Silicone Brush Set',
      price: 43.89,
      regularPrice: 87.78,
      image: 'https://res.cloudinary.com/dqjilscgl/image/upload/v1779553519/grey_transparent_all_4_piece_med27b.png',
      meta: 'Grey set / 4 tools'
    },
    'pureform-4pc-set-black': {
      id: 'pureform-4pc-set-black',
      name: 'Black 4-Piece Silicone Brush Set',
      price: 43.89,
      regularPrice: 87.78,
      image: 'assets/pureform-body-brush.png',
      meta: 'Black set / 4 tools'
    },
    'pureform-4pc-set-pink': {
      id: 'pureform-4pc-set-pink',
      name: 'Pink 4-Piece Silicone Brush Set',
      price: 37.80,
      regularPrice: 42,
      image: 'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227618/main_img_without_bg_mbrxsg.png',
      meta: 'Pink set / 4 tools'
    }
  };

  var catalog = window.PureFormCatalog && typeof window.PureFormCatalog.getCatalogSync === 'function'
    ? window.PureFormCatalog.getCatalogSync()
    : Object.assign({}, fallbackCatalog);

  var aliases = {
    grey: 'pureform-4pc-set-grey',
    black: 'pureform-4pc-set-black',
    pink: 'pureform-4pc-set-pink',
    'grey-4-piece-silicone-brush-set': 'pureform-4pc-set-grey',
    'black-4-piece-silicone-brush-set': 'pureform-4pc-set-black',
    'pink-4-piece-silicone-brush-set': 'pureform-4pc-set-pink'
  };

  function normalizeId(id) {
    var normalized = String(id || '').trim();
    if (window.PureFormCatalog && typeof window.PureFormCatalog.resolveSlug === 'function') {
      normalized = window.PureFormCatalog.resolveSlug(normalized);
    }
    normalized = aliases[normalized] || normalized;
    return catalog[normalized] ? normalized : '';
  }

  function clampQuantity(quantity) {
    return Math.min(20, Math.max(1, parseInt(quantity, 10) || 1));
  }

  function getMaxQuantity(product) {
    var rawQuantity = parseInt(product && product.inventory_quantity, 10);

    if (!product) {
      return 0;
    }

    if (product.inventory_status === 'out_of_stock') {
      return 0;
    }

    return Number.isFinite(rawQuantity) ? Math.max(0, rawQuantity) : Infinity;
  }

  function clampQuantityForProduct(product, quantity) {
    var maxQuantity = getMaxQuantity(product);

    if (maxQuantity <= 0) {
      return 0;
    }

    return Math.min(clampQuantity(quantity), maxQuantity);
  }

  function formatAED(amount) {
    return 'AED ' + (Number(amount) || 0).toFixed(2);
  }

  function setCatalog(nextCatalog) {
    if (!nextCatalog || typeof nextCatalog !== 'object') {
      return;
    }

    catalog = Object.keys(nextCatalog).reduce(function (cleanCatalog, key) {
      if (fallbackCatalog[key] || aliases[key]) {
        cleanCatalog[key] = Object.assign({}, fallbackCatalog[key] || {}, nextCatalog[key]);
      }

      return cleanCatalog;
    }, {});

    if (!Object.keys(catalog).length) {
      catalog = Object.assign({}, fallbackCatalog);
    }

    saveCart(getCart());
  }

  function readCart() {
    try {
      var parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return memoryCart.slice();
    }
  }

  function sanitizeCart(items) {
    return items.reduce(function (cart, item) {
      var id = normalizeId(item && item.id);
      // Stock may be held by this customer's open payment session. Keep cart intent;
      // adding/changing quantities and the server still check live availability.
      var quantity = clampQuantity(item && item.quantity);
      var existing;

      if (!id || !quantity) {
        return cart;
      }

      existing = cart.find(function (cartItem) {
        return cartItem.id === id;
      });

      if (existing) {
        existing.quantity = clampQuantity(existing.quantity + quantity);
        return cart;
      }

      cart.push({ id: id, quantity: quantity });
      return cart;
    }, []);
  }

  function saveCart(items) {
    var cleanItems = sanitizeCart(items);
    memoryCart = cleanItems.slice();

    try {
      localStorage.setItem(storageKey, JSON.stringify(cleanItems));
    } catch (error) {
      memoryCart = cleanItems.slice();
    }

    updateNavCount(cleanItems);
    window.dispatchEvent(new CustomEvent('pureform:cart-change', {
      detail: { items: cleanItems, count: getCount(cleanItems), subtotal: getSubtotal(cleanItems) }
    }));

    return cleanItems;
  }

  function getCart() {
    return sanitizeCart(readCart());
  }

  function addItem(id, quantity) {
    var productId = normalizeId(id);
    var cart;
    var existing;
    var product;
    var nextQuantity;

    if (!productId) {
      return getCart();
    }

    product = catalog[productId];
    cart = getCart();
    existing = cart.find(function (item) {
      return item.id === productId;
    });

    if (existing) {
      nextQuantity = clampQuantityForProduct(product, existing.quantity + clampQuantity(quantity));
      if (nextQuantity <= existing.quantity) {
        return cart;
      }
      existing.quantity = nextQuantity;
    } else {
      nextQuantity = clampQuantityForProduct(product, quantity);
      if (nextQuantity > 0) {
        cart.push({ id: productId, quantity: nextQuantity });
      }
    }

    return saveCart(cart);
  }

  function setQuantity(id, quantity) {
    var productId = normalizeId(id);
    var numericQuantity = parseInt(quantity, 10);
    var product = productId ? catalog[productId] : null;
    var nextQuantity;
    var cart;
    var existing;

    if (!productId) {
      return getCart();
    }

    if (!numericQuantity || numericQuantity < 1) {
      return removeItem(productId);
    }

    cart = getCart();
    existing = cart.find(function (item) { return item.id === productId; });
    if (!existing || numericQuantity === existing.quantity) return cart;

    // Reductions change cart intent, even when a payment currently holds the stock.
    nextQuantity = numericQuantity < existing.quantity
      ? clampQuantity(numericQuantity)
      : clampQuantityForProduct(product, numericQuantity);
    if (numericQuantity > existing.quantity && nextQuantity <= existing.quantity) return cart;

    cart = cart.map(function (item) {
      return item.id === productId ? { id: productId, quantity: nextQuantity } : item;
    });

    return saveCart(cart);
  }

  function removeItem(id) {
    var productId = normalizeId(id);

    return saveCart(getCart().filter(function (item) {
      return item.id !== productId;
    }));
  }

  function clearCart() {
    return saveCart([]);
  }

  function getLineItems(items) {
    return (items || getCart()).map(function (item) {
      var product = catalog[item.id];
      var quantity = clampQuantity(item.quantity);

      return {
        id: item.id,
        name: product.name,
        price: Number(product.price) || 0,
        regularPrice: Number(product.regularPrice) || Number(product.price) || 0,
        image: product.image,
        meta: product.meta,
        inventoryQuantity: Number.isFinite(parseInt(product.inventory_quantity, 10)) ? Math.max(0, parseInt(product.inventory_quantity, 10)) : null,
        inventoryStatus: product.inventory_status || 'in_stock',
        quantity: quantity,
        lineTotal: (Number(product.price) || 0) * quantity,
        lineSavings: Math.max(0, ((Number(product.regularPrice) || Number(product.price) || 0) - (Number(product.price) || 0)) * quantity)
      };
    });
  }

  function getCount(items) {
    return (items || getCart()).reduce(function (sum, item) {
      return sum + clampQuantity(item.quantity);
    }, 0);
  }

  function getSubtotal(items) {
    return getLineItems(items).reduce(function (sum, item) {
      return sum + item.lineTotal;
    }, 0);
  }

  function getSavings(items) {
    return getLineItems(items).reduce(function (sum, item) {
      return sum + item.lineSavings;
    }, 0);
  }

  function getShippingTotal(items) {
    var fee = Number((window.PUREFORM_SUPABASE_CONFIG || {}).shippingFeeAED);
    var count = getCount(items);
    return count > 0 && count < 2 ? (Number.isFinite(fee) && fee >= 0 ? fee : 10) : 0;
  }

  function addItems(items) {
    if (!Array.isArray(items) || !items.length) return false;
    var next = getCart().map(function (item) { return { id: item.id, quantity: item.quantity }; });
    for (var i = 0; i < items.length; i++) {
      if (!items[i] || typeof items[i] !== 'object') return false;
      var id = normalizeId(items[i].id);
      var quantity = items[i].quantity;
      if (!id || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return false;
      var existing = next.find(function (item) { return item.id === id; });
      var desired = (existing ? existing.quantity : 0) + quantity;
      if (desired > 20 || desired > getMaxQuantity(catalog[id])) return false;
      if (existing) existing.quantity = desired;
      else next.push({ id: id, quantity: quantity });
    }
    saveCart(next);
    return true;
  }

  function getTotal(items) {
    return getSubtotal(items) + getShippingTotal(items);
  }

  function getCheckoutUrl() {
    return 'checkout.html';
  }

  function getSummaryText(items) {
    var lineItems = getLineItems(items);
    var lines = lineItems.map(function (item) {
      return '- ' + item.name + ' x ' + item.quantity + ' = ' + formatAED(item.lineTotal);
    });

    lines.push('Subtotal: ' + formatAED(getSubtotal(items)));
    return lines.join('\n');
  }

  function updateNavCount(items) {
    var count = getCount(items || getCart());
    var label = count + (count === 1 ? ' item in cart' : ' items in cart');

    document.querySelectorAll('.nav-cart-count').forEach(function (countNode) {
      countNode.textContent = String(count);
      countNode.setAttribute('aria-label', label);
    });

    document.querySelectorAll('.nav-cart').forEach(function (cartLink) {
      cartLink.setAttribute('aria-label', 'Open cart, ' + label);
    });
  }

  window.PureFormCart = {
    addItem: addItem,
    addItems: addItems,
    catalog: catalog,
    clearCart: clearCart,
    formatAED: formatAED,
    getCart: getCart,
    getCheckoutUrl: getCheckoutUrl,
    getCount: getCount,
    getLineItems: getLineItems,
    getSavings: getSavings,
    getShippingTotal: getShippingTotal,
    getSubtotal: getSubtotal,
    getTotal: getTotal,
    getSummaryText: getSummaryText,
    removeItem: removeItem,
    setCatalog: setCatalog,
    setQuantity: setQuantity
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      updateNavCount();
    });
  } else {
    updateNavCount();
  }

  window.addEventListener('storage', function (event) {
    if (event.key === storageKey) {
      updateNavCount();
    }
  });

  window.addEventListener('pureform:catalog-ready', function (event) {
    setCatalog(event.detail && event.detail.catalog);
    window.PureFormCart.catalog = catalog;
  });
  window.addEventListener('pureform:catalog-refresh', function (event) {
    var next = event.detail && event.detail.catalog;
    if (next && JSON.stringify(next) !== JSON.stringify(catalog)) {
      setCatalog(next);
      window.PureFormCart.catalog = catalog;
    }
  });
})();
