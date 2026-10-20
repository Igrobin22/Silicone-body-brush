(function () {
  'use strict';
  var catalog = window.PureFormCatalog;
  var cart = window.PureFormCart;
  var config = window.PUREFORM_SUPABASE_CONFIG || {};
  var roots = Array.from(document.querySelectorAll('[data-pf-combo]'));
  if (!catalog || !cart || !roots.length || !config.url || !config.anonKey) return;

  function createCombo(root, index) {
    root.innerHTML = '<div class="pf-combo-copy"><p class="pf-combo-kicker">1 + 1 COMBO</p><h2>Any two sets. Delivery on us.</h2><p>Buy 2 sets and save AED 10 on UAE delivery.</p></div>' +
      '<div class="pf-combo-pair"><div class="pf-combo-choice"><img width="120" height="120" loading="lazy" alt=""><label>First set<select aria-label="First set"></select></label><span class="pf-combo-unit-price"></span></div><span class="pf-combo-plus" aria-hidden="true">+</span><div class="pf-combo-choice"><img width="120" height="120" loading="lazy" alt=""><label>Second set<select aria-label="Second set"></select></label><span class="pf-combo-unit-price"></span></div></div>' +
      '<div class="pf-combo-action"><strong class="pf-combo-total"></strong><span>2 sets + free UAE delivery</span><button type="button" class="btn-p">Add both to cart</button><p class="pf-combo-status" role="status"></p></div>';
    var selects = Array.from(root.querySelectorAll('select'));
    var photos = Array.from(root.querySelectorAll('img'));
    var unitPrices = Array.from(root.querySelectorAll('.pf-combo-unit-price'));
    var button = root.querySelector('button');
    var total = root.querySelector('.pf-combo-total');
    var status = root.querySelector('.pf-combo-status');
    var ids = catalog.getListingsSync().map(function (item) { return item.id; });
    if (!ids.length) return;
    var current = new URLSearchParams(window.location.search).get('product');
    current = catalog.resolveSlug(current);
    selects.forEach(function (select, slot) {
      select.id = 'combo-' + index + '-' + slot;
      select.parentElement.setAttribute('for', select.id);
      ids.forEach(function (id) {
        var option = document.createElement('option');
        option.value = id;
        select.appendChild(option);
      });
      select.value = slot === 0 && ids.includes(current) ? current : ids[slot === 0 ? 0 : ids.length - 1];
      select.addEventListener('change', update);
    });

    function update() {
      var products = catalog.getCatalogSync();
      var needed = {};
      var amount = 0;
      var available = catalog.isFresh();
      selects.forEach(function (select, slot) {
        Array.from(select.options).forEach(function (option) {
          var product = products[option.value];
          option.textContent = product ? product.color : 'Unavailable';
          option.disabled = !product || product.inventory_quantity < 1 || product.inventory_status === 'out_of_stock';
        });
        var product = products[select.value];
        if (!product) { available = false; return; }
        if (photos[slot].getAttribute('src') !== product.image) photos[slot].src = product.image;
        photos[slot].alt = product.name;
        unitPrices[slot].textContent = product.priceText;
        amount += product.price;
        needed[product.id] = (needed[product.id] || 0) + 1;
      });
      Object.keys(needed).forEach(function (id) {
        var saved = cart.getCart().find(function (item) { return item.id === id; });
        var desired = needed[id] + (saved ? saved.quantity : 0);
        if (products[id].inventory_status === 'out_of_stock' || desired > Math.min(20, products[id].inventory_quantity)) available = false;
      });
      total.textContent = cart.formatAED(amount);
      button.disabled = !available;
      status.textContent = available ? '' : 'Choose a combination with enough stock available.';
    }
    button.addEventListener('click', function () {
      if (!cart.addItems(selects.map(function (select) { return { id: select.value, quantity: 1 }; }))) {
        update();
        status.textContent = 'Stock changed. Choose another combination.';
        return;
      }
      window.location.assign('cart.html');
    });
    window.addEventListener('pureform:catalog-ready', update);
    window.addEventListener('pureform:catalog-refresh', update);
    window.addEventListener('pureform:cart-change', update);
    update();
    root.hidden = false;
  }

  Promise.all([catalog.ready, fetch(String(config.url).replace(/\/+$/, '') + '/functions/v1/checkout-status', {
    headers: { Authorization: 'Bearer ' + config.anonKey, apikey: config.anonKey }, signal: AbortSignal.timeout(15000)
  }).then(function (response) { if (!response.ok) throw new Error('Offer unavailable'); return response.json(); })])
    .then(function (results) {
      var setup = results[1];
      if (!setup.configured || setup.currency !== 'AED' || setup.shipping_total !== 10 || setup.free_shipping_min_sets !== 2) return;
      roots.forEach(createCombo);
    }).catch(function () { /* Do not advertise an offer the deployed checkout cannot honor. */ });
})();
