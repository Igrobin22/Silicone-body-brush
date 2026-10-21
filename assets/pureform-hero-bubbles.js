(function () {
  'use strict';
  var hero = document.querySelector('.home-hero');
  var toggle = hero && hero.querySelector('.home-hero-motion-toggle');
  if (!toggle || !window.matchMedia || !window.IntersectionObserver) return;

  var preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  var paused = false;
  var visible = false;
  var active = true;

  function sync() {
    hero.setAttribute('data-bubbles-running', String(!preference.matches && !paused && visible && active && !document.hidden));
    hero.setAttribute('data-bubbles-paused', String(paused));
    toggle.hidden = preference.matches;
    var label = paused ? 'Resume bubble animation' : 'Pause bubble animation';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
  }

  function measure() {
    var rect = hero.getBoundingClientRect();
    visible = rect.bottom > 0 && rect.top < window.innerHeight;
    sync();
  }

  try {
    var observer = new window.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.target === hero) visible = entry.isIntersecting; });
      sync();
    });
    observer.observe(hero);
  } catch (_error) { return; }

  toggle.addEventListener('click', function () { paused = !paused; sync(); });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', function () { active = false; sync(); });
  window.addEventListener('pageshow', function () { active = true; measure(); });
  if (preference.addEventListener) preference.addEventListener('change', sync);
  measure();
})();
