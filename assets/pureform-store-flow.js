(function () {
  'use strict';

  var motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  var refreshReveal = function () {};

  document.documentElement.classList.add('pf-flow-ready');

  function getFallbackImage(img) {
    if (img.dataset.pfFallback) {
      return img.dataset.pfFallback;
    }

    var source = [
      img.getAttribute('src') || '',
      img.currentSrc || '',
      img.getAttribute('alt') || ''
    ].join(' ').toLowerCase();

    if (source.indexOf('pink') !== -1 || source.indexOf('p_face') !== -1 || source.indexOf('p_body') !== -1) {
      return 'assets/pureform-face-brush.png';
    }

    if (source.indexOf('scalp') !== -1 || source.indexOf('head') !== -1) {
      return 'assets/pureform-scalp-massager.png';
    }

    if (source.indexOf('back') !== -1 || source.indexOf('handle') !== -1) {
      return 'assets/pureform-back-scrubber.png';
    }

    return 'assets/pureform-body-brush.png';
  }

  function canFallbackImage(img) {
    var source;

    if (!img || img.dataset.pfNoFallback === 'true' || img.classList.contains('hero-mobile-bg') || img.getAttribute('aria-hidden') === 'true') {
      return false;
    }

    source = img.getAttribute('src') || img.currentSrc || '';
    return img.dataset.pfFallback || source.indexOf('res.cloudinary.com') !== -1;
  }

  function useFallbackImage(img) {
    var fallback;
    var picture;

    if (!canFallbackImage(img) || img.dataset.pfFallbackApplied === 'true') {
      return;
    }

    fallback = getFallbackImage(img);
    picture = img.closest ? img.closest('picture') : null;
    img.dataset.pfFallbackApplied = 'true';

    if (picture) {
      Array.prototype.forEach.call(picture.querySelectorAll('source'), function (source) {
        source.srcset = fallback;
      });
    }

    img.srcset = '';
    img.src = fallback;
  }

  function scheduleFallbackCheck(img, delay) {
    if (!canFallbackImage(img) || img.dataset.pfFallbackTimer === 'true' || img.dataset.pfFallbackApplied === 'true') {
      return;
    }

    img.dataset.pfFallbackTimer = 'true';

    window.setTimeout(function () {
      img.dataset.pfFallbackTimer = 'false';

      if (img.complete && img.naturalWidth === 0) {
        useFallbackImage(img);
      }
    }, delay);
  }

  function armImageFallback(img, observer) {
    if (!canFallbackImage(img) || img.dataset.pfFallbackArmed === 'true') {
      return;
    }

    img.dataset.pfFallbackArmed = 'true';

    if (img.complete && img.naturalWidth === 0) {
      useFallbackImage(img);
      return;
    }

    if (img.loading !== 'lazy') {
      scheduleFallbackCheck(img, 1800);
    }

    if (observer) {
      observer.observe(img);
    }
  }

  function setupImageFallbacks() {
    var imageObserver = null;

    document.addEventListener('error', function (event) {
      if (event.target && event.target.tagName === 'IMG') {
        useFallbackImage(event.target);
      }
    }, true);

    if ('IntersectionObserver' in window) {
      imageObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            scheduleFallbackCheck(entry.target, 1800);
            imageObserver.unobserve(entry.target);
          }
        });
      }, { rootMargin: '420px 0px' });
    }

    Array.prototype.forEach.call(document.images, function (img) {
      armImageFallback(img, imageObserver);
    });

    if ('MutationObserver' in window) {
      new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          Array.prototype.forEach.call(mutation.addedNodes, function (node) {
            if (!node || node.nodeType !== 1) {
              return;
            }

            if (node.tagName === 'IMG') {
              armImageFallback(node, imageObserver);
            }

            Array.prototype.forEach.call(node.querySelectorAll ? node.querySelectorAll('img') : [], function (img) {
              armImageFallback(img, imageObserver);
            });
          });
        });
        refreshReveal();
      }).observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  function setupReveal() {
    var groups = [
      ['#heroTitle', 'fade'],
      ['.home-hero-copy', 'fade'],
      ['.retail-heading, .collection-heading', 'drop'],
      ['.home-promises > a, .pdp-benefits > a', 'fade'],
      ['#products .home-section-head, .cart-recommendations > .section-title', 'left'],
      ['.pgrid > .pcard, .collection-grid > .collection-card', 'rise'],
      ['.home-included .home-section-head', 'right'],
      ['.home-tools > div, .pdp-tool-grid > figure, .home-lifestyle-shot', 'zoom'],
      ['.home-benefits > div', 'rise'],
      ['.home-reviews .home-section-head, .home-lifestyle .home-section-head, .pdp-section-head', 'drop'],
      ['.home-review, .review-card, .pdp-review-card', 'left'],
      ['.home-faq > div:first-child', 'zoom'],
      ['.home-faq summary, .retail-question > summary', 'right'],
      ['.collection-essentials > div', 'left'],
      ['.about-intro > p', 'left'],
      ['.about-intro > img, .pdp-gallery', 'zoom'],
      ['.about-values > .section-title, main > .sec > .section-title', 'drop'],
      ['.about-values .card, .cart-product-card', 'rise'],
      ['.sec.alt .grid-2 > div, .pdp-highlights', 'right'],
      ['.detail-list > li', 'left'],
      ['.support-layout > div > .section-title, .combined-faq > h2', 'drop'],
      ['.retail-side-nav, .combined-faq-links', 'fade'],
      ['.combined-faq-group > h3', 'left'],
      ['.policy-card', 'alternate'],
      ['.pdp-copy', 'left'],
      ['.pdp-information summary, .pdp-details-body > .pdp-lead', 'fade'],
      ['.pdp-routine-steps > li', 'rise'],
      ['.pdp-specs > div, .pdp-related-card', 'right'],
      ['.cart-empty-state > div:first-child', 'fade'],
      ['.cart-summary > h2, .checkout-summary > h2', 'right'],
      ['.checkout-step-title', 'fade'],
      ['.retail-footer-grid > div', 'rise']
    ];
    var targets = new Set();
    var seenParents = new WeakSet();
    var observer = null;
    var refreshFrame = null;

    function reveal(item, instant) {
      if (instant) item.classList.add('pf-motion-instant');
      item.classList.add('is-visible');
      if (item.parentElement) seenParents.add(item.parentElement);
      if (observer) observer.unobserve(item);
    }

    if ('IntersectionObserver' in window) {
      try {
        observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) reveal(entry.target, motionPreference.matches);
          });
        }, { threshold: 0.05, rootMargin: '0px 0px -16px 0px' });
      } catch (error) {
        observer = null;
      }
    }

    function registerTargets() {
      targets.forEach(function (item) {
        if (!item.isConnected) {
          if (observer) observer.unobserve(item);
          targets.delete(item);
        }
      });
      groups.forEach(function (group) {
        document.querySelectorAll(group[0]).forEach(function (item, index) {
          if (targets.has(item)) return;
          targets.add(item);
          var variant = group[1] === 'alternate' ? (index % 2 ? 'right' : 'left') : group[1];
          item.setAttribute('data-flow-reveal', variant);
          item.style.setProperty('--pf-flow-delay', Math.min(index % 4, 3) * 55 + 'ms');
          // Catalog refreshes must not replay an already-seen product row.
          if (motionPreference.matches || !observer || seenParents.has(item.parentElement)) {
            reveal(item, true);
          } else {
            item.classList.remove('is-visible');
            observer.observe(item);
          }
        });
      });
    }

    refreshReveal = function () {
      if (refreshFrame !== null) return;
      refreshFrame = window.requestAnimationFrame(function () {
        refreshFrame = null;
        registerTargets();
      });
    };

    // Keyboard focus must never land on transparent or moving content.
    document.addEventListener('focusin', function (event) {
      var item = event.target;
      while (item && item !== document.documentElement) {
        if (targets.has(item)) reveal(item, true);
        item = item.parentElement;
      }
    });

    function showAll() {
      targets.forEach(function (item) { reveal(item, true); });
    }
    if (motionPreference.addEventListener) {
      motionPreference.addEventListener('change', function () {
        if (motionPreference.matches) showAll();
      });
    }
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) showAll();
    });
    registerTargets();
  }

  function setupStickyOrder() {
    var productOrderLink = document.getElementById('productOrderLink');
    var productName = document.getElementById('productName');
    var productPrice = document.getElementById('productPrice');
    var productCompare = document.getElementById('productCompare');
    var detailHero = document.querySelector('.detail-hero, .pdp-grid');

    if (!productOrderLink || !productName || !productPrice || !detailHero || document.querySelector('.pf-sticky-order')) {
      return;
    }

    var sticky = document.createElement('aside');
    sticky.className = 'pf-sticky-order';
    sticky.setAttribute('aria-label', 'Quick order bar');
    sticky.innerHTML = [
      '<div>',
      '  <strong class="pf-sticky-order-title"></strong>',
      '  <span class="pf-sticky-order-meta"><span class="pf-sticky-price"></span><span class="pf-sticky-compare"></span></span>',
      '</div>',
      '  <a class="btn-p Btn buy-pay-button" href="#"><span>Start Order</span><svg class="svgIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H3c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2zm0 3v2h18V8H3zm3 7h5v-2H6v2z"/></svg></a>'
    ].join('');
    document.body.appendChild(sticky);

    var stickyTitle = sticky.querySelector('.pf-sticky-order-title');
    var stickyPrice = sticky.querySelector('.pf-sticky-price');
    var stickyCompare = sticky.querySelector('.pf-sticky-compare');
    var stickyLink = sticky.querySelector('a');
    var stickyLabel = stickyLink.querySelector('span');

    function syncSticky() {
      stickyTitle.textContent = productName.textContent;
      stickyPrice.textContent = productPrice.textContent;
      stickyCompare.textContent = productCompare ? productCompare.textContent : '';
      stickyLink.href = productOrderLink.href;
      var disabled = productOrderLink.getAttribute('aria-disabled') === 'true';
      stickyLink.setAttribute('aria-disabled', String(disabled));
      stickyLabel.textContent = disabled ? 'Out of stock' : 'Add to cart';
    }

    function setStickyVisibility() {
      var visible = window.matchMedia('(max-width: 820px)').matches && productOrderLink.getBoundingClientRect().bottom < 72;
      sticky.classList.toggle('is-visible', visible);
      sticky.inert = !visible;
      document.body.classList.toggle('pf-has-sticky-order', visible);
    }

    syncSticky();
    setStickyVisibility();
    window.addEventListener('scroll', setStickyVisibility, { passive: true });
    window.addEventListener('resize', setStickyVisibility);
    stickyLink.addEventListener('click', function (event) {
      event.preventDefault();
      productOrderLink.click();
    });

    if ('MutationObserver' in window) {
      var mutationObserver = new MutationObserver(syncSticky);
      mutationObserver.observe(productName, { childList: true });
      mutationObserver.observe(productPrice, { childList: true });
      mutationObserver.observe(productOrderLink, { attributes: true, attributeFilter: ['href', 'aria-disabled'], childList: true, subtree: true });
    }
  }

  setupImageFallbacks();
  setupReveal();
  setupStickyOrder();
})();
