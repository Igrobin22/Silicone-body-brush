(function () {
  'use strict';

  const INTRO = {
    loadTimeout: 2500,
    whiteStart: 70,
    flightDuration: 1910,
    stagger: 130,
    enterFade: 380,
    colorFade: 300,
    colorStarts: [450, 825, 1220],
    revealAt: 1370,
    backdropFade: 780,
    revealOffset: 270,
    revealStagger: 65,
    revealDuration: 440,
    titleIn: 400,
    titleOut: 1550,
    titleFadeOut: 400,
    lightDuration: 1760,
    safetyBuffer: 500,
    flightSamples: 64,
    fadeEase: 'ease-in-out',
    horizontalDrift: [.13, 185],
    verticalDrift: [.21, 165],
    // Speeds by fraction of flight time. The last ramp brakes before the handoff.
    speed: [[0, 1.1], [.18, 1.8], [.43, .37], [.62, .33], [.82, 1.85], [.92, 1.05], [1, 0]],
    paths: {
      back: [[-.88, -.80], [-.69, -.56], [-.32, -.10]],
      scalp: [[1, -.54], [.69, -.64], [.26, -.12]],
      body: [[-.46, .74], [-.65, .42], [-.18, .23]],
      face: [[.88, .66], [.68, .44], [.22, .22]]
    },
    order: ['back', 'scalp', 'body', 'face'],
    colors: ['black', 'pink', 'grey'],
    finalColor: 'pink',
    swatches: { black: '#262528', pink: '#ec2b71', grey: '#8a979e' }
  };

  const html = document.documentElement;
  if (!html.classList.contains('pf-intro-active')) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const duration = INTRO.whiteStart + INTRO.flightDuration + (INTRO.order.length - 1) * INTRO.stagger;
  const animations = [];
  const temporarilyInert = [];
  let overlay, stage, backdrop, light, title, skipButton, scene, hero, pink, resizeFrame, safetyTimer;
  let finished = false;
  let skipRequested = false;
  let pinkSelected = false;
  const loadTimer = setTimeout(finish, INTRO.loadTimeout);

  function selectPink() {
    if (!pink || pinkSelected) return;
    scene.showColor(INTRO.finalColor, pink);
    pinkSelected = true;
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
    if (!pink) return; // Wait only within the existing asset timeout.
    selectPink();
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
    light = document.createElement('div');
    light.className = 'pf-intro-light';
    backdrop.append(light);
    title = document.createElement('div');
    title.className = 'pf-intro-title';
    title.innerHTML = '<span class="pf-intro-wordmark">PureForm</span>' +
      '<span class="pf-intro-kicker">The silicone shower set</span>' +
      '<strong>Four tools.<br><em>One ritual.</em></strong>' +
      '<span class="pf-intro-index">Back <i></i> Scalp <i></i> Body <i></i> Face</span>';
    stage.append(backdrop, title);
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

  async function loadLayer(part, color, pinkReady) {
    const image = new Image();
    image.alt = '';
    image.src = new URL('./' + color + '-' + part.dataset.floatPart + '.webp', part.querySelector('img').src).href;
    try {
      await image.decode();
      image.className = 'pf-intro-layer';
      return image;
    } catch (error) {
      if (color === INTRO.finalColor) throw error;
      const pinkImage = (await pinkReady).find(image => image.parentElement === part);
      const mask = document.createElement('div');
      mask.className = 'pf-intro-layer pf-intro-mask';
      mask.style.maskImage = 'url(' + JSON.stringify(pinkImage.src) + ')';
      mask.style.backgroundColor = INTRO.swatches[color];
      return mask;
    }
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

  function distanceAt(time) {
    let distance = 0;
    for (let index = 1; index < INTRO.speed.length; index++) {
      const [start, from] = INTRO.speed[index - 1];
      const [end, to] = INTRO.speed[index];
      const t = Math.min(1, (time - start) / (end - start));
      // Integrate a smoothstep between speeds to keep acceleration continuous at each stop.
      distance += (end - start) * (from * t + (to - from) * (t ** 3 - t ** 4 / 2));
      if (time <= end) break;
    }
    return distance;
  }

  function travelFrames(target, part, viewport) {
    const [xRatio, xCap] = INTRO.horizontalDrift;
    const [yRatio, yCap] = INTRO.verticalDrift;
    const maxX = Math.min(viewport.width * xRatio, xCap);
    const maxY = Math.min(viewport.height * yRatio, yCap);
    const [halfWidth, halfHeight] = target.halfBounds;
    const bound = (delta, center, half, edge) =>
      Math.min(Math.max(0, edge - center - half), Math.max(Math.min(0, half - center), delta));
    const [start, first, second] = INTRO.paths[part].map(([x, y]) => [
      bound(x * maxX, target.x, halfWidth, viewport.width),
      bound(y * maxY, target.y, halfHeight, viewport.bottom ?? viewport.height)
    ]);
    const totalPace = distanceAt(1);
    return Array.from({ length: INTRO.flightSamples + 1 }, (_, step) => {
      const offset = step / INTRO.flightSamples;
      const t = distanceAt(offset) / totalPace;
      const u = 1 - t;
      const x = target.x - target.width / 2 + u ** 3 * start[0] + 3 * u ** 2 * t * first[0] + 3 * u * t ** 2 * second[0];
      const y = target.y - target.height / 2 + u ** 3 * start[1] + 3 * u ** 2 * t * first[1] + 3 * u * t ** 2 * second[1];
      return { offset, transform: 'translate3d(' + x + 'px,' + y + 'px,0) rotate(' + target.rotation + 'deg)' };
    });
  }

  function layerFrames(color, index) {
    const offset = INTRO.whiteStart + index * INTRO.stagger;
    const colorOrder = [...INTRO.colors, INTRO.finalColor];
    let opacity = Number(color === INTRO.colors[0]);
    const frames = [{ offset: 0, opacity }];
    for (const [step, start] of INTRO.colorStarts.entries()) {
      const at = start + offset;
      const next = Number(color === colorOrder[step + 1]);
      if (next === opacity) continue;
      frames.push({ offset: at / duration, opacity, easing: INTRO.fadeEase });
      frames.push({ offset: (at + INTRO.colorFade) / duration, opacity: next });
      opacity = next;
    }
    frames.push({ offset: 1, opacity });
    return frames;
  }

  let pieces = [];
  function positionPieces() {
    const { width, height } = stage.getBoundingClientRect();
    const bottom = matchMedia('(max-width: 1000px) and (orientation: portrait)').matches ? title.offsetTop - 12 : height;
    const viewport = { width, height, bottom };
    const targets = pieces.map(piece => measure(piece.part));
    pieces.forEach((piece, index) => {
      const target = targets[index];
      piece.node.style.width = target.width + 'px';
      piece.node.style.height = target.height + 'px';
      const frames = travelFrames(target, piece.part.dataset.floatPart, viewport);
      if (piece.flight) piece.flight.effect.setKeyframes(frames);
      else piece.flight = animate(piece.node, frames, {
        delay: INTRO.whiteStart + index * INTRO.stagger,
        duration: INTRO.flightDuration
      });
    });
  }

  function onResize() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(positionPieces);
  }

  function lightStudio() {
    animate(light, [
      { transform: 'translate3d(-55%,0,0)', opacity: 0 },
      { transform: 'translate3d(-20%,0,0)', opacity: .9, offset: .32 },
      { transform: 'translate3d(55%,0,0)', opacity: 0 }
    ], { duration: INTRO.lightDuration });

    animate(title, [
      { opacity: 0, transform: 'translate3d(0,12px,0)', easing: 'ease-out' },
      { opacity: 1, transform: 'translate3d(0,0,0)', offset: INTRO.titleIn / duration },
      { opacity: 1, transform: 'translate3d(0,0,0)', offset: INTRO.titleOut / duration, easing: 'ease-in' },
      { opacity: 0, transform: 'translate3d(0,-5px,0)', offset: (INTRO.titleOut + INTRO.titleFadeOut) / duration },
      { opacity: 0, transform: 'translate3d(0,-5px,0)' }
    ], { duration });
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
      const colors = [...new Set([...INTRO.colors, INTRO.finalColor])];
      const pinkReady = scene.prepareColor(INTRO.finalColor).then(images => {
        pink = images;
        if (!finished && skipRequested) skip();
        return images;
      });
      const loadPieces = Promise.all(parts.map(async part => {
        const layers = await Promise.all(colors.map(color => loadLayer(part, color, pinkReady)));
        return { part, layers };
      }));
      const background = hero.querySelector('.float-scene-background');
      const [ready] = await Promise.all([loadPieces, background.decode(), pinkReady]);
      if (finished) return;
      clearTimeout(loadTimer);
      selectPink();

      pieces = ready.map(({ part, layers }, index) => {
        const node = document.createElement('div');
        node.className = 'pf-intro-piece';
        node.dataset.part = part.dataset.floatPart;
        node.append(...layers);
        stage.append(node);
        animate(node, [{ opacity: 0 }, { opacity: 1 }], {
          delay: INTRO.whiteStart + index * INTRO.stagger, duration: INTRO.enterFade, easing: INTRO.fadeEase
        });
        layers.forEach((layer, layerIndex) => animate(layer, layerFrames(colors[layerIndex], index), { duration }));
        return { part, node };
      });
      positionPieces();
      lightStudio();
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
