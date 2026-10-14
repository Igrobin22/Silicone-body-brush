(function () {
  'use strict';

  document.documentElement.classList.add('pf-js');

  const nav = document.querySelector('body > nav');

  if (!nav || document.querySelector('.pf-mobile-sidebar')) {
    return;
  }

  const navLinks = Array.prototype.slice.call(nav.querySelectorAll('.nav-links a'));
  const cta = nav.querySelector('.nav-cta');
  const cart = nav.querySelector('.nav-cart');

  if (!navLinks.length) {
    return;
  }

  const menuButton = document.createElement('button');
  menuButton.className = 'pf-mobile-menu-button';
  menuButton.type = 'button';
  menuButton.setAttribute('aria-controls', 'pfMobileSidebar');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open navigation menu');
  menuButton.innerHTML = '<span aria-hidden="true"></span>';

  const overlay = document.createElement('div');
  overlay.className = 'pf-mobile-menu-overlay';
  overlay.setAttribute('hidden', '');

  const sidebar = document.createElement('aside');
  sidebar.className = 'pf-mobile-sidebar';
  sidebar.id = 'pfMobileSidebar';
  sidebar.setAttribute('aria-hidden', 'true');
  sidebar.setAttribute('inert', '');
  sidebar.setAttribute('role', 'dialog');
  sidebar.setAttribute('aria-modal', 'true');
  sidebar.setAttribute('aria-label', 'Navigation');
  sidebar.innerHTML = [
    '<div class="pf-mobile-sidebar-header">',
    '  <div class="pf-mobile-sidebar-brand">',
    '    <strong>PureForm</strong>',
    '    <span>Silicone brush set</span>',
    '  </div>',
    '  <button class="pf-mobile-sidebar-close" type="button" aria-label="Close navigation menu">&times;</button>',
    '</div>',
    '<div class="pf-mobile-sidebar-list" role="navigation" aria-label="Mobile navigation"></div>',
    '<div class="pf-mobile-sidebar-footer"></div>'
  ].join('');

  const list = sidebar.querySelector('.pf-mobile-sidebar-list');
  const closeButton = sidebar.querySelector('.pf-mobile-sidebar-close');
  const footer = sidebar.querySelector('.pf-mobile-sidebar-footer');

  navLinks.forEach(function (link) {
    const item = document.createElement('a');
    item.className = 'pf-mobile-sidebar-link' + (link.classList.contains('is-active') ? ' is-active' : '');
    item.href = link.getAttribute('href') || '#';
    item.textContent = link.textContent.trim();
    item.dataset.label = item.textContent.toLowerCase();
    list.appendChild(item);
  });

  if (cart) {
    const cartItem = document.createElement('a');
    cartItem.className = 'pf-mobile-sidebar-link' + (cart.classList.contains('is-active') ? ' is-active' : '');
    cartItem.href = cart.getAttribute('href') || 'cart.html';
    cartItem.textContent = 'Cart';
    cartItem.dataset.label = 'cart';
    list.appendChild(cartItem);
  }

  {
    const ctaLink = document.createElement('a');
    ctaLink.className = 'pf-mobile-sidebar-cta';
    ctaLink.href = cta ? cta.getAttribute('href') : 'products.html';
    ctaLink.textContent = 'Shop the sets';
    footer.appendChild(ctaLink);
  }

  function isMobile() {
    return globalThis.matchMedia('(max-width: 820px)').matches;
  }

  const backgroundState = new Map();

  function openMenu() {
    if (!isMobile()) {
      return;
    }
    if (sidebar.classList.contains('is-open')) {
      closeMenu();
      return;
    }
    if (backgroundState.size) return;

    document.body.classList.add('pf-mobile-menu-lock');
    Array.from(document.body.children).forEach(function (element) {
      if (element === menuButton || element === sidebar || element === overlay || element.tagName === 'SCRIPT') return;
      backgroundState.set(element, element.inert);
      element.inert = true;
    });
    overlay.removeAttribute('hidden');
    requestAnimationFrame(function () {
      overlay.classList.add('is-open');
      sidebar.classList.add('is-open');
      menuButton.setAttribute('aria-expanded', 'true');
      sidebar.setAttribute('aria-hidden', 'false');
      sidebar.removeAttribute('inert');
      closeButton.focus();
    });
  }

  function closeMenu() {
    const wasOpen = sidebar.classList.contains('is-open');
    document.body.classList.remove('pf-mobile-menu-lock');
    overlay.classList.remove('is-open');
    sidebar.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    sidebar.setAttribute('aria-hidden', 'true');
    sidebar.setAttribute('inert', '');
    backgroundState.forEach(function (wasInert, element) { element.inert = wasInert; });
    backgroundState.clear();
    if (wasOpen && isMobile()) menuButton.focus();

    globalThis.setTimeout(function () {
      if (!overlay.classList.contains('is-open')) {
        overlay.setAttribute('hidden', '');
      }
    }, 260);
  }

  menuButton.addEventListener('click', openMenu);
  closeButton.addEventListener('click', closeMenu);
  overlay.addEventListener('click', closeMenu);

  sidebar.addEventListener('click', function (event) {
    if (event.target.closest('a')) {
      closeMenu();
    }
  });

  globalThis.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeMenu();
    }
    if (event.key === 'Tab' && sidebar.classList.contains('is-open')) {
      const items = Array.from(sidebar.querySelectorAll('button, a[href]'));
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  globalThis.addEventListener('resize', function () {
    if (!isMobile()) {
      closeMenu();
    }
  });

  document.body.appendChild(menuButton);
  document.body.appendChild(overlay);
  document.body.appendChild(sidebar);
})();
