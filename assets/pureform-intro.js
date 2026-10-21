(function () {
  'use strict';
  if (!document.body || !window.matchMedia) return;

  var location = window.location;
  var file = location.pathname.split('/').pop().replace(/\.html$/, '') || 'index';
  var params = new URLSearchParams(location.search);
  var preview = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && params.get('preview') === 'intro';
  var preference;
  var navigation;
  var performance = window.performance;

  if (file !== 'index' ||
      /(?:^|\/)admin(?:\/|$)/i.test(location.pathname) || location.hash || params.has('payment') || params.has('session_id')) return;

  try {
    preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (window.getComputedStyle(document.documentElement).getPropertyValue('--pf-intro-ready').trim() !== '1') return;
    if (!preview && window.sessionStorage.getItem('pureform.intro.v3')) return;
  } catch (_error) { return; }

  if (preference.matches || document.hidden) return;
  if (!preview) {
    // Never cover content that has already appeared or interrupt normal navigation.
    if (performance && performance.getEntriesByType) {
      navigation = performance.getEntriesByType('navigation')[0];
      if (navigation && navigation.type !== 'navigate') return;
      if (performance.getEntriesByType('paint').some(function (entry) { return entry.name === 'first-contentful-paint'; })) return;
    }
    try { if (document.referrer && new URL(document.referrer).origin === location.origin) return; } catch (_error) { return; }
  }

  try { window.sessionStorage.setItem('pureform.intro.v3', '1'); } catch (_error) { return; }

  var screen = document.createElement('div');
  screen.className = 'pf-intro-screen';
  screen.setAttribute('aria-hidden', 'true');
  screen.innerHTML = '<p class="pf-intro-label">PureForm &middot; The daily ritual</p>' +
    '<div class="pf-intro-stage">' +
    '<figure class="pf-intro-shot pf-intro-grey"><img src="assets/lifestyle/grey-vanity-600.webp" alt="" width="600" height="600" loading="eager" decoding="async" fetchpriority="low"><figcaption>Grey &middot; 4-piece set</figcaption></figure>' +
    '<figure class="pf-intro-shot pf-intro-pink"><img src="assets/lifestyle/pink-shower-600.webp" alt="" width="600" height="600" loading="eager" decoding="async" fetchpriority="low"><figcaption>Pink &middot; 4-piece set</figcaption></figure>' +
    '</div><div class="pf-intro-title"><div class="pf-intro-wordmark">PureForm</div>' +
    '<p class="pf-intro-tagline">Soft touch. Deep clean. Every day.</p></div>' +
    '<p class="pf-intro-note">AI-styled product scenes</p>';

  var photos = Array.from(screen.querySelectorAll('img'));
  var timer = window.setTimeout(dismiss, 3800);
  var imageTimer = window.setTimeout(function () {
    if (photos.some(function (photo) { return !photo.complete || !photo.naturalWidth; })) dismiss();
  }, 350);
  var interactions = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focusin'];

  function dismiss() {
    window.clearTimeout(timer);
    window.clearTimeout(imageTimer);
    screen.remove();
    photos.forEach(function (photo) { photo.removeEventListener('error', dismiss); });
    interactions.forEach(function (type) { document.removeEventListener(type, dismiss, true); });
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', dismiss);
    window.removeEventListener('pageswap', dismiss);
    if (preference.removeEventListener) preference.removeEventListener('change', onPreference);
  }
  function onVisibility() { if (document.hidden) dismiss(); }
  function onPreference() { if (preference.matches) dismiss(); }

  screen.addEventListener('animationend', function (event) { if (event.target === screen && event.animationName === 'pf-intro-exit') dismiss(); });
  interactions.forEach(function (type) { document.addEventListener(type, dismiss, { capture: true, passive: true }); });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', dismiss);
  window.addEventListener('pageswap', dismiss);
  if (preference.addEventListener) preference.addEventListener('change', onPreference);
  photos.forEach(function (photo) { photo.addEventListener('error', dismiss, { once: true }); });
  document.body.appendChild(screen);
})();
