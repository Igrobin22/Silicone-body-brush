(function () {
  'use strict';

  var storageKey = 'pureform.cart.v1';
  var memoryCart = [];

  var catalog = {
    'pureform-4pc-set-grey': {
      name: 'Grey 4-Piece Silicone Brush Set',
      price: 87.78,
      image: 'https://res.cloudinary.com/dqjilscgl/image/upload/v1779553519/grey_transparent_all_4_piece_med27b.png',
      meta: 'Grey set / 4 tools'
    },
    'pureform-4pc-set-black': {
      name: 'Black 4-Piece Silicone Brush Set',
      price: 87.78,
      image: 'assets/pureform-body-brush.png',
      meta: 'Black set / 4 tools'
    },
    'pureform-4pc-set-pink': {
      name: 'Pink 4-Piece Silicone Brush Set',
      price: 87.78,
      image: 'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227618/main_img_without_bg_mbrxsg.png',
      meta: 'Pink set / 4 tools'
    },
    'back-scrubber': {
      name: 'Long Handle Back Scrubber',
      price: 39,
      image: 'assets/pureform-back-scrubber.png',
      meta: 'Back reach'
    },
    'body-brush': {
      name: 'Silicone Body Brush',
      price: 29,
      image: 'assets/pureform-body-brush.png',
      meta: 'Daily cleanse'
    },
    'scalp-massager': {
      name: 'Silicone Scalp Massager',
      price: 24,
      image: 'assets/pureform-scalp-massager.png',
      meta: 'Shampoo massage'
    },
    'face-brush': {
      name: 'Gentle Silicone Face Brush',
      price: 22,
      image: 'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227617/p_face_1_f4vdyz.png',
      meta: 'Face care'
    },
    'family-bundle': {
      name: 'Three Set Family Bundle',
      price: 228,
      image: 'https://res.cloudinary.com/dqjilscgl/image/upload/v1779553513/grey_white_bg_irnzyc.png',
      meta: 'Grey, Black, Pink'
    }
  };

  var aliases = {
    grey: 'pureform-4pc-set-grey',
    black: 'pureform-4pc-set-black',
    pink: 'pureform-4pc-set-pink',
    mixed: 'family-bundle',
    'mixed-colors': 'family-bundle',
    three: 'family-bundle'
  };

  function normalizeId(id) {
    var normalized = String(id || '').trim();
    normalized = aliases[normalized] || normalized;
    return catalog[normalized] ? normalized : '';
  }

  function clampQuantity(quantity) {
    return Math.max(1, parseInt(quantity, 10) || 1);
  }

  function formatAED(amount) {
    return 'AED ' + (Number(amount) || 0).toFixed(2);
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
      var quantity = clampQuantity(item && item.quantity);
      var existing;

      if (!id) {
        return cart;
      }

      existing = cart.find(function (cartItem) {
        return cartItem.id === id;
      });

      if (existing) {
        existing.quantity += quantity;
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

    if (!productId) {
      return getCart();
    }

    cart = getCart();
    existing = cart.find(function (item) {
      return item.id === productId;
    });

    if (existing) {
      existing.quantity += clampQuantity(quantity);
    } else {
      cart.push({ id: productId, quantity: clampQuantity(quantity) });
    }

    return saveCart(cart);
  }

  function setQuantity(id, quantity) {
    var productId = normalizeId(id);
    var numericQuantity = parseInt(quantity, 10);
    var cart;

    if (!productId) {
      return getCart();
    }

    if (!numericQuantity || numericQuantity < 1) {
      return removeItem(productId);
    }

    cart = getCart().map(function (item) {
      return item.id === productId ? { id: productId, quantity: numericQuantity } : item;
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
        price: product.price,
        image: product.image,
        meta: product.meta,
        quantity: quantity,
        lineTotal: product.price * quantity
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
    catalog: catalog,
    clearCart: clearCart,
    formatAED: formatAED,
    getCart: getCart,
    getCheckoutUrl: getCheckoutUrl,
    getCount: getCount,
    getLineItems: getLineItems,
    getSubtotal: getSubtotal,
    getSummaryText: getSummaryText,
    removeItem: removeItem,
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
})();
