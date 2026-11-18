(function () {
  'use strict';
  var root = document.querySelector('[data-floating-scene]');
  if (!root) return;
  var stage = root.querySelector('[data-float-stage]');
  var buttons = Array.from(root.querySelectorAll('[data-float-color]'));
  var parts = Array.from(root.querySelectorAll('[data-float-part]'));
  var options = root.querySelector('.float-color-options');
  var colorName = root.querySelector('[data-float-color-name]');
  var status = root.querySelector('[data-float-status]');
  var motion = root.querySelector('[data-float-motion]');
  var motionLabel = root.querySelector('[data-float-motion-label]');
  var preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  var colors = { grey: 'Grey', black: 'Black', pink: 'Pink' };
  var assets = Object.create(null);
  var revision = 0;
  var level = 1;
  var cleanup;
  var visible = false;
  var paused = false;
  var observer;
  var introHolding = root.id === 'hero' && document.documentElement.classList.contains('pf-intro-active');

  function setupBackgroundFallback() {
    var background = root.querySelector('[data-float-background-fallback]');
    if (!background) return;
    var attempted = false;
    var picture = background.closest('picture');
    function loaded() {
      if (!background.naturalWidth) return;
      background.removeAttribute('data-float-background-failed');
      // Retain the last decoded scenery underneath responsive source changes.
      // The resource is already cached; it adds no second image download.
      if (picture) picture.style.backgroundImage = 'url(' + JSON.stringify(background.currentSrc || background.src) + ')';
    }
    background.addEventListener('load', loaded);
    function failed() {
      // Hide the broken-image icon without changing the fixed scene geometry.
      background.setAttribute('data-float-background-failed', 'true');
      if (attempted) return;
      attempted = true;
      var fallback = background.getAttribute('data-float-background-fallback');
      if (picture) picture.querySelectorAll('source').forEach(function (source) { source.srcset = fallback; });
      background.srcset = '';
      background.src = fallback;
    }
    background.addEventListener('error', failed);
    if (background.complete) {
      if (background.naturalWidth) loaded();
      else failed();
    }
  }

  setupBackgroundFallback();

  function announce(message, error) {
    status.textContent = message;
    status.dataset.error = error ? 'true' : 'false';
  }

  function loadImage(image) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () { finish(new Error('Image timed out')); }, 15000);
      function finish(error) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        image.onload = image.onerror = null;
        if (error) reject(error);
        else resolve();
      }
      function done() {
        if (!image.naturalWidth) { finish(new Error('Image unavailable')); return; }
        if (image.decode) image.decode().then(function () { finish(); }, finish);
        else finish();
      }
      image.onload = done;
      image.onerror = function () { finish(new Error('Image unavailable')); };
      if (image.complete) done();
    });
  }

  function prepareColor(color) {
    if (assets[color]) return assets[color];
    var images = parts.map(function (part) {
      var existing = part.querySelector('[data-color-layer="' + color + '"]');
      if (existing) return existing;
      var base = part.querySelector('img');
      var image = new Image();
      image.alt = '';
      image.className = 'float-color-layer';
      image.dataset.colorLayer = color;
      image.dataset.pfImage = 'hero-' + color + '-' + part.dataset.floatPart;
      image.width = Number(base.getAttribute('width'));
      image.height = Number(base.getAttribute('height'));
      image.decoding = 'async';
      image.src = 'assets/floating-scene/' + color + '-' + part.dataset.floatPart + '.webp';
      part.appendChild(image);
      return image;
    });
    assets[color] = Promise.all(images.map(loadImage)).then(function () {
      // Give newly inserted transparent layers a painted starting state even
      // when their files came from memory cache, so the dissolve stays smooth.
      return new Promise(function (resolve) {
        requestAnimationFrame(function () { requestAnimationFrame(function () { resolve(images); }); });
      });
    })
      .catch(function (error) {
        delete assets[color];
        if (color !== 'grey') images.forEach(function (image) { image.remove(); });
        throw error;
      });
    return assets[color];
  }

  function applyColor(color, images, instant) {
    clearTimeout(cleanup);
    level += 1;
    images.forEach(function (image) {
      image.style.zIndex = String(level);
      image.classList.add('is-visible');
    });
    root.dataset.color = color;
    colorName.textContent = colors[color];
    root.dispatchEvent(new CustomEvent('pureform:scene-color-change', { bubbles: true, detail: { color: color } }));
    stage.setAttribute('aria-label', colors[color] + ' four-piece shower set floating above a stone pedestal, framed by gently swaying leaves');
    buttons.forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.floatColor === color)); });
    options.setAttribute('aria-busy', 'false');
    announce(instant ? '' : colors[color] + ' selected.');
    function clearPreviousColor() {
      parts.forEach(function (part) {
        part.querySelectorAll('[data-color-layer]').forEach(function (image) {
          if (image.dataset.colorLayer !== color) image.classList.remove('is-visible');
        });
      });
    }
    if (instant) clearPreviousColor();
    else cleanup = setTimeout(clearPreviousColor, preference.matches ? 0 : 460);
  }

  function switchColor(color) {
    if (!Object.prototype.hasOwnProperty.call(colors, color)) return;
    var current = ++revision;
    if (color === root.dataset.color) {
      options.setAttribute('aria-busy', 'false');
      announce('');
      return;
    }
    options.setAttribute('aria-busy', 'true');
    announce('Loading ' + colors[color] + '…');
    prepareColor(color).then(function (images) {
      if (current !== revision) return;
      // Leave the previous colour opaque under the incoming one: no blank flash.
      applyColor(color, images, false);
    }).catch(function () {
      if (current !== revision) return;
      options.setAttribute('aria-busy', 'false');
      announce('This color could not load. Your current scene is still here. Choose the color to retry.', true);
    });
  }

  function updateMotion() {
    root.dataset.motion = !introHolding && !preference.matches && !paused && visible && !document.hidden ? 'running' : 'paused';
    motion.disabled = preference.matches;
    motion.setAttribute('aria-pressed', String(paused));
    motionLabel.textContent = preference.matches ? 'Motion reduced' : paused ? 'Resume motion' : 'Pause motion';
  }

  if (introHolding) {
    root.pureformIntro = {
      prepareColor: prepareColor,
      showColor: function (color, images) { applyColor(color, images, true); }
    };
    document.addEventListener('pureform:intro-end', function () {
      delete root.pureformIntro;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { introHolding = false; updateMotion(); });
      });
    }, { once: true });
  }

  buttons.forEach(function (button) {
    button.disabled = false;
    button.addEventListener('click', function () { switchColor(button.dataset.floatColor); });
  });
  options.addEventListener('keydown', function (event) {
    var index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    var next;
    if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
    else if (event.key === 'ArrowLeft') next = (index + buttons.length - 1) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[next].focus();
    buttons[next].click();
  });
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(function (entries) {
      visible = entries.some(function (entry) { return entry.isIntersecting; });
      updateMotion();
    }, { threshold: 0 });
    observer.observe(stage);
    motion.hidden = false;
    motion.addEventListener('click', function () { paused = !paused; updateMotion(); });
  }
  preference.addEventListener('change', updateMotion);
  document.addEventListener('visibilitychange', updateMotion);
  window.addEventListener('pagehide', function () { visible = false; updateMotion(); });
  window.addEventListener('pageshow', function () {
    if (observer) { observer.unobserve(stage); observer.observe(stage); }
  });
  updateMotion();
}());
