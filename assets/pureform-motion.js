(function () {
  'use strict';

  var detailsSelector = '.pdp-detail-block, .pdp-accordion details';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var activeAnimations = new WeakMap();
  var easeOut = 'cubic-bezier(0.23, 1, 0.32, 1)';

  function getPanel(details) {
    return Array.prototype.find.call(details.children, function (child) {
      return child.tagName.toLowerCase() !== 'summary';
    });
  }

  function clearPanel(panel) {
    if (!panel) {
      return;
    }

    panel.style.height = '';
    panel.style.opacity = '';
    panel.style.overflow = '';
    panel.style.transform = '';
  }

  function cancelCurrent(details) {
    var animation = activeAnimations.get(details);
    if (animation) {
      animation.cancel();
      activeAnimations.delete(details);
    }
  }

  function finish(details, panel, shouldOpen) {
    details.open = shouldOpen;
    details.removeAttribute('data-pf-animating');
    activeAnimations.delete(details);
    clearPanel(panel);
  }

  function openDetails(details, panel) {
    details.open = true;
    if (!panel) {
      return;
    }

    panel.style.overflow = 'hidden';
    panel.style.height = '0px';
    panel.style.opacity = '0';
    panel.style.transform = 'translateY(-4px)';

    var targetHeight = panel.scrollHeight;
    var animation = panel.animate([
      { height: '0px', opacity: 0, transform: 'translateY(-4px)' },
      { height: targetHeight + 'px', opacity: 1, transform: 'translateY(0)' }
    ], {
      duration: 240,
      easing: easeOut
    });

    details.setAttribute('data-pf-animating', 'open');
    activeAnimations.set(details, animation);
    animation.onfinish = function () {
      finish(details, panel, true);
    };
  }

  function closeDetails(details, panel) {
    if (!panel) {
      details.open = false;
      return;
    }

    var startHeight = panel.getBoundingClientRect().height || panel.scrollHeight;
    panel.style.overflow = 'hidden';
    panel.style.height = startHeight + 'px';
    panel.style.opacity = '1';
    panel.style.transform = 'translateY(0)';

    var animation = panel.animate([
      { height: startHeight + 'px', opacity: 1, transform: 'translateY(0)' },
      { height: '0px', opacity: 0, transform: 'translateY(-3px)' }
    ], {
      duration: 180,
      easing: easeOut
    });

    details.setAttribute('data-pf-animating', 'close');
    activeAnimations.set(details, animation);
    animation.onfinish = function () {
      finish(details, panel, false);
    };
  }

  function handleSummaryClick(event) {
    var summary = event.currentTarget;
    var details = summary.parentElement;
    var panel = getPanel(details);

    event.preventDefault();
    cancelCurrent(details);

    if (reduceMotion.matches || !panel || typeof panel.animate !== 'function') {
      details.open = !details.open;
      clearPanel(panel);
      return;
    }

    if (details.open) {
      closeDetails(details, panel);
      return;
    }

    openDetails(details, panel);
  }

  function setupDetailsMotion() {
    document.querySelectorAll(detailsSelector).forEach(function (details) {
      if (details.hasAttribute('data-pf-details-motion')) {
        return;
      }

      var summary = details.querySelector(':scope > summary');
      if (!summary) {
        return;
      }

      details.setAttribute('data-pf-details-motion', '');
      summary.addEventListener('click', handleSummaryClick);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDetailsMotion);
    return;
  }

  setupDetailsMotion();
})();
