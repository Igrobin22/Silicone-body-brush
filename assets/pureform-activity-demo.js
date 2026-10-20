(function () {
  'use strict';
  var location = window.location;
  if (!location || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) ||
      new URLSearchParams(location.search).get('demo') !== 'activity' ||
      !['/', '/index.html', '/products.html', '/pureform-product-detail.html'].includes(location.pathname)) return;

  var storageKey = 'pureform.activity-demo.v1';
  var samples = {
    'pureform-4pc-set-grey': { viewing: 7, sold: 128, week: 12, stock: 8, pace: 1 },
    'pureform-4pc-set-black': { viewing: 5, sold: 94, week: 9, stock: 6, pace: 2 },
    'pureform-4pc-set-pink': { viewing: 9, sold: 156, week: 16, stock: 5, pace: 3 }
  };
  var state;
  var pauseButton;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  function readState(now) {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && Number.isSafeInteger(saved.startedAt) && saved.startedAt > 0 && saved.startedAt <= now &&
          (saved.pausedAt === null || (Number.isSafeInteger(saved.pausedAt) && saved.pausedAt >= saved.startedAt && saved.pausedAt <= now))) return saved;
    } catch (_error) { /* The preview still works without browser storage. */ }
    return { startedAt: now, pausedAt: reducedMotion && reducedMotion.matches ? now : null };
  }

  function saveState() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (_error) { /* Keep the current preview in memory. */ }
  }

  function sampleFor(id, now) {
    var sample = samples[id];
    if (!sample) return null;
    var elapsed = Math.max(0, (state.pausedAt === null ? now : state.pausedAt) - state.startedAt);
    var step = Math.floor(elapsed / 45000);
    var units = Math.min(sample.stock - 2, Math.floor(step / sample.pace));
    return {
      viewing: sample.viewing + [0, 1, 0, -1][step % 4],
      sold: sample.sold + units, week: sample.week + units, stock: sample.stock - units
    };
  }

  function togglePause() {
    var now = Date.now();
    if (state.pausedAt === null) state.pausedAt = now;
    else { state.startedAt += now - state.pausedAt; state.pausedAt = null; }
    saveState();
    render();
  }

  function render() {
    if (document.visibilityState === 'hidden') return;
    document.querySelectorAll('[data-pf-live-status]').forEach(function (actual) {
      var id = actual.getAttribute('data-pf-live-status');
      var sample = sampleFor(id, Date.now());
      if (!sample) return;
      var demo = actual.nextElementSibling;
      if (!demo || !demo.classList.contains('pf-demo-activity')) {
        demo = document.createElement('p');
        demo.className = 'pf-demo-activity';
        demo.innerHTML = '<strong>Demo data</strong><span></span><span></span>';
        actual.insertAdjacentElement('afterend', demo);
      }
      var lines = demo.querySelectorAll('span');
      lines[0].textContent = sample.viewing + ' viewing / ' + sample.sold + ' sold';
      lines[1].textContent = sample.week + ' this week / ' + sample.stock + ' sample stock';
    });
    if (pauseButton) pauseButton.textContent = state.pausedAt === null ? 'Pause demo' : 'Resume demo';
    document.querySelectorAll('a[href]').forEach(function (link) {
      if (link.hasAttribute('data-pf-demo-exit')) return;
      var url = new URL(link.getAttribute('href'), location.href);
      if (url.origin !== location.origin || !['/', '/index.html', '/products.html', '/pureform-product-detail.html'].includes(url.pathname)) return;
      url.searchParams.set('demo', 'activity');
      if (link.href !== url.href) link.href = url.href;
    });
  }

  function start() {
    var anchor = document.querySelector('#productSalesStatus, .collection-toolbar, [data-pf-catalog-grid="home"]');
    if (!anchor) return;
    state = readState(Date.now());
    if (reducedMotion && reducedMotion.matches && state.pausedAt === null) state.pausedAt = Date.now();
    saveState();
    var notice = document.createElement('aside');
    notice.className = 'pf-demo-notice';
    notice.setAttribute('aria-label', 'Demo activity preview');
    notice.innerHTML = '<div><strong>Demo data</strong><p>Sample activity, not real shoppers or sales.</p></div><div class="pf-demo-controls"><button type="button">Pause demo</button><button type="button">Reset demo</button><a data-pf-demo-exit>Exit demo</a></div>';
    anchor.insertAdjacentElement('beforebegin', notice);
    pauseButton = notice.querySelector('button');
    pauseButton.addEventListener('click', togglePause);
    notice.querySelectorAll('button')[1].addEventListener('click', function () {
      var now = Date.now();
      state = { startedAt: now, pausedAt: reducedMotion && reducedMotion.matches ? now : null };
      saveState();
      render();
    });
    var exit = new URL(location.href);
    exit.searchParams.delete('demo');
    notice.querySelector('a').href = exit.href;
    window.addEventListener('pureform:catalog-ready', render);
    window.addEventListener('pureform:catalog-refresh', render);
    document.addEventListener('visibilitychange', render);
    document.addEventListener('click', function (event) { if (event.target.closest('[data-pf-color], [data-pf-reset]')) render(); });
    document.addEventListener('change', function (event) { if (event.target.matches('[data-pf-sort], [data-pf-in-stock]')) render(); });
    if (reducedMotion && reducedMotion.addEventListener) reducedMotion.addEventListener('change', function (event) {
      if (event.matches && state.pausedAt === null) togglePause();
    });
    window.setInterval(function () { if (state.pausedAt === null) render(); }, 5000);
    render();
    if (window.PureFormCatalog && window.PureFormCatalog.ready) window.PureFormCatalog.ready.then(render);
  }

  start();
})();
