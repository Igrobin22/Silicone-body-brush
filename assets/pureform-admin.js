(function () {
  'use strict';

  var SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  var STORAGE_KEY = 'pureform.admin.supabase';
  var DEFAULT_CONFIG = window.PUREFORM_SUPABASE_CONFIG || {};

  var state = {
    supabase: null,
    authListener: null,
    session: null,
    profile: null,
    listings: [],
    contentBlocks: [],
    activeView: 'overview',
    page: 'login'
  };

  var els = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    collectElements();
    state.page = document.body.dataset.adminPage || (els.dashboardView && !els.authView ? 'dashboard' : 'login');
    document.body.classList.toggle('has-default-supabase-config', hasConfig(DEFAULT_CONFIG));
    bindEvents();
    var config = loadConfig();
    fillConfigForm(config);

    if (hasConfig(config)) {
      connectSupabase(config, { silent: true });
    } else if (isDashboardPage()) {
      redirectToLogin();
    } else {
      setAuthStatus('Enter your Supabase project URL and anon key to enable the admin login.', 'neutral');
    }
  }

  function collectElements() {
    els.authView = document.getElementById('authView');
    els.dashboardView = document.getElementById('dashboardView');
    els.dashboardLoading = document.getElementById('dashboardLoading');
    els.configForm = document.getElementById('configForm');
    els.loginForm = document.getElementById('loginForm');
    els.supabaseUrl = document.getElementById('supabaseUrl');
    els.supabaseAnonKey = document.getElementById('supabaseAnonKey');
    els.clearConfigButton = document.getElementById('clearConfigButton');
    els.adminEmail = document.getElementById('adminEmail');
    els.adminPassword = document.getElementById('adminPassword');
    els.authStatus = document.getElementById('authStatus');
    els.dashboardStatus = document.getElementById('dashboardStatus');
    els.adminUserEmail = document.getElementById('adminUserEmail');
    els.signOutButton = document.getElementById('signOutButton');
    els.refreshButton = document.getElementById('refreshButton');
    els.viewTitle = document.getElementById('viewTitle');
    els.navTabs = Array.prototype.slice.call(document.querySelectorAll('.nav-tab'));
    els.panels = {
      overview: document.getElementById('overviewPanel'),
      listings: document.getElementById('listingsPanel'),
      content: document.getElementById('contentPanel')
    };
    els.statsGrid = document.getElementById('statsGrid');
    els.inventoryBadge = document.getElementById('inventoryBadge');
    els.inventoryList = document.getElementById('inventoryList');
    els.discountBadge = document.getElementById('discountBadge');
    els.discountList = document.getElementById('discountList');
    els.newListingButton = document.getElementById('newListingButton');
    els.listingsTableBody = document.getElementById('listingsTableBody');
    els.listingForm = document.getElementById('listingForm');
    els.listingFormTitle = document.getElementById('listingFormTitle');
    els.deleteListingButton = document.getElementById('deleteListingButton');
    els.listingPhotoPreview = document.getElementById('listingPhotoPreview');
    els.newContentButton = document.getElementById('newContentButton');
    els.contentTableBody = document.getElementById('contentTableBody');
    els.contentForm = document.getElementById('contentForm');
    els.contentFormTitle = document.getElementById('contentFormTitle');
    els.deleteContentButton = document.getElementById('deleteContentButton');
  }

  function bindEvents() {
    bind(els.configForm, 'submit', onConfigSubmit);
    bind(els.clearConfigButton, 'click', clearConfig);
    bind(els.loginForm, 'submit', onLoginSubmit);
    bind(els.signOutButton, 'click', signOut);
    bind(els.refreshButton, 'click', loadDashboardData);

    els.navTabs.forEach(function (button) {
      button.addEventListener('click', function () {
        setView(button.dataset.view);
      });
    });

    bind(els.newListingButton, 'click', function () {
      fillListingForm();
      setView('listings');
    });

    bind(els.listingsTableBody, 'click', onListingsTableClick);
    bind(els.listingsTableBody, 'change', onListingsTableChange);
    bind(els.listingForm, 'submit', onListingSubmit);
    bind(els.deleteListingButton, 'click', onDeleteListing);
    bind(document.getElementById('listingPhotos'), 'input', renderPhotoPreviewFromForm);
    bind(document.getElementById('listingName'), 'input', maybeFillSlug);
    bind(document.getElementById('listingPrice'), 'input', renderPricePreview);
    bind(document.getElementById('listingDiscount'), 'input', renderPricePreview);
    bind(document.getElementById('listingDiscountMode'), 'change', renderPricePreview);
    bind(document.getElementById('listingDiscountStartsAt'), 'input', renderPricePreview);
    bind(document.getElementById('listingDiscountEndsAt'), 'input', renderPricePreview);

    bind(els.newContentButton, 'click', function () {
      fillContentForm();
      setView('content');
    });

    bind(els.contentTableBody, 'click', onContentTableClick);
    bind(els.contentForm, 'submit', onContentSubmit);
    bind(els.deleteContentButton, 'click', onDeleteContent);
  }

  function bind(element, eventName, handler) {
    if (element) {
      element.addEventListener(eventName, handler);
    }
  }

  function loadConfig() {
    if (hasConfig(DEFAULT_CONFIG)) {
      return normalizeConfig(DEFAULT_CONFIG);
    }

    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return normalizeConfig(saved);
    } catch (error) {
      return { url: '', anonKey: '' };
    }
  }

  function normalizeConfig(config) {
    return {
      url: String(config.url || config.supabaseUrl || '').trim(),
      anonKey: String(config.anonKey || config.supabaseAnonKey || '').trim()
    };
  }

  function hasConfig(config) {
    return Boolean(config && config.url && config.anonKey);
  }

  function fillConfigForm(config) {
    if (!els.supabaseUrl || !els.supabaseAnonKey) {
      return;
    }

    els.supabaseUrl.value = config.url || '';
    els.supabaseAnonKey.value = config.anonKey || '';
  }

  function onConfigSubmit(event) {
    event.preventDefault();
    var config = normalizeConfig({
      url: els.supabaseUrl.value,
      anonKey: els.supabaseAnonKey.value
    });

    if (!hasConfig(config)) {
      setAuthStatus('Both Supabase fields are required.', 'error');
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    connectSupabase(config);
  }

  function clearConfig() {
    localStorage.removeItem(STORAGE_KEY);
    unsubscribeAuthListener();
    state.supabase = null;
    state.session = null;
    state.profile = null;
    fillConfigForm({ url: '', anonKey: '' });
    showAuth();
    setAuthStatus('Saved Supabase connection cleared.', 'success');
  }

  async function connectSupabase(config, options) {
    options = options || {};
    setAuthStatus(options.silent ? 'Connecting to Supabase...' : 'Checking Supabase connection...', 'neutral');

    try {
      unsubscribeAuthListener();
      var supabaseModule = await import(SUPABASE_CDN);
      state.supabase = supabaseModule.createClient(config.url, config.anonKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true
        }
      });

      var listener = state.supabase.auth.onAuthStateChange(function (_event, session) {
        handleSession(session);
      });
      state.authListener = listener.data.subscription;

      var sessionResult = await state.supabase.auth.getSession();
      if (sessionResult.error) {
        throw sessionResult.error;
      }

      if (sessionResult.data.session) {
        await handleSession(sessionResult.data.session);
      } else {
        showAuth();
        setAuthStatus('Supabase is connected. Sign in with an authorized admin user.', 'success');
      }
    } catch (error) {
      showAuth();
      setAuthStatus('Supabase connection failed: ' + getErrorMessage(error), 'error');
    }
  }

  async function onLoginSubmit(event) {
    event.preventDefault();
    var config = loadConfig();

    if (!hasConfig(config)) {
      setAuthStatus('Save the Supabase project connection before signing in.', 'error');
      return;
    }

    if (!state.supabase) {
      await connectSupabase(config, { silent: true });
    }

    if (!state.supabase) {
      return;
    }

    setAuthStatus('Signing in...', 'neutral');

    try {
      var result = await state.supabase.auth.signInWithPassword({
        email: els.adminEmail.value.trim(),
        password: els.adminPassword.value
      });

      if (result.error) {
        throw result.error;
      }

      await handleSession(result.data.session);
    } catch (error) {
      setAuthStatus('Sign in failed: ' + getErrorMessage(error), 'error');
    }
  }

  async function handleSession(session) {
    state.session = session;

    if (!session || !session.user) {
      showAuth();
      return;
    }

    try {
      var profileResult = await state.supabase
        .from('admin_profiles')
        .select('id,email,role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileResult.error) {
        throw profileResult.error;
      }

      if (!profileResult.data || profileResult.data.role !== 'admin') {
        await state.supabase.auth.signOut();
        showAuth();
        setAuthStatus('Signed in user is not listed as an admin in admin_profiles.', 'error');
        return;
      }

      state.profile = profileResult.data;

      if (!isDashboardPage()) {
        redirectToDashboard();
        return;
      }

      showDashboard();
      await loadDashboardData();
    } catch (error) {
      showAuth();
      setAuthStatus('Admin verification failed: ' + getErrorMessage(error), 'error');
    }
  }

  async function signOut() {
    if (!state.supabase) {
      return;
    }

    await state.supabase.auth.signOut();
    state.session = null;
    state.profile = null;
    redirectToLogin();
  }

  function unsubscribeAuthListener() {
    if (state.authListener && typeof state.authListener.unsubscribe === 'function') {
      state.authListener.unsubscribe();
    }
    state.authListener = null;
  }

  function showAuth() {
    if (isDashboardPage()) {
      redirectToLogin();
      return;
    }

    if (els.authView) {
      els.authView.hidden = false;
    }

    if (els.dashboardView) {
      els.dashboardView.hidden = true;
    }

    if (els.dashboardLoading) {
      els.dashboardLoading.hidden = true;
    }
  }

  function showDashboard() {
    if (!isDashboardPage()) {
      redirectToDashboard();
      return;
    }

    if (els.authView) {
      els.authView.hidden = true;
    }

    if (els.dashboardLoading) {
      els.dashboardLoading.hidden = true;
    }

    if (els.dashboardView) {
      els.dashboardView.hidden = false;
    }

    if (els.adminUserEmail) {
      els.adminUserEmail.textContent = (state.profile && state.profile.email) || (state.session && state.session.user.email) || 'Admin';
    }

    setView(state.activeView || 'overview');
  }

  function setView(view) {
    state.activeView = view;
    var titles = {
      overview: 'Overview',
      listings: 'Listings',
      content: 'Site Content'
    };

    if (els.viewTitle) {
      els.viewTitle.textContent = titles[view] || 'Overview';
    }

    Object.keys(els.panels).forEach(function (key) {
      if (els.panels[key]) {
        els.panels[key].hidden = key !== view;
      }
    });

    els.navTabs.forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.view === view);
    });
  }

  async function loadDashboardData() {
    if (!state.supabase || !state.profile) {
      return;
    }

    setDashboardStatus('Refreshing dashboard data...', 'neutral');

    try {
      await Promise.all([loadListings(), loadContentBlocks()]);
      renderDashboard();
      setDashboardStatus('Dashboard updated.', 'success');
    } catch (error) {
      setDashboardStatus('Could not load dashboard data: ' + getErrorMessage(error), 'error');
    }
  }

  async function loadListings() {
    var result = await state.supabase
      .from('site_listings')
      .select('id,slug,name,description,price,discount,discount_mode,discount_starts_at,discount_ends_at,inventory_quantity,inventory_status,inventory_note,visible,photo_urls,sort_order,updated_at')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (result.error) {
      throw result.error;
    }

    state.listings = result.data || [];
  }

  async function loadContentBlocks() {
    var result = await state.supabase
      .from('site_content_blocks')
      .select('id,key,label,value,block_type,updated_at')
      .order('key', { ascending: true });

    if (result.error) {
      throw result.error;
    }

    state.contentBlocks = result.data || [];
  }

  function renderDashboard() {
    renderStats();
    renderListingsTable();
    renderContentTable();

    var listingId = document.getElementById('listingId');
    if (listingId && !listingId.value) {
      fillListingForm();
    }

    var contentId = document.getElementById('contentId');
    if (contentId && !contentId.value) {
      fillContentForm();
    }
  }

  function renderStats() {
    if (!els.statsGrid) {
      return;
    }

    var totalListings = state.listings.length;
    var visibleListings = state.listings.filter(function (item) { return item.visible; }).length;
    var activeDiscounts = state.listings.filter(isDiscountActive).length;
    var inventoryUnits = state.listings.reduce(function (sum, item) {
      return sum + Number(item.inventory_quantity || 0);
    }, 0);
    var lowStock = state.listings.filter(function (item) {
      return item.inventory_status === 'low_stock' || item.inventory_status === 'out_of_stock';
    }).length;

    var cards = [
      { label: 'Total listings', value: totalListings },
      { label: 'Visible', value: visibleListings },
      { label: 'Inventory units', value: inventoryUnits },
      { label: 'Discounts', value: activeDiscounts },
      { label: 'Low or out', value: lowStock }
    ];

    els.statsGrid.innerHTML = '';
    cards.forEach(function (card) {
      var article = document.createElement('article');
      article.className = 'stat-card';

      var label = document.createElement('span');
      label.textContent = card.label;

      var value = document.createElement('strong');
      value.textContent = String(card.value);

      article.appendChild(label);
      article.appendChild(value);
      els.statsGrid.appendChild(article);
    });

    els.inventoryBadge.textContent = inventoryUnits + ' units';
    renderMiniList(
      els.inventoryList,
      state.listings.slice().sort(function (a, b) {
        return Number(a.inventory_quantity || 0) - Number(b.inventory_quantity || 0);
      }).slice(0, 5),
      function (item) {
        return {
          title: item.name,
          meta: statusLabel(item.inventory_status) + ' / ' + Number(item.inventory_quantity || 0) + ' units',
          value: item.visible ? 'Visible' : 'Hidden'
        };
      },
      'No inventory records yet.'
    );

    var discountItems = state.listings.filter(function (item) {
      return isDiscountActive(item);
    });
    els.discountBadge.textContent = discountItems.length + ' active';
    renderMiniList(
      els.discountList,
      discountItems,
      function (item) {
        return {
          title: item.name,
          meta: formatCurrency(Number(item.price || 0)) + ' -> ' + formatCurrency(discountedPrice(item)) + ' / ' + discountWindowLabel(item),
          value: Number(item.discount || 0) + '% off'
        };
      },
      'No active discounts.'
    );
  }

  function renderMiniList(container, items, mapper, emptyText) {
    if (!container) {
      return;
    }

    container.innerHTML = '';

    if (!items.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = emptyText;
      container.appendChild(empty);
      return;
    }

    items.forEach(function (item) {
      var mapped = mapper(item);
      var row = document.createElement('div');
      row.className = 'mini-item';

      var copy = document.createElement('div');
      var title = document.createElement('strong');
      var meta = document.createElement('span');
      title.textContent = mapped.title;
      meta.textContent = mapped.meta;
      copy.appendChild(title);
      copy.appendChild(meta);

      var value = document.createElement('span');
      value.textContent = mapped.value;

      row.appendChild(copy);
      row.appendChild(value);
      container.appendChild(row);
    });
  }

  function renderListingsTable() {
    if (!els.listingsTableBody) {
      return;
    }

    els.listingsTableBody.innerHTML = '';

    if (!state.listings.length) {
      appendEmptyRow(els.listingsTableBody, 6, 'No listings yet. Add the first product or service.');
      return;
    }

    state.listings.forEach(function (listing) {
      var row = document.createElement('tr');
      row.dataset.id = listing.id;

      var listingCell = document.createElement('td');
      var listingWrap = document.createElement('div');
      listingWrap.className = 'listing-cell';

      var thumb = document.createElement('img');
      thumb.className = 'listing-thumb';
      thumb.alt = '';
      thumb.loading = 'lazy';
      thumb.src = firstPhoto(listing) || '../assets/pureform-body-brush.webp';

      var copy = document.createElement('div');
      var title = document.createElement('span');
      title.className = 'listing-title';
      title.textContent = listing.name;
      var meta = document.createElement('span');
      meta.className = 'listing-meta';
      meta.textContent = listing.slug;
      copy.appendChild(title);
      copy.appendChild(meta);

      listingWrap.appendChild(thumb);
      listingWrap.appendChild(copy);
      listingCell.appendChild(listingWrap);

      var priceCell = document.createElement('td');
      var priceStack = document.createElement('div');
      priceStack.className = 'price-stack';
      var basePrice = document.createElement('strong');
      basePrice.textContent = formatCurrency(discountedPrice(listing));
      priceStack.appendChild(basePrice);

      if (isDiscountActive(listing)) {
        var oldPrice = document.createElement('span');
        oldPrice.textContent = formatCurrency(Number(listing.price || 0)) + ' before discount';
        priceStack.appendChild(oldPrice);
      } else {
        var noDiscount = document.createElement('span');
        noDiscount.textContent = 'No active discount';
        priceStack.appendChild(noDiscount);
      }

      priceCell.appendChild(priceStack);

      var discountCell = document.createElement('td');
      var discountInput = document.createElement('input');
      discountInput.className = 'quick-input';
      discountInput.type = 'number';
      discountInput.min = '0';
      discountInput.max = '100';
      discountInput.step = '0.01';
      discountInput.value = normalizeNumber(listing.discount);
      discountInput.dataset.action = 'quick-discount';
      discountInput.setAttribute('aria-label', 'Discount percent for ' + listing.name);
      discountCell.appendChild(discountInput);

      var stockCell = document.createElement('td');
      var stockInput = document.createElement('input');
      stockInput.className = 'quick-input';
      stockInput.type = 'number';
      stockInput.min = '0';
      stockInput.step = '1';
      stockInput.value = String(Number(listing.inventory_quantity || 0));
      stockInput.dataset.action = 'quick-stock';
      stockInput.setAttribute('aria-label', 'Inventory quantity for ' + listing.name);
      stockCell.appendChild(stockInput);

      var visibleCell = document.createElement('td');
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'toggle-button' + (listing.visible ? ' is-on' : '');
      toggle.dataset.action = 'toggle-visible';
      toggle.textContent = listing.visible ? 'Shown' : 'Hidden';
      toggle.setAttribute('aria-pressed', listing.visible ? 'true' : 'false');
      toggle.setAttribute('aria-label', 'Toggle visibility for ' + listing.name);
      visibleCell.appendChild(toggle);

      var actionsCell = document.createElement('td');
      var actionRow = document.createElement('div');
      actionRow.className = 'action-row';
      actionRow.appendChild(actionButton('Edit', 'edit-listing'));
      actionRow.appendChild(actionButton('Delete', 'delete-listing', 'danger'));
      actionsCell.appendChild(actionRow);

      row.appendChild(listingCell);
      row.appendChild(priceCell);
      row.appendChild(discountCell);
      row.appendChild(stockCell);
      row.appendChild(visibleCell);
      row.appendChild(actionsCell);
      els.listingsTableBody.appendChild(row);
    });
  }

  function renderContentTable() {
    if (!els.contentTableBody) {
      return;
    }

    els.contentTableBody.innerHTML = '';

    if (!state.contentBlocks.length) {
      appendEmptyRow(els.contentTableBody, 5, 'No content blocks yet.');
      return;
    }

    state.contentBlocks.forEach(function (block) {
      var row = document.createElement('tr');
      row.dataset.id = block.id;

      row.appendChild(textCell(block.key));
      row.appendChild(textCell(block.label));
      row.appendChild(textCell(block.block_type.replace('_', ' ')));
      row.appendChild(textCell(formatDate(block.updated_at)));

      var actionsCell = document.createElement('td');
      var actionRow = document.createElement('div');
      actionRow.className = 'action-row';
      actionRow.appendChild(actionButton('Edit', 'edit-content'));
      actionRow.appendChild(actionButton('Delete', 'delete-content', 'danger'));
      actionsCell.appendChild(actionRow);
      row.appendChild(actionsCell);

      els.contentTableBody.appendChild(row);
    });
  }

  function actionButton(label, action, variant) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'text-button' + (variant ? ' ' + variant : '');
    button.dataset.action = action;
    button.textContent = label;
    return button;
  }

  function textCell(value) {
    var cell = document.createElement('td');
    cell.textContent = value || '';
    return cell;
  }

  function appendEmptyRow(tbody, colSpan, text) {
    var row = document.createElement('tr');
    var cell = document.createElement('td');
    cell.colSpan = colSpan;
    cell.textContent = text;
    row.appendChild(cell);
    tbody.appendChild(row);
  }

  async function onListingsTableClick(event) {
    var button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    var listing = findListing(button.closest('tr').dataset.id);
    if (!listing) {
      return;
    }

    if (button.dataset.action === 'edit-listing') {
      fillListingForm(listing);
      return;
    }

    if (button.dataset.action === 'toggle-visible') {
      await updateListing(listing.id, { visible: !listing.visible }, 'Visibility updated.');
      return;
    }

    if (button.dataset.action === 'delete-listing') {
      fillListingForm(listing);
      await onDeleteListing();
    }
  }

  async function onListingsTableChange(event) {
    var input = event.target;
    if (!input.dataset.action) {
      return;
    }

    var listing = findListing(input.closest('tr').dataset.id);
    if (!listing) {
      return;
    }

    if (input.dataset.action === 'quick-stock') {
      await updateListing(listing.id, {
        inventory_quantity: Math.max(0, parseInteger(input.value))
      }, 'Inventory updated.');
    }

    if (input.dataset.action === 'quick-discount') {
      await updateListing(listing.id, {
        discount: clamp(parseDecimal(input.value), 0, 100)
      }, 'Discount updated.');
    }
  }

  async function onListingSubmit(event) {
    event.preventDefault();

    var payload = collectListingPayload();
    var id = document.getElementById('listingId').value;

    try {
      setDashboardStatus('Saving listing...', 'neutral');
      var result = id
        ? await state.supabase.from('site_listings').update(payload).eq('id', id).select().single()
        : await state.supabase.from('site_listings').insert(payload).select().single();

      if (result.error) {
        throw result.error;
      }

      await loadListings();
      renderDashboard();
      fillListingForm(result.data);
      setDashboardStatus('Listing saved.', 'success');
    } catch (error) {
      setDashboardStatus('Listing save failed: ' + getErrorMessage(error), 'error');
    }
  }

  async function onDeleteListing() {
    var id = document.getElementById('listingId').value;
    if (!id) {
      return;
    }

    var listing = findListing(id);
    if (!listing || !window.confirm('Delete "' + listing.name + '"? This cannot be undone.')) {
      return;
    }

    try {
      setDashboardStatus('Deleting listing...', 'neutral');
      var result = await state.supabase.from('site_listings').delete().eq('id', id);
      if (result.error) {
        throw result.error;
      }

      await loadListings();
      renderDashboard();
      fillListingForm();
      setDashboardStatus('Listing deleted.', 'success');
    } catch (error) {
      setDashboardStatus('Listing delete failed: ' + getErrorMessage(error), 'error');
    }
  }

  async function updateListing(id, payload, successMessage) {
    try {
      setDashboardStatus('Updating listing...', 'neutral');
      var result = await state.supabase.from('site_listings').update(payload).eq('id', id);
      if (result.error) {
        throw result.error;
      }

      await loadListings();
      renderDashboard();
      setDashboardStatus(successMessage || 'Listing updated.', 'success');
    } catch (error) {
      setDashboardStatus('Listing update failed: ' + getErrorMessage(error), 'error');
      renderListingsTable();
    }
  }

  function fillListingForm(listing) {
    var isExisting = Boolean(listing);
    document.getElementById('listingId').value = isExisting ? listing.id : '';
    document.getElementById('listingName').value = isExisting ? listing.name : '';
    document.getElementById('listingSlug').value = isExisting ? listing.slug : '';
    document.getElementById('listingDescription').value = isExisting ? listing.description : '';
    document.getElementById('listingPrice').value = isExisting ? normalizeNumber(listing.price) : '87.78';
    document.getElementById('listingDiscount').value = isExisting ? normalizeNumber(listing.discount) : '0';
    document.getElementById('listingDiscountMode').value = isExisting ? listing.discount_mode || 'ongoing' : 'ongoing';
    document.getElementById('listingDiscountStartsAt').value = isExisting ? toDateTimeLocal(listing.discount_starts_at) : '';
    document.getElementById('listingDiscountEndsAt').value = isExisting ? toDateTimeLocal(listing.discount_ends_at) : '';
    document.getElementById('listingInventory').value = isExisting ? String(Number(listing.inventory_quantity || 0)) : '0';
    document.getElementById('listingStatus').value = isExisting ? listing.inventory_status : 'in_stock';
    document.getElementById('listingInventoryNote').value = isExisting ? listing.inventory_note || '' : '';
    document.getElementById('listingVisible').checked = isExisting ? Boolean(listing.visible) : true;
    document.getElementById('listingSortOrder').value = isExisting ? String(Number(listing.sort_order || 0)) : String(nextSortOrder());
    document.getElementById('listingPhotos').value = isExisting ? (listing.photo_urls || []).join('\n') : '';
    els.listingFormTitle.textContent = isExisting ? 'Edit listing' : 'New listing';
    els.deleteListingButton.hidden = !isExisting;
    renderPhotoPreviewFromForm();
    renderPricePreview();
  }

  function collectListingPayload() {
    var price = Math.max(0, parseDecimal(document.getElementById('listingPrice').value));
    var discount = clamp(parseDecimal(document.getElementById('listingDiscount').value), 0, 100);

    return {
      name: document.getElementById('listingName').value.trim(),
      slug: document.getElementById('listingSlug').value.trim(),
      description: document.getElementById('listingDescription').value.trim(),
      price: price,
      discount: discount,
      discount_mode: document.getElementById('listingDiscountMode').value,
      discount_starts_at: fromDateTimeLocal(document.getElementById('listingDiscountStartsAt').value),
      discount_ends_at: document.getElementById('listingDiscountMode').value === 'ongoing'
        ? null
        : fromDateTimeLocal(document.getElementById('listingDiscountEndsAt').value),
      inventory_quantity: Math.max(0, parseInteger(document.getElementById('listingInventory').value)),
      inventory_status: document.getElementById('listingStatus').value,
      inventory_note: document.getElementById('listingInventoryNote').value.trim(),
      visible: document.getElementById('listingVisible').checked,
      sort_order: parseInteger(document.getElementById('listingSortOrder').value),
      photo_urls: parsePhotoUrls(document.getElementById('listingPhotos').value)
    };
  }

  function maybeFillSlug() {
    var id = document.getElementById('listingId').value;
    var slugInput = document.getElementById('listingSlug');
    if (id || slugInput.value.trim()) {
      return;
    }

    slugInput.value = slugify(document.getElementById('listingName').value);
  }

  function renderPhotoPreviewFromForm() {
    var photosInput = document.getElementById('listingPhotos');
    if (!photosInput || !els.listingPhotoPreview) {
      return;
    }

    var urls = parsePhotoUrls(photosInput.value).slice(0, 6);
    els.listingPhotoPreview.innerHTML = '';

    urls.forEach(function (url) {
      var img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.loading = 'lazy';
      els.listingPhotoPreview.appendChild(img);
    });
  }

  function renderPricePreview() {
    var preview = document.getElementById('listingPricePreview');
    var priceInput = document.getElementById('listingPrice');
    var discountInput = document.getElementById('listingDiscount');
    var modeInput = document.getElementById('listingDiscountMode');
    var startsInput = document.getElementById('listingDiscountStartsAt');
    var endsInput = document.getElementById('listingDiscountEndsAt');

    if (!preview || !priceInput || !discountInput || !modeInput) {
      return;
    }

    var listing = {
      price: Math.max(0, parseDecimal(priceInput.value)),
      discount: clamp(parseDecimal(discountInput.value), 0, 100),
      discount_mode: modeInput.value || 'ongoing',
      discount_starts_at: fromDateTimeLocal(startsInput ? startsInput.value : ''),
      discount_ends_at: fromDateTimeLocal(endsInput ? endsInput.value : '')
    };

    var active = isDiscountActive(listing);
    preview.innerHTML = '';

    var base = document.createElement('span');
    base.textContent = 'Base: ' + formatCurrency(listing.price);

    var sale = document.createElement('strong');
    sale.textContent = active
      ? 'Active price: ' + formatCurrency(discountedPrice(listing))
      : 'No active discount';

    var windowText = document.createElement('span');
    windowText.textContent = discountWindowLabel(listing);

    preview.appendChild(base);
    preview.appendChild(sale);
    preview.appendChild(windowText);
  }

  async function onContentTableClick(event) {
    var button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    var block = findContentBlock(button.closest('tr').dataset.id);
    if (!block) {
      return;
    }

    if (button.dataset.action === 'edit-content') {
      fillContentForm(block);
      return;
    }

    if (button.dataset.action === 'delete-content') {
      fillContentForm(block);
      await onDeleteContent();
    }
  }

  async function onContentSubmit(event) {
    event.preventDefault();

    var payload = {
      key: document.getElementById('contentKey').value.trim(),
      label: document.getElementById('contentLabel').value.trim(),
      block_type: document.getElementById('contentType').value,
      value: document.getElementById('contentValue').value
    };

    if (payload.block_type === 'json') {
      try {
        JSON.parse(payload.value || '{}');
      } catch (error) {
        setDashboardStatus('Content value is not valid JSON.', 'error');
        return;
      }
    }

    var id = document.getElementById('contentId').value;

    try {
      setDashboardStatus('Saving content block...', 'neutral');
      var result = id
        ? await state.supabase.from('site_content_blocks').update(payload).eq('id', id).select().single()
        : await state.supabase.from('site_content_blocks').insert(payload).select().single();

      if (result.error) {
        throw result.error;
      }

      await loadContentBlocks();
      renderDashboard();
      fillContentForm(result.data);
      setDashboardStatus('Content block saved.', 'success');
    } catch (error) {
      setDashboardStatus('Content save failed: ' + getErrorMessage(error), 'error');
    }
  }

  async function onDeleteContent() {
    var id = document.getElementById('contentId').value;
    if (!id) {
      return;
    }

    var block = findContentBlock(id);
    if (!block || !window.confirm('Delete content block "' + block.key + '"?')) {
      return;
    }

    try {
      setDashboardStatus('Deleting content block...', 'neutral');
      var result = await state.supabase.from('site_content_blocks').delete().eq('id', id);
      if (result.error) {
        throw result.error;
      }

      await loadContentBlocks();
      renderDashboard();
      fillContentForm();
      setDashboardStatus('Content block deleted.', 'success');
    } catch (error) {
      setDashboardStatus('Content delete failed: ' + getErrorMessage(error), 'error');
    }
  }

  function fillContentForm(block) {
    var isExisting = Boolean(block);
    document.getElementById('contentId').value = isExisting ? block.id : '';
    document.getElementById('contentKey').value = isExisting ? block.key : '';
    document.getElementById('contentLabel').value = isExisting ? block.label : '';
    document.getElementById('contentType').value = isExisting ? block.block_type : 'text';
    document.getElementById('contentValue').value = isExisting ? block.value : '';
    els.contentFormTitle.textContent = isExisting ? 'Edit block' : 'New block';
    els.deleteContentButton.hidden = !isExisting;
  }

  function findListing(id) {
    return state.listings.find(function (item) {
      return item.id === id;
    });
  }

  function findContentBlock(id) {
    return state.contentBlocks.find(function (item) {
      return item.id === id;
    });
  }

  function nextSortOrder() {
    return state.listings.reduce(function (max, item) {
      return Math.max(max, Number(item.sort_order || 0));
    }, 0) + 10;
  }

  function firstPhoto(listing) {
    return listing && Array.isArray(listing.photo_urls) && listing.photo_urls.length
      ? listing.photo_urls[0]
      : '';
  }

  function parsePhotoUrls(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map(function (url) { return url.trim(); })
      .filter(Boolean);
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function parseDecimal(value) {
    var number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : 0;
  }

  function parseInteger(value) {
    var number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? number : 0;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeNumber(value) {
    var number = Number(value || 0);
    return Number.isInteger(number) ? String(number) : number.toFixed(2);
  }

  function isDiscountActive(listing) {
    var discount = Number(listing && listing.discount ? listing.discount : 0);
    if (!discount) {
      return false;
    }

    if ((listing.discount_mode || 'ongoing') === 'ongoing') {
      return true;
    }

    var now = Date.now();
    var startsAt = listing.discount_starts_at ? new Date(listing.discount_starts_at).getTime() : null;
    var endsAt = listing.discount_ends_at ? new Date(listing.discount_ends_at).getTime() : null;

    if (startsAt && now < startsAt) {
      return false;
    }

    if (endsAt && now > endsAt) {
      return false;
    }

    return true;
  }

  function discountedPrice(listing) {
    var price = Number(listing && listing.price ? listing.price : 0);
    if (!isDiscountActive(listing)) {
      return price;
    }

    var discount = clamp(Number(listing.discount || 0), 0, 100);
    return Math.max(0, price * (1 - discount / 100));
  }

  function discountWindowLabel(listing) {
    if (!Number(listing && listing.discount ? listing.discount : 0)) {
      return 'No discount configured';
    }

    if ((listing.discount_mode || 'ongoing') === 'ongoing') {
      return 'Ongoing, no end date';
    }

    var starts = listing.discount_starts_at ? formatDateTime(listing.discount_starts_at) : 'Now';
    var ends = listing.discount_ends_at ? formatDateTime(listing.discount_ends_at) : 'No end date';
    return starts + ' to ' + ends;
  }

  function toDateTimeLocal(value) {
    if (!value) {
      return '';
    }

    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    var offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function fromDateTimeLocal(value) {
    if (!value) {
      return null;
    }

    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function statusLabel(value) {
    return String(value || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, function (letter) {
        return letter.toUpperCase();
      });
  }

  function formatCurrency(value) {
    return 'AED ' + Number(value || 0).toLocaleString('en-AE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatDate(value) {
    if (!value) {
      return '';
    }

    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(value));
  }

  function formatDateTime(value) {
    if (!value) {
      return '';
    }

    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }

  function setAuthStatus(message, type) {
    setStatus(els.authStatus, message, type);
  }

  function setDashboardStatus(message, type) {
    setStatus(els.dashboardStatus, message, type);
  }

  function setStatus(element, message, type) {
    if (!element) {
      return;
    }

    element.textContent = message || '';
    element.classList.toggle('is-error', type === 'error');
    element.classList.toggle('is-success', type === 'success');
  }

  function getErrorMessage(error) {
    return error && error.message ? error.message : String(error || 'Unknown error');
  }

  function isDashboardPage() {
    return state.page === 'dashboard';
  }

  function redirectToDashboard() {
    var url = new URL('dashboard.html', window.location.href);
    window.location.href = url.href;
  }

  function redirectToLogin() {
    var url = new URL('index.html', window.location.href);
    window.location.href = url.href;
  }
})();
