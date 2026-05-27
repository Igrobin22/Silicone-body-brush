(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var supportsNativeTransitions = 'startViewTransition' in document;
  var transitionKey = 'pfPageTransition';
  var exitDuration = 170;

  if (supportsNativeTransitions) {
    root.classList.add('pf-native-view-transition');
  }

  root.classList.add('pf-page-fallback');

  function isPlainNavigation(event) {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }

  function getLink(event) {
    if (!event.target || !event.target.closest) {
      return null;
    }

    return event.target.closest('a[href]');
  }

  function canTransition(link, url) {
    if (!link || reduceMotion.matches || link.hasAttribute('download') || link.hasAttribute('data-no-transition')) {
      return false;
    }

    if (link.target && link.target !== '_self') {
      return false;
    }

    if (!/^(https?:|file:)$/.test(url.protocol) || url.origin !== window.location.origin) {
      return false;
    }

    var samePath = url.pathname === window.location.pathname && url.search === window.location.search;
    if (samePath && url.hash) {
      return false;
    }

    return url.href !== window.location.href;
  }

  function markEntering() {
    var shouldAnimate = false;

    try {
      shouldAnimate = window.sessionStorage.getItem(transitionKey) === '1';
      window.sessionStorage.removeItem(transitionKey);
    } catch (error) {
      shouldAnimate = false;
    }

    if (!shouldAnimate || reduceMotion.matches) {
      return;
    }

    root.classList.add('pf-page-entering');

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        root.classList.add('pf-page-ready');
        root.classList.remove('pf-page-entering');
        window.setTimeout(function () {
          root.classList.remove('pf-page-ready');
        }, 280);
      });
    });
  }

  document.addEventListener('click', function (event) {
    var link = getLink(event);
    var url;

    if (event.defaultPrevented || !isPlainNavigation(event) || !link) {
      return;
    }

    try {
      url = new URL(link.href, window.location.href);
    } catch (error) {
      return;
    }

    if (!canTransition(link, url)) {
      return;
    }

    event.preventDefault();

    try {
      window.sessionStorage.setItem(transitionKey, '1');
    } catch (error) {
      // The exit animation still helps if storage is unavailable.
    }

    root.classList.add('pf-page-leaving');
    window.setTimeout(function () {
      window.location.href = url.href;
    }, exitDuration);
  });

  window.addEventListener('pageshow', function () {
    root.classList.remove('pf-page-leaving');
    markEntering();
  });
})();
