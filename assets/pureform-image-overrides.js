(function () {
  'use strict';
  var slots = window.PUREFORM_SITE_IMAGES || [];
  var known = new Set(slots.map(function (slot) { return slot.id; }));
  var overrides = new Map();
  var pending = new WeakMap();
  var config = window.PUREFORM_SUPABASE_CONFIG || {};
  if (!slots.length || !config.url || !config.anonKey) return;

  function safePhotoUrl(value) {
    if (typeof value !== 'string') return '';
    try {
      var url = new URL(value, document.baseURI);
      var local = /^\/?assets\/[a-z0-9_./-]+$/i.test(value) && !value.includes('..');
      if ((local || url.protocol === 'https:') && !url.username && !url.password) return url.href;
    } catch (_error) { /* Retain the original image if a saved link is invalid. */ }
    return '';
  }

  function applyImage(element) {
    var key = element.dataset.pfImage;
    var url = overrides.get(key);
    var attribute = element.localName === 'source' ? 'srcset' : element.localName === 'image' ? 'href' : 'src';
    var previous = pending.get(element);
    if (!url || element.getAttribute(attribute) === url || (previous && previous.key === key && previous.url === url && !previous.applied)) return;
    var request = { key: key, url: url, applied: false };
    pending.set(element, request);
    // Decode before swapping so an unavailable replacement keeps the current image.
    var probe = new Image();
    probe.onload = function () {
      if (pending.get(element) !== request || !element.isConnected || element.dataset.pfImage !== key) return;
      request.applied = true;
      if (element.localName === 'img') {
        element.removeAttribute('srcset');
        element.dataset.pfFallback = element.src;
        delete element.dataset.pfFallbackApplied;
      }
      element.setAttribute(attribute, url);
      if (key === 'hero-background') {
        var scene = element.closest('.home-hero-scene');
        if (scene) scene.style.setProperty('--studio-background', 'url(' + JSON.stringify(url) + ')');
      }
    };
    probe.onerror = function () { if (pending.get(element) === request) pending.delete(element); };
    probe.src = url;
  }

  function applyWithin(root) {
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.matches && root.matches('[data-pf-image]')) applyImage(root);
    root.querySelectorAll('[data-pf-image]').forEach(applyImage);
  }

  var endpoint = new URL('/rest/v1/site_content_blocks', config.url);
  endpoint.searchParams.set('select', 'key,value');
  endpoint.searchParams.set('key', 'like.image.*');
  fetch(endpoint.href, {
    headers: { apikey: config.anonKey, Authorization: 'Bearer ' + config.anonKey },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000)
  }).then(function (response) {
    if (!response.ok) throw new Error('Image settings unavailable');
    return response.json();
  }).then(function (rows) {
    if (!Array.isArray(rows)) return;
    rows.forEach(function (row) {
      var key = String(row.key).slice(6);
      var url = safePhotoUrl(row.value);
      if (known.has(key) && url) overrides.set(key, url);
    });
    if (!overrides.size) return;
    applyWithin(document);
    var observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        if (record.type === 'attributes') applyImage(record.target);
        else record.addedNodes.forEach(applyWithin);
      });
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-pf-image'] });
  }).catch(function () { /* Saved image settings are optional; keep the page's original photos. */ });
})();
