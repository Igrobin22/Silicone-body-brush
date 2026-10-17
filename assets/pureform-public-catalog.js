(function () {
  'use strict';

  var SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  var OFFICIAL_SLUGS = [
    'pureform-4pc-set-grey',
    'pureform-4pc-set-black',
    'pureform-4pc-set-pink'
  ];
  var LEGACY_SLUG_ALIASES = {
    'grey-4-piece-silicone-brush-set': 'pureform-4pc-set-grey',
    'black-4-piece-silicone-brush-set': 'pureform-4pc-set-black',
    'pink-4-piece-silicone-brush-set': 'pureform-4pc-set-pink'
  };
  var QUERY_SLUGS = OFFICIAL_SLUGS.concat(Object.keys(LEGACY_SLUG_ALIASES));
  var DEFAULT_SLUG = OFFICIAL_SLUGS[0];
  var config = window.PUREFORM_SUPABASE_CONFIG || {};
  var greyPhotos = [
    'https://res.cloudinary.com/dqjilscgl/image/upload/v1779553519/grey_transparent_all_4_piece_med27b.png',
    'https://res.cloudinary.com/dqjilscgl/image/upload/v1779553521/Main_with_background_anlah0.png',
    'https://res.cloudinary.com/dqjilscgl/image/upload/v1779553513/grey_white_bg_irnzyc.png',
    'https://res.cloudinary.com/dqjilscgl/image/upload/v1779553535/grey_Head_h1duwj.png'
  ];
  var pinkPhotos = [
    'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227617/main_img_voei63.png',
    'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227618/main_img_without_bg_mbrxsg.png',
    'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227616/p_body_1_kgg059.png',
    'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227617/p_body_2_lv1x37.png',
    'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227617/p_face_1_f4vdyz.png',
    'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227619/p_face_2_yoirlr.png',
    'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227619/p_head_1_yquyts.png',
    'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227620/p_head_2_vtl4pl.png',
    'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227619/p_handle_1_crtic9.png',
    'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227619/p_handle_2_komo0m.png'
  ];

  var fallbackListings = [
    {
      slug: 'pureform-4pc-set-grey',
      name: 'Grey 4-Piece Silicone Brush Set',
      description: 'A complete PureForm silicone brush set in Grey, made for smoother cleansing, easier reach, and a fresher post-shower feel.',
      price: 87.78,
      discount: 50,
      discount_mode: 'ongoing',
      inventory_quantity: 24,
      inventory_status: 'in_stock',
      inventory_note: 'Grey set / 4 tools',
      visible: true,
      photo_urls: greyPhotos,
      sort_order: 1
    },
    {
      slug: 'pureform-4pc-set-black',
      name: 'Black 4-Piece Silicone Brush Set',
      description: 'The same four-piece PureForm shower routine in a clean Black finish, including back, body, scalp, and face tools.',
      price: 87.78,
      discount: 50,
      discount_mode: 'ongoing',
      inventory_quantity: 18,
      inventory_status: 'in_stock',
      inventory_note: 'Black set / 4 tools',
      visible: true,
      photo_urls: ['assets/pureform-body-brush.png', 'assets/pureform-back-scrubber.png', 'assets/pureform-scalp-massager.png', 'assets/pureform-face-brush.png'],
      sort_order: 2
    },
    {
      slug: 'pureform-4pc-set-pink',
      name: 'Pink 4-Piece Silicone Brush Set',
      description: 'A softer Pink finish for the same complete face, scalp, body, and back silicone cleansing routine.',
      price: 42,
      discount: 10,
      discount_mode: 'ongoing',
      inventory_quantity: 12,
      inventory_status: 'low_stock',
      inventory_note: 'Pink set / 4 tools',
      visible: true,
      photo_urls: pinkPhotos,
      sort_order: 3
    }
  ];

  var state = {
    listings: normalizeListings(fallbackListings),
    source: 'fallback',
    ready: false
  };

  function toNumber(value, fallback) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function formatAED(amount) {
    return 'AED ' + (toNumber(amount, 0)).toFixed(2);
  }

  function canonicalSlug(value) {
    var slug = String(value || '').trim();
    return LEGACY_SLUG_ALIASES[slug] || slug;
  }

  function canonicalSlugForColor(color) {
    if (color === 'Pink') return 'pureform-4pc-set-pink';
    if (color === 'Black') return 'pureform-4pc-set-black';
    return 'pureform-4pc-set-grey';
  }

  function sentenceCase(value) {
    return String(value || '')
      .replace(/_/g, ' ')
      .replace(/\w\S*/g, function (word) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      });
  }

  function colorFromSlug(slug, name) {
    var source = String(slug || name || '').toLowerCase();
    if (source.indexOf('pink') !== -1) return 'Pink';
    if (source.indexOf('black') !== -1) return 'Black';
    return 'Grey';
  }

  function swatchForColor(color) {
    if (color === 'Pink') return 'linear-gradient(135deg, #ffd8e2, #d28ca1)';
    if (color === 'Black') return 'linear-gradient(135deg, #5b5b5b, #070707)';
    return 'linear-gradient(135deg, #eeeeea, #868681)';
  }

  function fallbackPhotosForSlug(slug) {
    slug = canonicalSlug(slug);
    if (slug === 'pureform-4pc-set-pink') return pinkPhotos.slice();
    if (slug === 'pureform-4pc-set-black') return ['assets/pureform-body-brush.png', 'assets/pureform-back-scrubber.png', 'assets/pureform-scalp-massager.png', 'assets/pureform-face-brush.png'];
    return greyPhotos.slice();
  }

  function storefrontPhotoUrl(value) {
    try {
      var url = new URL(value);
      var rawUpload = /^(\/[^/]+\/image\/upload\/)(v\d+\/)/;
      if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password || url.port || url.search || url.hash || !rawUpload.test(url.pathname)) return value;
      // Preserve admin originals and existing transformations; limit delivery without cropping.
      url.pathname = url.pathname.replace(rawUpload, '$1f_auto,q_auto,c_limit,w_1400/$2');
      return url.href;
    } catch (_error) {
      return value;
    }
  }

  function isDiscountActive(item) {
    var discount = toNumber(item && item.discount, 0);
    var now;
    var starts;
    var ends;

    if (!discount || discount <= 0) {
      return false;
    }

    if ((item.discount_mode || 'ongoing') !== 'fixed') {
      return true;
    }

    now = Date.now();
    starts = item.discount_starts_at ? Date.parse(item.discount_starts_at) : NaN;
    ends = item.discount_ends_at ? Date.parse(item.discount_ends_at) : NaN;

    if (Number.isFinite(starts) && now < starts) {
      return false;
    }

    if (Number.isFinite(ends) && now > ends) {
      return false;
    }

    return true;
  }

  function salePrice(item) {
    var price = toNumber(item && item.price, 0);
    var discount = isDiscountActive(item) ? Math.min(100, Math.max(0, toNumber(item.discount, 0))) : 0;
    return Math.max(0, price * (1 - discount / 100));
  }

  function normalizeListing(item) {
    var rawSlug = String(item && item.slug || '').trim();
    var color = colorFromSlug(rawSlug, item && item.name);
    var slug = canonicalSlug(rawSlug) || canonicalSlugForColor(color);
    var photos = Array.isArray(item && item.photo_urls) ? item.photo_urls.filter(Boolean) : [];
    var regularPrice = toNumber(item && item.price, 0);
    var activeDiscount = isDiscountActive(item);
    var activePrice = salePrice(item);
    var inventoryStatus = String(item && item.inventory_status || 'in_stock');
    var inventoryQuantity = Math.max(0, parseInt(item && item.inventory_quantity, 10) || 0);

    if (!photos.length) {
      photos = fallbackPhotosForSlug(slug);
    }
    photos = photos.map(storefrontPhotoUrl);

    return {
      id: slug,
      slug: slug,
      sourceSlug: rawSlug,
      name: String(item && item.name || color + ' 4-Piece Silicone Brush Set').trim(),
      description: String(item && item.description || '').trim(),
      lead: String(item && item.description || '').trim(),
      regularPrice: regularPrice,
      price: activePrice,
      discount: toNumber(item && item.discount, 0),
      discountActive: activeDiscount,
      priceText: formatAED(activePrice),
      regularPriceText: formatAED(regularPrice),
      discountLabel: activeDiscount ? Math.round(toNumber(item.discount, 0)) + '% off' : '',
      discount_mode: item && item.discount_mode || 'ongoing',
      discount_starts_at: item && item.discount_starts_at || null,
      discount_ends_at: item && item.discount_ends_at || null,
      inventory_quantity: inventoryQuantity,
      inventory_status: inventoryStatus,
      inventoryStatusText: inventoryQuantity <= 0 ? 'Out of stock' : sentenceCase(inventoryStatus),
      visible: item ? item.visible !== false : true,
      images: photos,
      image: photos[0],
      meta: color + ' set / 4 tools',
      tag: color + ' Set',
      color: color,
      swatch: swatchForColor(color),
      sort_order: toNumber(item && item.sort_order, OFFICIAL_SLUGS.indexOf(slug) + 1),
      fit: [
        'Complete 4-piece set for face, scalp, body, and back care.',
        'Soft silicone bristles rinse clean after use.',
        'AED 10 delivery per order across the UAE.'
      ]
    };
  }

  function normalizeListings(items) {
    var bySlug = Object.create(null);

    (items || []).forEach(function (item) {
      var slug = canonicalSlug(item && item.slug);
      if (!item || OFFICIAL_SLUGS.indexOf(slug) === -1 || item.visible === false) {
        return;
      }

      if (!bySlug[slug] || shouldPreferListing(item, bySlug[slug])) {
        bySlug[slug] = item;
      }
    });

    return OFFICIAL_SLUGS
      .map(function (slug) { return bySlug[slug]; })
      .filter(Boolean)
      .map(normalizeListing)
      .sort(function (a, b) {
        return toNumber(a.sort_order, OFFICIAL_SLUGS.indexOf(a.slug) + 1) - toNumber(b.sort_order, OFFICIAL_SLUGS.indexOf(b.slug) + 1);
      });
  }

  function listingUpdatedTime(item) {
    var time = Date.parse(item && item.updated_at || '');
    return Number.isFinite(time) ? time : 0;
  }

  function shouldPreferListing(candidate, existing) {
    var candidateUpdated = listingUpdatedTime(candidate);
    var existingUpdated = listingUpdatedTime(existing);
    var candidateSlug = String(candidate && candidate.slug || '').trim();
    var existingSlug = String(existing && existing.slug || '').trim();
    var candidateIsCanonical = candidateSlug === canonicalSlug(candidateSlug);
    var existingIsCanonical = existingSlug === canonicalSlug(existingSlug);

    if (candidateUpdated !== existingUpdated) {
      return candidateUpdated > existingUpdated;
    }

    if (candidateIsCanonical !== existingIsCanonical) {
      return candidateIsCanonical;
    }

    return toNumber(candidate && candidate.sort_order, 9999) < toNumber(existing && existing.sort_order, 9999);
  }

  function listingsToCatalog(listings) {
    return listings.reduce(function (catalog, item) {
      catalog[item.id] = item;
      return catalog;
    }, {});
  }

  function getListingsSync() {
    return state.listings.slice();
  }

  function getCatalogSync() {
    return listingsToCatalog(state.listings);
  }

  function getProduct(id) {
    var catalog = getCatalogSync();
    return catalog[id] || catalog[DEFAULT_SLUG] || state.listings[0] || null;
  }

  function createElement(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function appendPrice(parent, item, strongClass) {
    var price = createElement('strong', strongClass || '', item.priceText);
    parent.appendChild(price);

    if (item.discountActive && item.regularPrice > item.price) {
      var compare = createElement('del', 'pf-catalog-compare-price', item.regularPriceText);
      parent.appendChild(compare);
    }
  }

  function inventoryBadgeText(item) {
    if (item.inventory_quantity <= 0 || item.inventory_status === 'out_of_stock') return 'Out of stock';
    if (item.discountActive) return item.discountLabel.toUpperCase();
    return item.inventoryStatusText;
  }

  function renderHomeCards(root, listings) {
    if (!root) return;

    root.replaceChildren();

    listings.forEach(function (item) {
      var card = createElement('a', 'pcard reveal in-view visible is-visible');
      var sale = createElement('span', 'pcard-sale', inventoryBadgeText(item));
      var imageWrap = createElement('div', 'pcard-imgwrap');
      var picture = createElement('picture', 'pcard-picture');
      var img = createElement('img', 'pcard-img');
      var name = createElement('h3', 'pcard-name', item.name);
      var price = createElement('p', 'pcard-desc', item.priceText);
      var tag = createElement('span', 'pcard-tag', 'View ' + item.color + ' set');

      card.href = 'pureform-product-detail.html?product=' + encodeURIComponent(item.id);
      card.setAttribute('aria-label', 'View ' + item.name + ' details');
      img.src = item.image;
      img.width = 700;
      img.height = 700;
      img.alt = item.name;
      img.loading = 'lazy';
      img.decoding = 'async';

      if (item.discountActive && item.regularPrice > item.price) {
        price.appendChild(document.createTextNode(' '));
        price.appendChild(createElement('del', 'pf-catalog-compare-price', item.regularPriceText));
      }

      picture.appendChild(img);
      imageWrap.appendChild(picture);
      card.appendChild(sale);
      card.appendChild(imageWrap);
      card.appendChild(name);
      card.appendChild(price);
      card.appendChild(tag);
      root.appendChild(card);
    });
  }

  function renderCollectionCards(root, listings) {
    if (!root) return;

    root.replaceChildren();

    listings.forEach(function (item, index) {
      var card = createElement('a', 'collection-card is-visible');
      var media = createElement('div', 'collection-card-media');
      var badge = createElement('span', 'collection-badge', inventoryBadgeText(item));
      var img = document.createElement('img');
      var info = createElement('div', 'collection-card-info');
      var title = createElement('h2', 'collection-card-title', item.name);
      var meta = createElement('div', 'collection-card-meta', item.meta);

      card.href = 'pureform-product-detail.html?product=' + encodeURIComponent(item.id);
      card.dataset.animate = '';
      img.src = item.image;
      img.width = 700;
      img.height = 700;
      img.alt = item.name;
      img.decoding = 'async';
      if (index) img.loading = 'lazy';

      media.appendChild(badge);
      media.appendChild(img);
      info.appendChild(title);
      appendPrice(info, item);
      card.appendChild(media);
      card.appendChild(info);
      card.appendChild(meta);
      root.appendChild(card);
    });
  }

  function renderRecommendationCards(root, listings) {
    if (!root) return;

    root.replaceChildren();

    listings.forEach(function (item) {
      var card = createElement('a', 'product-card cart-product-card product-card-' + item.color.toLowerCase() + ' is-visible');
      var img = document.createElement('img');
      var colorRow = createElement('div', 'color-row');
      var dot = createElement('span', 'color-dot color-dot-' + item.color.toLowerCase());
      var set = createElement('span', '', item.tag);
      var title = createElement('h3', 'card-title', item.name);
      var copy = createElement('p', 'card-text', item.description);
      var price = createElement('p', 'card-text pf-catalog-card-price', item.priceText);

      card.href = 'pureform-product-detail.html?product=' + encodeURIComponent(item.id);
      card.dataset.animate = '';
      img.src = item.image;
      img.alt = item.name;
      img.loading = 'lazy';
      img.decoding = 'async';
      dot.setAttribute('aria-hidden', 'true');
      colorRow.appendChild(dot);
      colorRow.appendChild(set);
      card.appendChild(img);
      card.appendChild(colorRow);
      card.appendChild(title);
      card.appendChild(copy);
      card.appendChild(price);
      root.appendChild(card);
    });
  }

  function renderShadeCards(root, listings) {
    if (!root) return;

    root.replaceChildren();

    listings.forEach(function (item) {
      var card = createElement('article', 'shade-card shade-card-' + item.color.toLowerCase() + ' reveal in-view visible is-visible');
      var top = createElement('div', 'shade-card-top');
      var badge = createElement('span', 'shade-badge', item.inventory_quantity <= 0 ? 'Out' : 'Listed');
      var swatch = createElement('span', 'shade-swatch shade-swatch-' + item.color.toLowerCase());
      var body = createElement('div', 'shade-card-body');
      var title = createElement('h3', '', item.tag);
      var copy = createElement('p', '', item.description);
      var link = createElement('a', 'shade-select', 'Open ' + item.color + ' product');

      card.dataset.shade = item.tag;
      swatch.setAttribute('aria-hidden', 'true');
      link.href = 'pureform-product-detail.html?product=' + encodeURIComponent(item.id);
      top.appendChild(badge);
      top.appendChild(swatch);
      body.appendChild(title);
      body.appendChild(copy);
      card.appendChild(top);
      card.appendChild(body);
      card.appendChild(link);
      root.appendChild(card);
    });
  }

  function renderOfferCards(root, listings) {
    if (!root) return;

    root.replaceChildren();

    listings.forEach(function (item) {
      var card = createElement('div', 'policy-card is-visible');
      var kicker = createElement('div', 'card-kicker', item.tag);
      var title = createElement('h3', 'card-title', item.name);
      var copy = createElement('p', '', item.description);
      var price = createElement('div', 'set-price', item.priceText);
      var row = createElement('div', 'button-row');
      var link = createElement('a', 'btn-p Btn buy-pay-button');
      var label = createElement('span', '', item.inventory_quantity <= 0 ? 'Out of stock' : 'Start Order');

      card.dataset.animate = '';
      link.href = 'pureform-product-detail.html?product=' + encodeURIComponent(item.id);
      link.appendChild(label);
      row.appendChild(link);
      card.appendChild(kicker);
      card.appendChild(title);
      card.appendChild(copy);
      card.appendChild(price);
      card.appendChild(row);
      root.appendChild(card);
    });
  }

  function updateCount(listings) {
    document.querySelectorAll('[data-pf-catalog-count], .collection-count').forEach(function (node) {
      node.textContent = listings.length + (listings.length === 1 ? ' product' : ' products');
    });
  }

  function renderPage() {
    var listings = getListingsSync();
    var collectionRoot = document.querySelector('[data-pf-catalog-grid="collection"]');
    var collectionListings = getCollectionListings(listings);
    renderHomeCards(document.querySelector('[data-pf-catalog-grid="home"]'), listings);
    renderCollectionCards(collectionRoot, collectionListings);
    renderRecommendationCards(document.querySelector('[data-pf-catalog-grid="recommendations"]'), listings);
    renderShadeCards(document.querySelector('[data-pf-catalog-grid="shade"]'), listings);
    renderOfferCards(document.querySelector('[data-pf-catalog-grid="offers"]'), listings);
    updateCount(collectionRoot ? collectionListings : listings);
    var emptyState = document.querySelector('[data-pf-catalog-empty]');
    if (emptyState) emptyState.hidden = collectionListings.length > 0;
    updateHomePrice(listings);
  }

  function getCollectionListings(listings) {
    var activeColor = document.querySelector('[data-pf-color][aria-pressed="true"]');
    var stockOnly = document.querySelector('[data-pf-in-stock]');
    var sort = document.querySelector('[data-pf-sort]');
    var color = activeColor ? activeColor.dataset.pfColor : '';
    var filtered = listings.filter(function (item) {
      return (!color || item.color === color) &&
        (!stockOnly || !stockOnly.checked || (item.inventory_quantity > 0 && item.inventory_status !== 'out_of_stock'));
    });
    if (sort && sort.value !== 'featured') {
      filtered.sort(function (a, b) {
        return sort.value === 'price-desc' ? b.price - a.price : a.price - b.price;
      });
    }
    return filtered;
  }

  function updateHomePrice(listings) {
    var node = document.querySelector('[data-pf-home-price]');
    if (!node) return;
    var featuredId = node.getAttribute('data-pf-home-price');
    if (featuredId) {
      var featured = listings.find(function (item) { return item.id === featuredId; });
      var inStock = featured && featured.inventory_quantity > 0 && featured.inventory_status !== 'out_of_stock';
      node.textContent = inStock ? formatAED(featured.price) : 'Currently unavailable';
      var orderLink = document.querySelector('[data-pf-home-order]');
      if (orderLink) {
        orderLink.href = inStock ? 'pureform-product-detail.html?product=' + encodeURIComponent(featured.id) : 'products.html';
        orderLink.textContent = inStock ? 'Start Order' : 'Choose a Set';
      }
      return;
    }
    var available = listings.filter(function (item) {
      return item.inventory_quantity > 0 && item.inventory_status !== 'out_of_stock';
    });
    node.textContent = available.length
      ? 'From ' + formatAED(Math.min.apply(null, available.map(function (item) { return item.price; })))
      : 'Currently unavailable';
  }

  function setupCollectionControls() {
    document.querySelectorAll('[data-pf-color]').forEach(function (button) {
      button.addEventListener('click', function () {
        document.querySelectorAll('[data-pf-color]').forEach(function (item) {
          item.setAttribute('aria-pressed', String(item === button));
        });
        renderPage();
      });
    });
    document.querySelectorAll('[data-pf-in-stock], [data-pf-sort]').forEach(function (control) {
      control.addEventListener('change', renderPage);
    });
    var reset = document.querySelector('[data-pf-reset]');
    if (reset) reset.addEventListener('click', function () {
      document.querySelectorAll('[data-pf-color]').forEach(function (item) {
        item.setAttribute('aria-pressed', String(!item.dataset.pfColor));
      });
      var stockOnly = document.querySelector('[data-pf-in-stock]');
      if (stockOnly) stockOnly.checked = false;
      renderPage();
    });
  }

  function announceReady() {
    window.dispatchEvent(new CustomEvent('pureform:catalog-ready', {
      detail: {
        catalog: getCatalogSync(),
        listings: getListingsSync(),
        source: state.source
      }
    }));
  }

  async function fetchListings() {
    var supabaseModule;
    var client;
    var result;
    var listings;

    if (!config.url || !config.anonKey) {
      return state.listings;
    }

    supabaseModule = await import(SUPABASE_CDN);
    client = supabaseModule.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
    result = await client
      .from('site_listings')
      .select('id,slug,name,description,price,discount,discount_mode,discount_starts_at,discount_ends_at,inventory_quantity,inventory_status,visible,photo_urls,sort_order,updated_at')
      .in('slug', QUERY_SLUGS)
      .eq('visible', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (result.error) {
      throw result.error;
    }

    listings = normalizeListings(result.data);
    return listings.length ? listings : state.listings;
  }

  var readyPromise = fetchListings()
    .then(function (listings) {
      state.listings = listings;
      state.source = 'supabase';
    })
    .catch(function (error) {
      state.source = 'fallback';
      if (window.console && typeof window.console.warn === 'function') {
        window.console.warn('PureForm catalog is using fallback data because Supabase listings could not be loaded.', error);
      }
    })
    .then(function () {
      state.ready = true;
      renderPage();
      announceReady();
      return getListingsSync();
    });

  window.PureFormCatalog = {
    defaultSlug: DEFAULT_SLUG,
    officialSlugs: OFFICIAL_SLUGS.slice(),
    legacySlugAliases: Object.assign({}, LEGACY_SLUG_ALIASES),
    ready: readyPromise,
    formatAED: formatAED,
    getCatalogSync: getCatalogSync,
    getListingsSync: getListingsSync,
    getProduct: getProduct,
    isDiscountActive: isDiscountActive,
    resolveSlug: canonicalSlug,
    renderPage: renderPage
  };

  setupCollectionControls();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderPage);
  } else {
    renderPage();
  }
})();
