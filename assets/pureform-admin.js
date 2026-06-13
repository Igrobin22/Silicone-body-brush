(function () {
  'use strict';

  var SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  var STORAGE_KEY = 'pureform.admin.supabase';
  var DEFAULT_CONFIG = window.PUREFORM_SUPABASE_CONFIG || {};
  var OFFICIAL_SLUG_BY_COLOR = {
    grey: 'pureform-4pc-set-grey',
    black: 'pureform-4pc-set-black',
    pink: 'pureform-4pc-set-pink'
  };
  var ORDER_STATUS_OPTIONS = ['new', 'confirmed', 'packing', 'shipped', 'completed', 'cancelled'];
  var PAYMENT_STATUS_OPTIONS = ['pending', 'cod_pending', 'payment_link_sent', 'paid', 'refunded', 'cancelled'];
  var FULFILLMENT_STATUS_OPTIONS = ['unfulfilled', 'reserved', 'packed', 'shipped', 'delivered', 'cancelled'];
  var VALID_ADMIN_VIEWS = ['overview', 'orders', 'listings', 'content'];

  var state = {
    supabase: null,
    authListener: null,
    session: null,
    profile: null,
    listings: [],
    orders: [],
    orderFilter: 'all',
    ordersUnavailable: false,
    contentBlocks: [],
    activeView: 'overview',
    page: 'login'
  };

  var els = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    collectElements();
    state.page = document.body.dataset.adminPage || (els.dashboardView && !els.authView ? 'dashboard' : 'login');
    state.activeView = getRouteState().view;
    document.body.classList.toggle('has-default-supabase-config', hasConfig(DEFAULT_CONFIG));
    bindEvents();
    setView(state.activeView, { skipRoute: true });
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
      orders: document.getElementById('ordersPanel'),
      listings: document.getElementById('listingsPanel'),
      content: document.getElementById('contentPanel')
    };
    els.statsGrid = document.getElementById('statsGrid');
    els.inventoryBadge = document.getElementById('inventoryBadge');
    els.inventoryList = document.getElementById('inventoryList');
    els.discountBadge = document.getElementById('discountBadge');
    els.discountList = document.getElementById('discountList');
    els.recentOrdersBadge = document.getElementById('recentOrdersBadge');
    els.recentOrdersList = document.getElementById('recentOrdersList');
    els.orderFilterTabs = Array.prototype.slice.call(document.querySelectorAll('[data-order-filter]'));
    els.ordersTableBody = document.getElementById('ordersTableBody');
    els.orderForm = document.getElementById('orderForm');
    els.orderFormTitle = document.getElementById('orderFormTitle');
    els.orderDetailSummary = document.getElementById('orderDetailSummary');
    els.orderItemsList = document.getElementById('orderItemsList');
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
      button.addEventListener('click', function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) {
          return;
        }

        event.preventDefault();
        setView(button.dataset.view, { push: true });
      });
    });

    window.addEventListener('popstate', function () {
      var route = getRouteState();
      setView(route.view, { skipRoute: true });
      applyRouteSelection(route);
    });

    els.orderFilterTabs.forEach(function (button) {
      button.addEventListener('click', function () {
        state.orderFilter = button.dataset.orderFilter || 'all';
        renderOrdersTable();
        syncOrderFilterTabs();
      });
    });

    bind(els.ordersTableBody, 'click', onOrdersTableClick);
    bind(els.ordersTableBody, 'change', onOrdersTableChange);
    bind(els.orderForm, 'submit', onOrderSubmit);

    bind(els.newListingButton, 'click', function () {
      fillListingForm();
      setView('listings', { push: true, action: 'new' });
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
      setView('content', { push: true, action: 'new' });
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

    setView(getRouteState().view, { skipRoute: true });
  }

  function setView(view, options) {
    options = options || {};
    view = normalizeView(view);
    state.activeView = view;
    var titles = {
      overview: 'Overview',
      orders: 'Orders',
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
      if (button.dataset.view === view) {
        button.setAttribute('aria-current', 'page');
      } else {
        button.removeAttribute('aria-current');
      }
    });

    if (!options.skipRoute) {
      updateAdminRoute(Object.assign({}, options, { view: view }));
    }
  }

  function normalizeView(view) {
    return VALID_ADMIN_VIEWS.indexOf(view) !== -1 ? view : 'overview';
  }

  function getRouteState() {
    var params = new URLSearchParams(window.location.search);
    return {
      view: normalizeView(params.get('view') || 'overview'),
      order: params.get('order') || '',
      listing: params.get('listing') || '',
      block: params.get('block') || '',
      action: params.get('action') || ''
    };
  }

  function updateAdminRoute(options) {
    if (!isDashboardPage()) {
      return;
    }

    var nextUrl = new URL(window.location.href);
    var view = normalizeView(options.view);
    nextUrl.search = '';

    if (view !== 'overview') {
      nextUrl.searchParams.set('view', view);
    }

    if (options.order) {
      nextUrl.searchParams.set('order', options.order);
    }

    if (options.listing) {
      nextUrl.searchParams.set('listing', options.listing);
    }

    if (options.block) {
      nextUrl.searchParams.set('block', options.block);
    }

    if (options.action) {
      nextUrl.searchParams.set('action', options.action);
    }

    if (nextUrl.href === window.location.href) {
      return;
    }

    if (options.replace) {
      window.history.replaceState({ view: view }, '', nextUrl.href);
    } else {
      window.history.pushState({ view: view }, '', nextUrl.href);
    }
  }

  function applyRouteSelection(route) {
    route = route || getRouteState();
    setView(route.view, { skipRoute: true });

    if (route.view === 'orders') {
      fillOrderForm(route.order ? findOrder(route.order) : state.orders[0]);
      return;
    }

    if (route.view === 'listings') {
      fillListingForm(route.action === 'new' ? null : findListing(route.listing));
      return;
    }

    if (route.view === 'content') {
      fillContentForm(route.action === 'new' ? null : findContentBlock(route.block));
      return;
    }

    if (document.getElementById('orderId') && !document.getElementById('orderId').value) {
      fillOrderForm(state.orders[0]);
    }

    if (document.getElementById('listingId') && !document.getElementById('listingId').value) {
      fillListingForm();
    }

    if (document.getElementById('contentId') && !document.getElementById('contentId').value) {
      fillContentForm();
    }
  }

  async function loadDashboardData() {
    if (!state.supabase || !state.profile) {
      return;
    }

    setDashboardStatus('Refreshing dashboard data...', 'neutral');

    try {
      await Promise.all([loadListings(), loadOrders(), loadContentBlocks()]);
      renderDashboard();
      if (state.ordersUnavailable) {
        setDashboardStatus('Dashboard updated. Run the updated Supabase SQL to enable checkout order capture.', 'neutral');
      } else {
        setDashboardStatus('Dashboard updated.', 'success');
      }
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

  async function loadOrders() {
    var result = await state.supabase
      .from('site_orders')
      .select('id,order_number,status,payment_status,fulfillment_status,contact,phone,first_name,last_name,country,address,apartment,city,emirate,payment_preference,discount_code,customer_notes,admin_notes,line_items,subtotal,total,currency,source,created_at,updated_at')
      .order('created_at', { ascending: false });

    if (result.error) {
      if (isMissingOrdersTableError(result.error)) {
        state.orders = [];
        state.ordersUnavailable = true;
        return;
      }

      throw result.error;
    }

    state.orders = result.data || [];
    state.ordersUnavailable = false;
  }

  function renderDashboard() {
    renderStats();
    renderOrdersTable();
    renderListingsTable();
    renderContentTable();
    applyRouteSelection();
  }

  function renderStats() {
    if (!els.statsGrid) {
      return;
    }

    var totalListings = state.listings.length;
    var totalOrders = state.orders.length;
    var newOrders = state.orders.filter(function (order) { return order.status === 'new'; }).length;
    var openOrders = state.orders.filter(isOpenOrder).length;
    var orderRevenue = state.orders.reduce(function (sum, order) {
      return order.status === 'cancelled' ? sum : sum + Number(order.total || 0);
    }, 0);
    var activeDiscounts = state.listings.filter(isDiscountActive).length;
    var inventoryUnits = state.listings.reduce(function (sum, item) {
      return sum + Number(item.inventory_quantity || 0);
    }, 0);
    var lowStock = state.listings.filter(function (item) {
      return item.inventory_status === 'low_stock' || item.inventory_status === 'out_of_stock';
    }).length;

    var cards = [
      { label: 'New orders', value: newOrders },
      { label: 'Open orders', value: openOrders },
      { label: 'Revenue', value: formatCurrency(orderRevenue) },
      { label: 'Listings', value: totalListings },
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

    if (els.recentOrdersBadge) {
      els.recentOrdersBadge.textContent = totalOrders + ' total';
    }

    renderMiniList(
      els.recentOrdersList,
      state.orders.slice(0, 5),
      function (order) {
        return {
          title: orderNumber(order),
          meta: customerName(order) + ' / ' + itemSummary(order),
          value: formatCurrency(order.total)
        };
      },
      state.ordersUnavailable ? 'Run the updated Supabase SQL to create the orders table.' : 'No customer orders yet.'
    );

    if (els.inventoryBadge) {
      els.inventoryBadge.textContent = inventoryUnits + ' units';
    }
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
    if (els.discountBadge) {
      els.discountBadge.textContent = discountItems.length + ' active';
    }
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

  function syncOrderFilterTabs() {
    els.orderFilterTabs.forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.orderFilter === state.orderFilter);
    });
  }

  function filteredOrders() {
    if (state.orderFilter === 'new') {
      return state.orders.filter(function (order) { return order.status === 'new'; });
    }

    if (state.orderFilter === 'open') {
      return state.orders.filter(isOpenOrder);
    }

    if (state.orderFilter === 'completed') {
      return state.orders.filter(function (order) {
        return order.status === 'completed' || order.status === 'cancelled';
      });
    }

    return state.orders;
  }

  function isOpenOrder(order) {
    return order && order.status !== 'completed' && order.status !== 'cancelled';
  }

  function renderOrdersTable() {
    if (!els.ordersTableBody) {
      return;
    }

    var orders = filteredOrders();
    var selectedId = document.getElementById('orderId') ? document.getElementById('orderId').value : '';
    els.ordersTableBody.innerHTML = '';
    syncOrderFilterTabs();

    if (state.ordersUnavailable) {
      appendEmptyRow(els.ordersTableBody, 7, 'Orders are not available yet. Run supabase/admin-schema.sql in Supabase to create site_orders.');
      return;
    }

    if (!orders.length) {
      appendEmptyRow(els.ordersTableBody, 7, 'No orders match this view.');
      return;
    }

    orders.forEach(function (order) {
      var row = document.createElement('tr');
      row.dataset.id = order.id;
      row.className = selectedId === order.id ? 'is-selected' : '';

      var orderCell = document.createElement('td');
      var code = document.createElement('strong');
      var time = document.createElement('span');
      code.className = 'order-code';
      code.textContent = orderNumber(order);
      time.className = 'listing-meta';
      time.textContent = formatDateTime(order.created_at);
      orderCell.appendChild(code);
      orderCell.appendChild(time);

      var customerCell = document.createElement('td');
      var customer = document.createElement('div');
      var name = document.createElement('span');
      var contact = document.createElement('span');
      customer.className = 'order-customer';
      name.className = 'listing-title';
      name.textContent = customerName(order);
      contact.className = 'listing-meta';
      contact.textContent = customerContact(order);
      customer.appendChild(name);
      customer.appendChild(contact);
      customerCell.appendChild(customer);

      var itemsCell = document.createElement('td');
      itemsCell.textContent = itemSummary(order);

      var totalCell = document.createElement('td');
      totalCell.textContent = formatCurrency(order.total);

      var statusCell = document.createElement('td');
      statusCell.appendChild(orderSelect(order, 'status', ORDER_STATUS_OPTIONS, 'quick-order-status'));

      var paymentCell = document.createElement('td');
      paymentCell.appendChild(orderSelect(order, 'payment_status', PAYMENT_STATUS_OPTIONS, 'quick-payment-status'));

      var actionsCell = document.createElement('td');
      var actionRow = document.createElement('div');
      actionRow.className = 'action-row';
      actionRow.appendChild(actionButton('View', 'view-order'));
      if (order.status !== 'completed' && order.status !== 'cancelled') {
        actionRow.appendChild(actionButton('Complete', 'complete-order'));
      }
      actionsCell.appendChild(actionRow);

      row.appendChild(orderCell);
      row.appendChild(customerCell);
      row.appendChild(itemsCell);
      row.appendChild(totalCell);
      row.appendChild(statusCell);
      row.appendChild(paymentCell);
      row.appendChild(actionsCell);
      els.ordersTableBody.appendChild(row);
    });
  }

  function orderSelect(order, field, options, action) {
    var select = document.createElement('select');
    select.className = 'quick-select status-' + String(order[field] || '').replace(/_/g, '-');
    select.dataset.action = action;
    select.setAttribute('aria-label', statusLabel(field) + ' for ' + orderNumber(order));

    options.forEach(function (value) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = statusLabel(value);
      option.selected = value === order[field];
      select.appendChild(option);
    });

    return select;
  }

  async function onOrdersTableClick(event) {
    var button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    var row = button.closest('tr');
    var order = row ? findOrder(row.dataset.id) : null;
    if (!order) {
      return;
    }

    if (button.dataset.action === 'view-order') {
      fillOrderForm(order);
      setView('orders', { push: true, order: order.id });
      return;
    }

    if (button.dataset.action === 'complete-order') {
      await updateOrder(order.id, {
        status: 'completed',
        fulfillment_status: order.fulfillment_status === 'cancelled' ? 'cancelled' : 'delivered'
      }, 'Order marked complete.');
      setView('orders', { replace: true, order: order.id });
    }
  }

  async function onOrdersTableChange(event) {
    var input = event.target;
    if (!input.dataset.action) {
      return;
    }

    var row = input.closest('tr');
    var order = row ? findOrder(row.dataset.id) : null;
    if (!order) {
      return;
    }

    if (input.dataset.action === 'quick-order-status') {
      await updateOrder(order.id, { status: input.value }, 'Order status updated.');
    }

    if (input.dataset.action === 'quick-payment-status') {
      await updateOrder(order.id, { payment_status: input.value }, 'Payment status updated.');
    }
  }

  async function onOrderSubmit(event) {
    event.preventDefault();

    var id = document.getElementById('orderId').value;
    if (!id) {
      setDashboardStatus('Select an order before saving.', 'error');
      return;
    }

    await updateOrder(id, {
      status: document.getElementById('orderStatus').value,
      payment_status: document.getElementById('orderPaymentStatus').value,
      fulfillment_status: document.getElementById('orderFulfillmentStatus').value,
      admin_notes: document.getElementById('orderAdminNotes').value.trim()
    }, 'Order saved.');
    setView('orders', { replace: true, order: id });
  }

  async function updateOrder(id, payload, successMessage) {
    try {
      setDashboardStatus('Updating order...', 'neutral');
      var result = await state.supabase.from('site_orders').update(payload).eq('id', id).select().single();
      if (result.error) {
        throw result.error;
      }

      await loadOrders();
      renderStats();
      renderOrdersTable();
      fillOrderForm(findOrder(id) || result.data);
      setDashboardStatus(successMessage || 'Order updated.', 'success');
    } catch (error) {
      setDashboardStatus('Order update failed: ' + getErrorMessage(error), 'error');
      renderOrdersTable();
    }
  }

  function fillOrderForm(order) {
    var controls = [
      document.getElementById('orderStatus'),
      document.getElementById('orderPaymentStatus'),
      document.getElementById('orderFulfillmentStatus'),
      document.getElementById('orderAdminNotes')
    ];
    var saveButton = els.orderForm ? els.orderForm.querySelector('button[type="submit"]') : null;

    if (!order) {
      document.getElementById('orderId').value = '';
      els.orderFormTitle.textContent = 'Select an order';
      els.orderDetailSummary.innerHTML = state.ordersUnavailable
        ? '<p class="empty-state">Run the updated Supabase SQL before managing customer orders.</p>'
        : '<p class="empty-state">Choose an order to view customer, delivery, and line item details.</p>';
      els.orderItemsList.innerHTML = '';
      controls.forEach(function (control) {
        if (control) control.disabled = true;
      });
      if (saveButton) saveButton.disabled = true;
      renderOrdersTable();
      return;
    }

    document.getElementById('orderId').value = order.id;
    els.orderFormTitle.textContent = orderNumber(order);
    document.getElementById('orderStatus').value = order.status || 'new';
    document.getElementById('orderPaymentStatus').value = order.payment_status || 'pending';
    document.getElementById('orderFulfillmentStatus').value = order.fulfillment_status || 'unfulfilled';
    document.getElementById('orderAdminNotes').value = order.admin_notes || '';
    controls.forEach(function (control) {
      if (control) control.disabled = false;
    });
    if (saveButton) saveButton.disabled = false;
    renderOrderSummary(order);
    renderOrderItems(order);
    renderOrdersTable();
  }

  function renderOrderSummary(order) {
    var details = [
      { label: 'Customer', value: customerName(order) },
      { label: 'Contact', value: customerContact(order) },
      { label: 'Delivery', value: orderAddress(order) },
      { label: 'Payment', value: order.payment_preference || statusLabel(order.payment_status) },
      { label: 'Customer notes', value: order.customer_notes || 'None' },
      { label: 'Placed', value: formatDateTime(order.created_at) }
    ];

    els.orderDetailSummary.innerHTML = '';
    details.forEach(function (detail) {
      var item = document.createElement('div');
      var label = document.createElement('span');
      var value = document.createElement('strong');
      label.textContent = detail.label;
      value.textContent = detail.value || 'Not provided';
      item.appendChild(label);
      item.appendChild(value);
      els.orderDetailSummary.appendChild(item);
    });
  }

  function renderOrderItems(order) {
    var items = getOrderItems(order);
    els.orderItemsList.innerHTML = '';

    if (!items.length) {
      var empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No line items saved with this order.';
      els.orderItemsList.appendChild(empty);
      return;
    }

    items.forEach(function (item) {
      var row = document.createElement('div');
      var image = document.createElement('img');
      var copy = document.createElement('div');
      var title = document.createElement('strong');
      var meta = document.createElement('span');
      var total = document.createElement('b');

      row.className = 'order-item';
      image.src = item.image || '../assets/pureform-body-brush.webp';
      image.alt = '';
      image.loading = 'lazy';
      title.textContent = item.name || 'PureForm item';
      meta.textContent = (item.meta || '') + ' / Qty ' + Number(item.quantity || 1);
      total.textContent = formatCurrency(item.line_total || Number(item.price || 0) * Number(item.quantity || 1));

      copy.appendChild(title);
      copy.appendChild(meta);
      row.appendChild(image);
      row.appendChild(copy);
      row.appendChild(total);
      els.orderItemsList.appendChild(row);
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
      setView('listings', { push: true, listing: listing.id });
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
      setView('listings', { replace: true, listing: result.data.id });
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
      setView('listings', { replace: true });
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

    slugInput.value = officialSlugForName(document.getElementById('listingName').value) || slugify(document.getElementById('listingName').value);
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
      setView('content', { push: true, block: block.id });
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
      setView('content', { replace: true, block: result.data.id });
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
      setView('content', { replace: true });
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

  function findOrder(id) {
    return state.orders.find(function (item) {
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

  function getOrderItems(order) {
    return order && Array.isArray(order.line_items) ? order.line_items : [];
  }

  function orderNumber(order) {
    return order && order.order_number ? order.order_number : 'Order';
  }

  function customerName(order) {
    var firstName = String(order && order.first_name ? order.first_name : '').trim();
    var lastName = String(order && order.last_name ? order.last_name : '').trim();
    var fullName = (firstName + ' ' + lastName).trim();
    return fullName || 'Guest customer';
  }

  function customerContact(order) {
    var contact = String(order && order.contact ? order.contact : '').trim();
    var phone = String(order && order.phone ? order.phone : '').trim();

    if (contact && phone) {
      return contact + ' / ' + phone;
    }

    return contact || phone || 'No contact saved';
  }

  function orderAddress(order) {
    var parts = [
      order && order.address,
      order && order.apartment,
      order && order.city,
      order && order.emirate,
      order && order.country
    ].map(function (part) {
      return String(part || '').trim();
    }).filter(Boolean);

    return parts.length ? parts.join(', ') : 'No address saved';
  }

  function itemSummary(order) {
    var items = getOrderItems(order);
    var count = items.reduce(function (sum, item) {
      return sum + Number(item.quantity || 1);
    }, 0);

    if (!items.length) {
      return 'No items';
    }

    if (items.length === 1) {
      return count + ' x ' + (items[0].name || 'PureForm item');
    }

    return count + ' items / ' + items.length + ' products';
  }

  function isMissingOrdersTableError(error) {
    var message = getErrorMessage(error).toLowerCase();
    var code = String(error && error.code || '').toUpperCase();

    return code === 'PGRST205'
      || (message.indexOf('site_orders') !== -1 && message.indexOf('schema cache') !== -1)
      || (message.indexOf('site_orders') !== -1 && message.indexOf('not found') !== -1)
      || message.indexOf('could not find the table') !== -1;
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

  function officialSlugForName(value) {
    var name = String(value || '').toLowerCase();
    if (name.indexOf('pink') !== -1) return OFFICIAL_SLUG_BY_COLOR.pink;
    if (name.indexOf('black') !== -1) return OFFICIAL_SLUG_BY_COLOR.black;
    if (name.indexOf('grey') !== -1 || name.indexOf('gray') !== -1) return OFFICIAL_SLUG_BY_COLOR.grey;
    return '';
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
    var route = getRouteState();
    if (route.view !== 'overview') {
      url.searchParams.set('view', route.view);
    }

    if (route.order) {
      url.searchParams.set('order', route.order);
    }

    if (route.listing) {
      url.searchParams.set('listing', route.listing);
    }

    if (route.block) {
      url.searchParams.set('block', route.block);
    }

    if (route.action) {
      url.searchParams.set('action', route.action);
    }

    window.location.href = url.href;
  }

  function redirectToLogin() {
    var url = new URL('index.html', window.location.href);
    var route = getRouteState();
    if (route.view !== 'overview') {
      url.searchParams.set('view', route.view);
    }

    if (route.order) {
      url.searchParams.set('order', route.order);
    }

    if (route.listing) {
      url.searchParams.set('listing', route.listing);
    }

    if (route.block) {
      url.searchParams.set('block', route.block);
    }

    if (route.action) {
      url.searchParams.set('action', route.action);
    }

    window.location.href = url.href;
  }
})();
