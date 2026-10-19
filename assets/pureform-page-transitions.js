(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var nativeTransitions = 'onpagereveal' in window && /^https?:$/.test(window.location.protocol);

  function syncMotion() {
    root.classList.toggle('pf-page-fallback', !nativeTransitions && !reduceMotion.matches);
  }

  // Keep navigation, history, checkout redirects and link modifiers browser-owned.
  window.addEventListener('pageswap', function (event) {
    if (!event.viewTransition) return;
    if (reduceMotion.matches) {
      event.viewTransition.skipTransition();
      return;
    }
    root.classList.add('pf-page-swapping');
  });

  window.addEventListener('pagereveal', function (event) {
    if (!event.viewTransition || reduceMotion.matches) return;
    // Prepare the incoming snapshot; section keyframes still run once per node.
    Array.prototype.forEach.call(document.querySelectorAll('[data-flow-reveal]'), function (item) {
      var bounds = item.getBoundingClientRect();
      if (bounds.bottom > 0 && bounds.top < window.innerHeight) {
        item.classList.add('is-visible', 'pf-page-visible');
      }
    });
  });

  window.addEventListener('pageshow', function () {
    root.classList.remove('pf-page-swapping');
    syncMotion();
  });

  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', syncMotion);
  syncMotion();
})();
