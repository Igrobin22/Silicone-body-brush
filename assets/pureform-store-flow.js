(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealSelector = [
    'main .page-hero',
    'main .card',
    'main .product-card',
    'main .review-card',
    'main .policy-card',
    'main .detail-list li',
    'main .form-grid',
    'main .buyer-confidence-item',
    'main .shopping-note-card',
    'main .pdp-proof-item',
    'main .pdp-accordion details'
  ].join(',');

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

      if (!img.complete || img.naturalWidth === 0) {
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
      }).observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  function setupReveal() {
    var targets = Array.prototype.slice.call(document.querySelectorAll(revealSelector)).filter(function (item) {
      return !item.classList.contains('reveal') && !item.hasAttribute('data-animate');
    });

    if (!targets.length) {
      return;
    }

    targets.forEach(function (item, index) {
      item.setAttribute('data-flow-reveal', '');
      item.style.setProperty('--pf-flow-delay', (index % 5) * 42 + 'ms');
    });

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      targets.forEach(function (item) {
        item.classList.add('is-visible');
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -48px 0px' });

    targets.forEach(function (item) {
      observer.observe(item);
    });
  }

  function setupStickyOrder() {
    var productOrderLink = document.getElementById('productOrderLink');
    var productName = document.getElementById('productName');
    var productPrice = document.getElementById('productPrice');
    var productCompare = document.getElementById('productCompare');
    var detailHero = document.querySelector('.detail-hero');

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

    function syncSticky() {
      stickyTitle.textContent = productName.textContent;
      stickyPrice.textContent = productPrice.textContent;
      stickyCompare.textContent = productCompare ? productCompare.textContent : '';
      stickyLink.href = productOrderLink.href;
    }

    function setStickyVisibility() {
      var rect = detailHero.getBoundingClientRect();
      sticky.classList.toggle('is-visible', rect.bottom < window.innerHeight * 0.72);
    }

    syncSticky();
    setStickyVisibility();
    window.addEventListener('scroll', setStickyVisibility, { passive: true });

    if ('MutationObserver' in window) {
      var mutationObserver = new MutationObserver(syncSticky);
      mutationObserver.observe(productName, { childList: true });
      mutationObserver.observe(productPrice, { childList: true });
      mutationObserver.observe(productOrderLink, { attributes: true, attributeFilter: ['href'] });
    }
  }

  setupImageFallbacks();
  setupReveal();
  setupStickyOrder();
})();
