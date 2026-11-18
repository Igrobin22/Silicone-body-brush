(function () {
  'use strict';
  var settings = {
    duration: 1.2,
    easing: function (progress) { return 1 - Math.pow(1 - progress, 3); }
  };
  var root = document.documentElement;
  var preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  var libraryUrl = new URL('vendor/lenis/lenis-1.3.26.min.js', document.currentScript.src);
  var libraryPromise;
  var scroll;
  var active = true;
  if (document.body.classList.contains('admin-page')) return;

  function loadLibrary() {
    if (window.Lenis) return Promise.resolve();
    if (!libraryPromise) {
      libraryPromise = new Promise(function (resolve) {
        var script = document.createElement('script');
        script.src = libraryUrl.href;
        script.onload = resolve;
        script.onerror = resolve;
        document.head.appendChild(script);
      });
    }
    return libraryPromise;
  }

  function cancelInertia() {
    if (scroll && scroll.isScrolling) {
      scroll.scrollTo(scroll.actualScroll, { immediate: true, force: true });
    }
  }

  function destroy() {
    if (scroll) scroll.destroy();
    scroll = null;
  }

  async function refresh() {
    if (!active || preference.matches) {
      destroy();
      return;
    }
    if (!scroll) {
      if (root.classList.contains('pf-intro-active')) return;
      await loadLibrary();
      if (!active || preference.matches || !window.Lenis) return;
      if (!scroll) {
        scroll = new window.Lenis({
          duration: settings.duration,
          easing: settings.easing,
          autoRaf: true,
          smoothWheel: true,
          syncTouch: false,
          allowNestedScroll: true,
          anchors: false,
          stopInertiaOnNavigate: true,
          prevent: function (node) {
            return node.matches && node.matches('input, textarea, select, [contenteditable="true"], dialog, .pf-mobile-sidebar');
          }
        });
      }
    }
    var locked = root.classList.contains('pf-intro-active') ||
      document.body.classList.contains('pf-mobile-menu-lock') ||
      Boolean(document.querySelector('dialog[open]'));
    if (locked && !scroll.isStopped) scroll.stop();
    if (!locked && scroll.isStopped) scroll.start();
  }

  var observer = new MutationObserver(refresh);
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('toggle', refresh, true);
  document.addEventListener('focusin', cancelInertia);
  document.addEventListener('keydown', function (event) {
    if (['Tab', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) cancelInertia();
  });
  window.addEventListener('hashchange', cancelInertia);
  window.addEventListener('pagehide', function () { active = false; destroy(); });
  window.addEventListener('pageshow', function () { active = true; refresh(); });
  preference.addEventListener('change', refresh);
  refresh();
})();
