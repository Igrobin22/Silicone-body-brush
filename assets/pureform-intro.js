(function () {
  'use strict';

  const INTRO = {
    loadTimeout: 2500,
    whiteStart: 100,
    flightDuration: 1720,
    stagger: 90,
    enterFade: 200,
    revealAt: 820,
    backdropFade: 900,
    revealOffset: 280,
    revealStagger: 60,
    revealDuration: 420,
    safetyBuffer: 500,
    flightSamples: 96,
    curveSamples: 160,
    edgeInset: 20,
    fadeEase: 'ease-in-out',
    travelEase: 'cubic-bezier(0.22, 1, 0.36, 1)',
    horizontalDrift: [.18, 240],
    verticalDrift: [.22, 190],
    // All tools rise into the set, on separate non-crossing arcs.
    // Offset, two control-point proportions, and a small starting tilt.
    paths: {
      back: { offset: [-.40, 1], first: [.82, .62], second: [.18, .08], tilt: -5 },
      body: { offset: [-.72, .76], first: [.64, .92], second: [.08, .20], tilt: -7 },
      scalp: { offset: [.52, .82], first: [.86, .64], second: [.20, .08], tilt: 6 },
      face: { offset: [.80, 1], first: [.68, .90], second: [.08, .18], tilt: 7 }
    },
    order: ['back', 'body', 'scalp', 'face'],
    color: 'grey',
    graphics: {
      start: 80,
      stagger: 30,
      fadeIn: 250,
      fadeOutAt: 1060,
      fadeOut: 480,
      driftDuration: 1700,
      ease: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
      palette: { line: '#cbd6cf', faint: '#e0e7e2', fill: '#edf3ef', dot: '#91a69a' },
      tracks: [
        ['orbit-wide', 'rotate(-21deg) scale(.86)', 'rotate(-12deg) scale(1.03)'],
        ['orbit-inner', 'rotate(12deg) scale(.91)', 'rotate(3deg) scale(1.04)'],
        ['disc-left', 'translate3d(-26px,20px,0) scale(.85)', 'translate3d(12px,-12px,0) scale(1)'],
        ['disc-right', 'translate3d(16px,22px,0) scale(.8)', 'translate3d(-14px,-10px,0) scale(1)'],
        ['wave-left', 'translate3d(-26px,22px,0) rotate(-7deg)', 'translate3d(10px,-8px,0) rotate(0deg)'],
        ['wave-right', 'translate3d(28px,18px,0) rotate(7deg)', 'translate3d(-12px,-8px,0) rotate(0deg)'],
        ['node-one', 'translate3d(-24px,12px,0) scale(.5)', 'translate3d(38px,-16px,0) scale(1)'],
        ['node-two', 'translate3d(20px,18px,0) scale(.6)', 'translate3d(-28px,-18px,0) scale(1)'],
        ['node-three', 'translate3d(-18px,14px,0) scale(.6)', 'translate3d(24px,-12px,0) scale(1)']
      ]
    }
  };

  const html = document.documentElement;
  if (!html.classList.contains('pf-intro-active')) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const duration = INTRO.whiteStart + INTRO.flightDuration + (INTRO.order.length - 1) * INTRO.stagger;
  const animations = [];
  const temporarilyInert = [];
  let overlay, stage, backdrop, graphics, skipButton, scene, hero, artwork, resizeFrame, safetyTimer;
  let finished = false;
  let skipRequested = false;
  let colorSelected = false;
  const loadTimer = setTimeout(finish, INTRO.loadTimeout);

  function selectColor() {
    if (!artwork || colorSelected) return;
    scene.showColor(INTRO.color, artwork);
    colorSelected = true;
  }

  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(loadTimer);
    clearTimeout(safetyTimer);
    cancelAnimationFrame(resizeFrame);
    window.removeEventListener('resize', onResize);
    window.visualViewport?.removeEventListener('resize', onResize);
    window.removeEventListener('pagehide', finish);
    window.removeEventListener('pagereveal', onPageReveal);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('keydown', onKeydown);
    reduced.removeEventListener('change', onPreference);

    const restoreFocus = skipButton && document.activeElement === skipButton;
    // Reveal the real artwork, remove the composited layers, and unlock in one task.
    html.classList.remove('pf-intro-active', 'pf-intro-mounted');
    overlay?.remove();
    animations.forEach(animation => animation.cancel());
    temporarilyInert.forEach(element => { element.inert = false; });
    document.dispatchEvent(new Event('pureform:intro-end'));
    if (restoreFocus) hero?.querySelector('[data-pf-home-order]')?.focus({ preventScroll: true });
  }

  function skip() {
    skipRequested = true;
    if (!artwork) return; // Wait only within the existing asset timeout.
    selectColor();
    finish();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      skip();
    }
  }

  function onVisibility() { if (document.hidden) finish(); }
  function onPreference() { if (reduced.matches) finish(); }
  function onPageReveal(event) { event.viewTransition?.skipTransition(); }

  function animate(element, frames, timing) {
    const animation = element.animate(frames, { fill: 'both', ...timing });
    animations.push(animation);
    return animation;
  }

  function mountOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'pf-intro-overlay';
    stage = document.createElement('div');
    stage.className = 'pf-intro-stage';
    stage.setAttribute('aria-hidden', 'true');
    backdrop = document.createElement('div');
    backdrop.className = 'pf-intro-backdrop';
    graphics = document.createElement('div');
    graphics.className = 'pf-intro-graphics';
    Object.entries(INTRO.graphics.palette).forEach(([name, color]) => {
      graphics.style.setProperty('--intro-' + name, color);
    });
    graphics.innerHTML = '<div class="pf-intro-orbit pf-intro-orbit-wide" data-intro-graphic="orbit-wide"></div>' +
      '<div class="pf-intro-orbit pf-intro-orbit-inner" data-intro-graphic="orbit-inner"></div>' +
      '<div class="pf-intro-disc pf-intro-disc-left" data-intro-graphic="disc-left"></div>' +
      '<div class="pf-intro-disc pf-intro-disc-right" data-intro-graphic="disc-right"></div>' +
      '<svg class="pf-intro-wave pf-intro-wave-left" data-intro-graphic="wave-left" viewBox="0 0 480 240" fill="none" aria-hidden="true" focusable="false">' +
      '<path d="M-35 208C76-22 302-16 500 148M-32 231C92 6 315 12 500 170M-24 252C108 36 326 40 500 192"/></svg>' +
      '<svg class="pf-intro-wave pf-intro-wave-right" data-intro-graphic="wave-right" viewBox="0 0 480 240" fill="none" aria-hidden="true" focusable="false">' +
      '<path d="M-20 44C142 222 355 251 510 18M-20 68C145 245 366 271 515 42M-20 92C150 268 376 292 520 66"/></svg>' +
      '<i class="pf-intro-node pf-intro-node-one" data-intro-graphic="node-one"></i>' +
      '<i class="pf-intro-node pf-intro-node-two" data-intro-graphic="node-two"></i>' +
      '<i class="pf-intro-node pf-intro-node-three" data-intro-graphic="node-three"></i>';
    stage.append(backdrop, graphics);
    skipButton = document.createElement('button');
    skipButton.className = 'pf-intro-skip';
    skipButton.type = 'button';
    skipButton.textContent = 'Skip';
    skipButton.setAttribute('aria-label', 'Skip intro');
    skipButton.addEventListener('click', skip);
    overlay.append(stage, skipButton);

    document.querySelectorAll('body > :is(.skip-link, .site-header, main, footer)').forEach(element => {
      if (element.inert) return;
      element.inert = true;
      temporarilyInert.push(element);
    });
    document.body.append(overlay);
    html.classList.add('pf-intro-mounted');
    window.scrollTo(0, 0);
  }

  async function loadLayer(part, images) {
    const original = images.find(image => image.parentElement === part);
    const image = new Image();
    image.alt = '';
    image.src = original.currentSrc || original.src;
    await image.decode();
    image.className = 'pf-intro-layer';
    return image;
  }

  function measure(part) {
    const rect = part.getBoundingClientRect();
    const style = getComputedStyle(part);
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      width: parseFloat(style.width),
      height: parseFloat(style.height),
      halfBounds: [rect.width / 2, rect.height / 2],
      rotation: parseFloat(style.rotate) || 0
    };
  }

  function travelFrames(target, part, viewport) {
    const [xRatio, xCap] = INTRO.horizontalDrift;
    const [yRatio, yCap] = INTRO.verticalDrift;
    const maxX = Math.min(viewport.width * xRatio, xCap);
    const maxY = Math.min(viewport.height * yRatio, yCap);
    const [halfWidth, halfHeight] = target.halfBounds;
    const bound = (delta, center, half, low, high) =>
      Math.min(Math.max(0, high - center - half), Math.max(Math.min(0, low + half - center), delta));
    const path = INTRO.paths[part];
    const start = [
      bound(path.offset[0] * maxX, target.x, halfWidth, viewport.left ?? 0, viewport.right ?? viewport.width),
      bound(path.offset[1] * maxY, target.y, halfHeight, viewport.top ?? 0, viewport.bottom ?? viewport.height)
    ];
    const first = start.map((value, axis) => value * path.first[axis]);
    const second = start.map((value, axis) => value * path.second[axis]);
    // Sample by distance rather than Bezier parameter: curvature must not
    // introduce its own surges on top of the single ease-out timing curve.
    let length = 0;
    const curve = Array.from({ length: INTRO.curveSamples + 1 }, (_, step) => {
      const t = step / INTRO.curveSamples;
      const u = 1 - t;
      const point = start.map((value, axis) => u ** 3 * value + 3 * u ** 2 * t * first[axis] + 3 * u * t ** 2 * second[axis]);
      return { point };
    });
    curve.forEach((sample, index) => {
      if (index) length += Math.hypot(...sample.point.map((value, axis) => value - curve[index - 1].point[axis]));
      sample.distance = length;
    });
    let cursor = 1;
    return Array.from({ length: INTRO.flightSamples + 1 }, (_, step) => {
      const offset = step / INTRO.flightSamples;
      const distance = offset * length;
      while (cursor < curve.length - 1 && curve[cursor].distance < distance) cursor++;
      const before = curve[cursor - 1], after = curve[cursor];
      const fraction = (distance - before.distance) / (after.distance - before.distance || 1);
      const point = before.point.map((value, axis) => value + (after.point[axis] - value) * fraction);
      const x = target.x - target.width / 2 + point[0];
      const y = target.y - target.height / 2 + point[1];
      const rotation = target.rotation + path.tilt * (1 - offset) ** 2;
      return { offset, transform: 'translate3d(' + x + 'px,' + y + 'px,0) rotate(' + rotation + 'deg)' };
    });
  }

  let pieces = [];
  function positionPieces() {
    const { width, height } = stage.getBoundingClientRect();
    const visibleWidth = Math.min(width, html.getBoundingClientRect().width);
    const viewport = { width: visibleWidth, height,
      left: INTRO.edgeInset,
      right: visibleWidth - INTRO.edgeInset,
      top: INTRO.edgeInset,
      bottom: height - INTRO.edgeInset
    };
    const targets = pieces.map(piece => measure(piece.part));
    pieces.forEach((piece, index) => {
      const target = targets[index];
      piece.node.style.width = target.width + 'px';
      piece.node.style.height = target.height + 'px';
      const frames = travelFrames(target, piece.part.dataset.floatPart, viewport);
      if (piece.flight) piece.flight.effect.setKeyframes(frames);
      else piece.flight = animate(piece.node, frames, {
        delay: INTRO.whiteStart + index * INTRO.stagger,
        duration: INTRO.flightDuration,
        easing: INTRO.travelEase
      });
    });
  }

  function onResize() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(positionPieces);
  }

  function animateGraphics() {
    const settings = INTRO.graphics;
    settings.tracks.forEach(([name, from, to], index) => {
      const element = graphics.querySelector('[data-intro-graphic="' + name + '"]');
      const start = settings.start + index * settings.stagger;
      animate(element, [{ transform: from }, { transform: to }], {
        duration: settings.driftDuration, easing: settings.ease
      });
      animate(element, [
        { offset: 0, opacity: 0 },
        { offset: start / duration, opacity: 0, easing: INTRO.fadeEase },
        { offset: (start + settings.fadeIn) / duration, opacity: 1 },
        { offset: settings.fadeOutAt / duration, opacity: 1, easing: INTRO.fadeEase },
        { offset: (settings.fadeOutAt + settings.fadeOut) / duration, opacity: 0 },
        { offset: 1, opacity: 0 }
      ], { duration });
    });
  }

  function reveal() {
    const groups = [
      hero.querySelectorAll('.home-hero-copy-block > :is(.eyebrow, h1, .home-hero-copy)'),
      hero.querySelectorAll('.home-hero-purchase'),
      hero.querySelectorAll('.float-controls, .float-motion-button'),
      document.querySelectorAll('.site-header')
    ];
    groups.forEach((group, index) => {
      group.forEach(element => {
        animate(element, [{ opacity: 0 }, { opacity: 1 }], {
          delay: INTRO.revealAt + INTRO.revealOffset + index * INTRO.revealStagger,
          duration: INTRO.revealDuration,
          easing: INTRO.fadeEase
        });
      });
    });
  }

  async function start() {
    if (finished) return;
    try {
      hero = document.getElementById('hero');
      scene = hero?.pureformIntro;
      if (!scene || reduced.matches || getComputedStyle(html).getPropertyValue('--pf-intro-ready').trim() !== '1') {
        finish();
        return;
      }
      mountOverlay();
      hero.querySelectorAll('#heroTitle, .home-hero-copy').forEach(element => {
        element.classList.add('is-visible', 'pf-motion-instant');
      });
      const parts = INTRO.order.map(key => hero.querySelector('[data-float-part="' + key + '"]'));
      const artworkReady = scene.prepareColor(INTRO.color).then(images => {
        artwork = images;
        if (!finished && skipRequested) skip();
        return images;
      });
      const loadPieces = Promise.all(parts.map(async part => {
        const layer = await loadLayer(part, await artworkReady);
        return { part, layer };
      }));
      const background = hero.querySelector('.float-scene-background');
      const [ready] = await Promise.all([loadPieces, background.decode()]);
      if (finished) return;
      clearTimeout(loadTimer);
      selectColor();

      pieces = ready.map(({ part, layer }, index) => {
        const node = document.createElement('div');
        node.className = 'pf-intro-piece';
        node.dataset.part = part.dataset.floatPart;
        node.append(layer);
        stage.append(node);
        animate(node, [{ opacity: 0 }, { opacity: 1 }], {
          delay: INTRO.whiteStart + index * INTRO.stagger, duration: INTRO.enterFade, easing: INTRO.fadeEase
        });
        return { part, node };
      });
      positionPieces();
      animateGraphics();
      const fade = animate(backdrop, [{ opacity: 1 }, { opacity: 0 }], {
        delay: INTRO.revealAt, duration: INTRO.backdropFade, easing: INTRO.fadeEase
      });
      reveal();

      // Align every independent compositor track to the same document timeline.
      const startTime = document.timeline.currentTime;
      if (startTime !== null) animations.forEach(animation => { animation.startTime = startTime; });
      window.addEventListener('resize', onResize);
      window.visualViewport?.addEventListener('resize', onResize);
      safetyTimer = setTimeout(finish, duration + INTRO.safetyBuffer);
      await Promise.all([fade.finished, ...pieces.map(piece => piece.flight.finished)]);
      if (!finished) finish();
    } catch (_) {
      finish();
    }
  }

  document.addEventListener('keydown', onKeydown);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', finish);
  window.addEventListener('pagereveal', onPageReveal);
  reduced.addEventListener('change', onPreference);
  document.addEventListener('DOMContentLoaded', start, { once: true });
})();
