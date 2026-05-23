(function () {
  'use strict';

  document.documentElement.classList.add('pf-js');

  const nav = document.querySelector('body > nav');

  if (!nav || document.querySelector('.pf-mobile-sidebar')) {
    return;
  }

  const navLinks = Array.prototype.slice.call(nav.querySelectorAll('.nav-links a'));
  const cta = nav.querySelector('.nav-cta');

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
  sidebar.innerHTML = [
    '<div class="pf-mobile-sidebar-header">',
    '  <div class="pf-mobile-sidebar-brand">',
    '    <strong>PureForm</strong>',
    '    <span>Silicone brush set</span>',
    '  </div>',
    '  <button class="pf-mobile-sidebar-close" type="button" aria-label="Close navigation menu">&times;</button>',
    '</div>',
    '<div class="pf-mobile-sidebar-search">',
    '  <input type="search" placeholder="Search pages" aria-label="Search navigation pages">',
    '</div>',
    '<div class="pf-mobile-sidebar-list" role="navigation" aria-label="Mobile navigation"></div>',
    '<div class="pf-mobile-sidebar-empty">No matching page found.</div>',
    '<div class="pf-mobile-sidebar-footer"></div>'
  ].join('');

  const list = sidebar.querySelector('.pf-mobile-sidebar-list');
  const searchInput = sidebar.querySelector('input[type="search"]');
  const emptyState = sidebar.querySelector('.pf-mobile-sidebar-empty');
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

  if (cta) {
    const ctaLink = document.createElement('a');
    ctaLink.className = 'pf-mobile-sidebar-cta';
    ctaLink.href = cta.getAttribute('href') || 'products.html#offers';
    ctaLink.textContent = cta.textContent.trim() || 'Shop the set';
    footer.appendChild(ctaLink);
  }

  function isMobile() {
    return globalThis.matchMedia('(max-width: 820px)').matches;
  }

  function openMenu() {
    if (!isMobile()) {
      return;
    }

    document.body.classList.add('pf-mobile-menu-lock');
    overlay.removeAttribute('hidden');
    requestAnimationFrame(function () {
      overlay.classList.add('is-open');
      sidebar.classList.add('is-open');
      menuButton.setAttribute('aria-expanded', 'true');
      sidebar.setAttribute('aria-hidden', 'false');
      sidebar.removeAttribute('inert');
      searchInput.focus();
    });
  }

  function closeMenu() {
    document.body.classList.remove('pf-mobile-menu-lock');
    overlay.classList.remove('is-open');
    sidebar.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    sidebar.setAttribute('aria-hidden', 'true');
    sidebar.setAttribute('inert', '');

    globalThis.setTimeout(function () {
      if (!overlay.classList.contains('is-open')) {
        overlay.setAttribute('hidden', '');
      }
    }, 260);
  }

  function filterLinks() {
    const query = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    Array.prototype.forEach.call(list.querySelectorAll('.pf-mobile-sidebar-link'), function (link) {
      const isVisible = !query || link.dataset.label.indexOf(query) !== -1;
      link.style.display = isVisible ? '' : 'none';
      visibleCount += isVisible ? 1 : 0;
    });

    emptyState.classList.toggle('is-visible', visibleCount === 0);
  }

  menuButton.addEventListener('click', openMenu);
  closeButton.addEventListener('click', closeMenu);
  overlay.addEventListener('click', closeMenu);
  searchInput.addEventListener('input', filterLinks);

  sidebar.addEventListener('click', function (event) {
    if (event.target.closest('a')) {
      closeMenu();
    }
  });

  globalThis.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeMenu();
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
