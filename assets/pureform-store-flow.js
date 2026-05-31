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

  setupReveal();
  setupStickyOrder();
})();
