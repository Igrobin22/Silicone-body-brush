(function () {
  'use strict';
  var root = document.getElementById('cartDeliveryOffer');
  var cart = window.PureFormCart;
  var catalog = window.PureFormCatalog;
  var config = window.PUREFORM_SUPABASE_CONFIG || {};
  if (!root || !cart || !catalog || !config.url || !config.anonKey) return;

  var title = document.getElementById('cartDeliveryTitle');
  var message = document.getElementById('cartDeliveryMessage');
  var progress = document.getElementById('cartDeliveryProgress');
  var choices = document.getElementById('cartDeliveryChoices');
  var options = document.getElementById('cartDeliveryOptions');
  var preview = document.getElementById('cartDeliveryPreview');
  var button = document.getElementById('cartDeliveryAdd');
  var status = document.getElementById('cartDeliveryStatus');
  var enabled = false;
  var selected = '';
  var previousCount = null;
  var controls = [];

  ['grey', 'black', 'pink'].forEach(function (color) {
    var id = 'pureform-4pc-set-' + color;
    var label = document.createElement('label');
    var radio = document.createElement('input');
    var image = document.createElement('img');
    var text = document.createElement('span');
    var name = document.createElement('strong');
    var price = document.createElement('span');
    radio.type = 'radio';
    radio.name = 'second-set';
    radio.value = id;
    radio.addEventListener('change', function () {
      selected = id;
      status.textContent = '';
      render();
    });
    image.alt = '';
    image.width = 72;
    image.height = 72;
    image.loading = 'lazy';
    image.decoding = 'async';
    text.appendChild(name);
    text.appendChild(price);
    label.appendChild(radio);
    label.appendChild(image);
    label.appendChild(text);
    options.appendChild(label);
    controls.push({ id: id, label: label, radio: radio, image: image, name: name, price: price });
  });

  function canAdd(product) {
    if (!product || product.visible === false || product.inventory_status === 'out_of_stock' || !Number.isFinite(product.price) || product.price < 0) return false;
    var saved = cart.getCart().find(function (item) { return item.id === product.id; });
    return (saved ? saved.quantity : 0) + 1 <= Math.min(20, Number(product.inventory_quantity) || 0);
  }

  function render() {
    var items = cart.getLineItems();
    var count = cart.getCount();
    var ready = enabled && catalog.isFresh() && count > 0;
    var valid = items.every(function (item) {
      return item.inventoryStatus !== 'out_of_stock' && (item.inventoryQuantity === null || item.quantity <= item.inventoryQuantity);
    });
    var products = catalog.getCatalogSync();
    var available = controls.filter(function (control) { return canAdd(products[control.id]); });
    var activeControl = controls.find(function (control) { return control.radio === document.activeElement; });
    var keepFocus = choices.contains(document.activeElement) && (!ready || !valid || count >= 2 || !available.length);
    if (count !== previousCount) status.textContent = '';
    previousCount = count;
    root.hidden = !ready;
    if (!ready) {
      if (keepFocus) {
        var fallback = document.querySelector('[data-cart-quantity]') || document.getElementById('cartCheckoutLink');
        if (fallback) fallback.focus({ preventScroll: true });
      }
      return;
    }

    title.textContent = !valid ? 'Check availability before checkout' : count >= 2 ? 'Free UAE delivery unlocked' : 'One more set. Free UAE delivery.';
    message.textContent = !valid ? 'A set in your cart is unavailable at this quantity. Review your items above.'
      : count >= 2 ? 'Your ' + count + ' sets qualify. AED 10 delivery is waived automatically.'
      : '1 of 2 sets in your cart. Add any second set to save AED 10 on delivery.';
    progress.value = Math.min(count, 2);
    progress.hidden = !valid;
    progress.setAttribute('aria-valuetext', Math.min(count, 2) + ' of 2 sets; ' + (count >= 2 ? 'free delivery' : 'one more set qualifies'));
    choices.hidden = !valid || count >= 2 || !available.length;
    if (keepFocus && !root.hidden) title.focus({ preventScroll: true });
    if (choices.hidden) return;

    if (!available.some(function (control) { return control.id === selected; })) {
      var alternative = available.find(function (control) { return !items.some(function (item) { return item.id === control.id; }); });
      selected = (alternative || available[0]).id;
    }
    controls.forEach(function (control) {
      var product = products[control.id];
      control.label.hidden = !canAdd(product);
      control.radio.disabled = control.label.hidden;
      control.radio.checked = control.id === selected;
      if (!product) return;
      control.name.textContent = product.color + ' set';
      control.price.textContent = '+ ' + cart.formatAED(product.price);
      if (control.image.getAttribute('src') !== product.image) control.image.src = product.image;
    });
    var product = products[selected];
    preview.textContent = 'New order total: ' + cart.formatAED(cart.getSubtotal() + product.price) + ' with free UAE delivery.';
    button.textContent = 'Add ' + product.color + ' set';
    if (activeControl && activeControl.label.hidden) {
      controls.find(function (control) { return control.id === selected; }).radio.focus({ preventScroll: true });
      status.textContent = 'That color is no longer available. ' + product.color + ' is selected; review the updated total.';
    }
  }

  button.addEventListener('click', function () {
    var product = catalog.getCatalogSync()[selected];
    if (!enabled || !catalog.isFresh() || cart.getCount() !== 1 || !canAdd(product) || !cart.addItems([{ id: selected, quantity: 1 }])) {
      render();
      status.textContent = 'Availability changed. Review your cart and choose an available set.';
      return;
    }
    status.textContent = product.color + ' set added. Delivery is now free.';
  });
  window.addEventListener('pureform:cart-change', render);
  window.addEventListener('pureform:catalog-ready', render);
  window.addEventListener('pureform:catalog-refresh', render);
  window.addEventListener('pageshow', render);

  Promise.all([catalog.ready, fetch(String(config.url).replace(/\/+$/, '') + '/functions/v1/checkout-status', {
    headers: { Authorization: 'Bearer ' + config.anonKey, apikey: config.anonKey }, signal: AbortSignal.timeout(15000)
  }).then(function (response) {
    if (!response.ok) throw new Error('Delivery offer unavailable');
    return response.json();
  })]).then(function (results) {
    var setup = results[1];
    enabled = setup.configured === true && setup.currency === 'AED' && setup.shipping_total === 10 && setup.free_shipping_min_sets === 2;
    render();
  }).catch(function () { root.hidden = true; });
})();
