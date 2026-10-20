import { confirmPaidSession, corsHeaders, database, env, isSettledSession, json, originAllowed, paymentConfigurationReady, siteUrl as configuredSiteUrl, StripeRequestError, stripeRequest, shippingForQuantity } from '../_shared/payments.ts';
import type { CheckoutSession } from '../_shared/payments.ts';

type CheckoutLine = {
  id?: string;
  quantity?: number;
};

type Listing = {
  slug: string;
  name: string;
  description: string;
  price: number;
  discount: number;
  discount_mode: string;
  discount_starts_at: string | null;
  discount_ends_at: string | null;
  inventory_quantity: number;
  inventory_status: string;
  inventory_note: string;
  photo_urls: string[] | null;
};

const officialSlugs = [
  'pureform-4pc-set-grey',
  'pureform-4pc-set-black',
  'pureform-4pc-set-pink',
];

const legacyAliases: Record<string, string> = {
  grey: 'pureform-4pc-set-grey',
  black: 'pureform-4pc-set-black',
  pink: 'pureform-4pc-set-pink',
  'grey-4-piece-silicone-brush-set': 'pureform-4pc-set-grey',
  'black-4-piece-silicone-brush-set': 'pureform-4pc-set-black',
  'pink-4-piece-silicone-brush-set': 'pureform-4pc-set-pink',
};

function errorResponse(request: Request, message: string, status = 400) {
  return json(request, { error: message }, status);
}

function normalizeSlug(value: unknown) {
  const slug = String(value || '').trim();
  return legacyAliases[slug] || slug;
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function isDiscountActive(listing: Listing) {
  const discount = toNumber(listing.discount);
  if (discount <= 0) return false;
  if ((listing.discount_mode || 'ongoing') !== 'fixed') return true;

  const now = Date.now();
  const starts = listing.discount_starts_at ? Date.parse(listing.discount_starts_at) : Number.NaN;
  const ends = listing.discount_ends_at ? Date.parse(listing.discount_ends_at) : Number.NaN;

  if (Number.isFinite(starts) && now < starts) return false;
  if (Number.isFinite(ends) && now > ends) return false;
  return true;
}

function discountedPrice(listing: Listing) {
  const price = toNumber(listing.price);
  const discount = isDiscountActive(listing) ? Math.min(100, Math.max(0, toNumber(listing.discount))) : 0;
  return Math.max(0, price * (1 - discount / 100));
}

function cleanText(value: unknown, maxLength = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanPromoCode(value: unknown) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 64);
}

function makeOrderNumber() {
  const now = new Date();
  const datePart = now.toISOString().slice(2, 10).replace(/-/g, '');
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const randomPart = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `PF-${datePart}-${randomPart}`;
}

function absoluteImageUrl(url: string, siteUrl: string) {
  if (!url) return '';
  if (/^https:\/\//i.test(url)) return url;
  if (/^http:\/\//i.test(url)) return '';
  return `${siteUrl}/${url.replace(/^\/+/, '')}`;
}

async function promotionCodeIdFor(code: string) {
  if (!code) return '';

  const params = new URLSearchParams();
  params.set('code', code);
  params.set('active', 'true');
  params.set('limit', '1');

  const result = await stripeRequest('/promotion_codes', { method: 'GET', params });
  return result?.data?.[0]?.id || '';
}

async function flagCheckoutReview(supabase: ReturnType<typeof database>, order: { id: string; order_number: string }, sessionId: string, releaseFailed = false) {
  const reason = releaseFailed ? 'stock_release_failed' : 'gateway_outcome_unknown';
  // Log identifiers only: never gateway payloads, checkout URLs or customer details.
  console.error(JSON.stringify({ event: 'checkout_reconciliation_required', order_id: order.id, order_number: order.order_number, payment_session_id: sessionId, reason }));
  try {
    await supabase.from('site_orders').update({
      admin_notes: releaseFailed
        ? 'Checkout did not open, but its stock release could not be confirmed. Review Stripe and the stock hold before changing inventory. Do not fulfill.'
        : 'Checkout outcome needs review. Stock is retained until Stripe confirms payment or expiry. Check Stripe using this order number; do not manually release stock or fulfill an unverified payment.',
    }).eq('id', order.id).eq('payment_status', 'requires_payment').eq('admin_notes', '');
  } catch {
    // The structured function log remains available if the database is unreachable.
  }
}

async function releaseFailedCheckout(supabase: ReturnType<typeof database>, order: { id: string; order_number: string }, sessionId = '') {
  try {
    const released = await supabase.rpc('release_site_order', { p_order_id: order.id, p_payment_status: 'failed' });
    if (!released.error) return;
  } catch { /* Keep the unresolved reservation visible for reconciliation. */ }
  await flagCheckoutReview(supabase, order, sessionId, true);
}

function sessionMatchesOrder(session: CheckoutSession, order: { id: string; order_number: string }, sessionId: string) {
  return session?.id === sessionId && session?.client_reference_id === order.id &&
    session?.metadata?.order_id === order.id && session?.metadata?.order_number === order.order_number;
}

async function closeFailedSession(supabase: ReturnType<typeof database>, order: { id: string; order_number: string }, sessionId: string) {
  try {
    const expired = await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}/expire`);
    if (sessionMatchesOrder(expired, order, sessionId) && expired.status === 'expired' && expired.payment_status === 'unpaid') return 'expired';
  } catch { /* Expiry can lose its response or race a completed payment. Retrieve its actual state. */ }

  try {
    const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`, { method: 'GET' });
    if (!sessionMatchesOrder(session, order, sessionId)) return 'unknown';
    if (session.status === 'expired' && session.payment_status === 'unpaid') return 'expired';
    if (isSettledSession(session)) {
      await confirmPaidSession(supabase, session);
      return 'paid';
    }
  } catch { /* A webhook can still settle or expire this reservation. Never assume an unknown session is unpaid. */ }
  return 'unknown';
}

async function createCheckout(request: Request) {
  if (!originAllowed(request)) return errorResponse(request, 'Storefront origin is not allowed.', 403);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return errorResponse(request, 'Use POST to create a checkout session.', 405);
  }

  if (!paymentConfigurationReady()) {
    return errorResponse(
      request,
      'Secure card checkout is not configured yet. Please contact PureForm support.',
      503,
    );
  }

  let body: Record<string, unknown>;
  try {
    const reader = request.body?.getReader();
    if (!reader) return errorResponse(request, 'Checkout payload must be valid JSON.');
    const decoder = new TextDecoder();
    let text = '';
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 16384) {
          await reader.cancel();
          return errorResponse(request, 'Checkout details are too large.', 413);
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      body = JSON.parse(text + decoder.decode());
    } finally { reader.releaseLock(); }
  } catch (_error) {
    return errorResponse(request, 'Checkout payload must be valid JSON.');
  }
  if (!body || Array.isArray(body) || typeof body !== 'object') return errorResponse(request, 'Checkout payload must be an object.');

  const rawItems = Array.isArray(body.line_items) ? body.line_items as CheckoutLine[] : [];
  const requestedItems = new Map<string, number>();

  if (rawItems.length > 20) return errorResponse(request, 'Too many checkout items.');
  for (const item of rawItems) {
    const slug = normalizeSlug(item?.id);
    const quantity = item?.quantity;
    if (!officialSlugs.includes(slug) || !Number.isInteger(quantity) || !quantity || quantity < 1 || quantity > 20) {
      return errorResponse(request, 'Choose a valid set and a whole quantity between 1 and 20.');
    }
    const combined = (requestedItems.get(slug) || 0) + quantity;
    if (combined > 20) return errorResponse(request, 'The maximum quantity is 20 per set.');
    requestedItems.set(slug, combined);
  }

  if (!requestedItems.size) {
    return errorResponse(request, 'Add at least one PureForm product before checkout.');
  }

  const country = cleanText(body.country);
  if (country !== 'United Arab Emirates') {
    return errorResponse(request, 'PureForm checkout is available in the United Arab Emirates only.');
  }

  const contact = cleanText(body.contact, 160);
  const phone = cleanText(body.phone, 80);
  const firstName = cleanText(body.first_name, 80);
  const lastName = cleanText(body.last_name, 80);
  const address = cleanText(body.address, 220);
  const apartment = cleanText(body.apartment, 120);
  const city = cleanText(body.city, 100);
  const emirate = cleanText(body.emirate, 80);
  const customerNotes = cleanText(body.customer_notes, 1000);
  const discountCode = cleanPromoCode(body.discount_code);

  if (!contact || !phone || !firstName || !lastName || !address || !city || !emirate) {
    return errorResponse(request, 'Contact, phone, name, address, city, and emirate are required for UAE card checkout.');
  }
  if (!['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'].includes(emirate)) {
    return errorResponse(request, 'Select a valid UAE emirate.');
  }

  const supabase = database();

  // HMAC fingerprints limit repeated attempts without storing extra contact data.
  const fingerprintKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(env('SUPABASE_SERVICE_ROLE_KEY')),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const fingerprint = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.sign(
    'HMAC', fingerprintKey, new TextEncoder().encode(value))), (n) => n.toString(16).padStart(2, '0')).join('');
  const normalizedPhone = phone.replace(/\D/g, '').replace(/^00/, '').replace(/^0(?=\d{8,9}$)/, '971');
  const { data: retryAfter, error: limitError } = await supabase.rpc('check_site_checkout_limit', {
    p_phone_hash: await fingerprint(normalizedPhone),
    p_contact_hash: await fingerprint(contact.toLowerCase()),
  });
  if (limitError || !Number.isSafeInteger(retryAfter) || retryAfter < 0) return errorResponse(request, 'Checkout is temporarily unavailable. Please try again later.', 503);
  if (Number(retryAfter) > 0) {
    const response = errorResponse(request, 'Too many checkout attempts. Please wait before trying again.', 429);
    response.headers.set('Retry-After', String(Math.min(600, Math.max(1, Number(retryAfter)))));
    return response;
  }

  const slugs = Array.from(requestedItems.keys());
  const { data: listings, error: listingsError } = await supabase
    .from('site_listings')
    .select('slug,name,description,price,discount,discount_mode,discount_starts_at,discount_ends_at,inventory_quantity,inventory_status,inventory_note,photo_urls')
    .in('slug', slugs)
    .eq('visible', true);

  if (listingsError) {
    return errorResponse(request, 'Current product data could not be loaded. Please try again later.', 502);
  }

  const listingsBySlug = new Map((listings || []).map((listing: Listing) => [listing.slug, listing]));
  const siteUrl = configuredSiteUrl();
  const orderItems = [];
  const stripeItems = [];
  let subtotal = 0;

  for (const slug of slugs) {
    const listing = listingsBySlug.get(slug);
    const quantity = requestedItems.get(slug) || 0;

    if (!listing) {
      return errorResponse(request, 'One or more products are no longer available.');
    }

    const inventoryQuantity = Math.max(0, Number.parseInt(String(listing.inventory_quantity || 0), 10));
    if (listing.inventory_status === 'out_of_stock' || inventoryQuantity <= 0) {
      return errorResponse(request, `${listing.name} is out of stock.`);
    }

    if (quantity > inventoryQuantity) {
      return errorResponse(request, `Only ${inventoryQuantity} ${listing.name} ${inventoryQuantity === 1 ? 'set is' : 'sets are'} available.`);
    }

    const activePrice = discountedPrice(listing);
    const unitAmount = Math.round(activePrice * 100);
    if (!Number.isSafeInteger(unitAmount) || unitAmount < 1) return errorResponse(request, 'This set does not have a valid checkout price.');
    const lineTotal = unitAmount * quantity / 100;
    const imageUrl = absoluteImageUrl((listing.photo_urls || [])[0] || '', siteUrl);

    subtotal += lineTotal;
    orderItems.push({
      id: slug,
      name: listing.name,
      meta: listing.description || '4-piece PureForm set',
      image: imageUrl,
      price: unitAmount / 100,
      regular_price: toNumber(listing.price),
      discount: isDiscountActive(listing) ? toNumber(listing.discount) : 0,
      quantity,
      line_total: lineTotal,
    });

    stripeItems.push({ listing, quantity, unitAmount, imageUrl });
  }

  let promotionCodeId = '';
  if (discountCode) {
    promotionCodeId = await promotionCodeIdFor(discountCode);
    if (!promotionCodeId) {
      return errorResponse(request, 'That promotion code is not active for secure card checkout.');
    }
  }

  const shippingTotal = shippingForQuantity(orderItems.reduce((sum, item) => sum + item.quantity, 0));
  const orderNumber = makeOrderNumber();
  const orderPayload = {
    order_number: orderNumber,
    status: 'new',
    payment_status: 'requires_payment',
    fulfillment_status: 'unfulfilled',
    contact,
    phone,
    first_name: firstName,
    last_name: lastName,
    country,
    address,
    apartment,
    city,
    emirate,
    payment_preference: 'Secure card checkout',
    payment_provider: 'stripe',
    discount_code: discountCode,
    customer_notes: customerNotes,
    line_items: orderItems,
    subtotal,
    shipping_total: shippingTotal,
    total: subtotal + shippingTotal,
    currency: 'AED',
    source: /^[sr]k_test_/.test(env('STRIPE_SECRET_KEY')) ? 'stripe_sandbox' : 'website',
  };

  const { data: order, error: orderError } = await supabase
    .from('site_orders')
    .insert(orderPayload)
    .select('id,order_number')
    .single();

  if (orderError || !order) {
    return errorResponse(request, 'The order could not be saved. No payment was taken.', 502);
  }

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('expires_at', String(Math.floor(Date.now() / 1000) + 1860));
  params.set('payment_method_configuration', env('STRIPE_PAYMENT_METHOD_CONFIG'));
  params.set('success_url', `${siteUrl}/checkout.html?payment=success&order=${encodeURIComponent(order.order_number)}&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${siteUrl}/checkout.html?payment=cancelled&order=${encodeURIComponent(order.order_number)}`);
  params.set('client_reference_id', order.id);
  params.set('customer_creation', 'if_required');
  params.set('phone_number_collection[enabled]', 'true');
  params.set('shipping_address_collection[allowed_countries][0]', 'AE');
  params.set('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
  params.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(shippingTotal * 100));
  params.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'aed');
  params.set('shipping_options[0][shipping_rate_data][display_name]', shippingTotal === 0 ? 'Free UAE delivery - 2+ sets' : 'UAE delivery');
  params.set('metadata[order_id]', order.id);
  params.set('metadata[order_number]', order.order_number);
  params.set('payment_intent_data[metadata][order_id]', order.id);
  params.set('payment_intent_data[metadata][order_number]', order.order_number);

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
    params.set('customer_email', contact);
  }

  if (promotionCodeId) {
    params.set('discounts[0][promotion_code]', promotionCodeId);
  } else {
    params.set('allow_promotion_codes', 'true');
  }

  stripeItems.forEach((item, index) => {
    params.set(`line_items[${index}][quantity]`, String(item.quantity));
    params.set(`line_items[${index}][price_data][currency]`, 'aed');
    params.set(`line_items[${index}][price_data][unit_amount]`, String(item.unitAmount));
    params.set(`line_items[${index}][price_data][product_data][name]`, item.listing.name);
    params.set(`line_items[${index}][price_data][product_data][description]`, item.listing.description || 'PureForm silicone brush set');
    params.set(`line_items[${index}][price_data][product_data][metadata][slug]`, item.listing.slug);
    if (item.imageUrl) {
      params.set(`line_items[${index}][price_data][product_data][images][0]`, item.imageUrl);
    }
  });

  const reservation = await supabase.rpc('reserve_site_order', { p_order_id: order.id });
  if (reservation.error) {
    await releaseFailedCheckout(supabase, order);
    return errorResponse(request, 'Stock changed before payment. Please refresh your cart and try again.', 409);
  }

  let sessionId = '';
  try {
    const session = await stripeRequest('/checkout/sessions', { params, idempotencyKey: order.id });
    if (/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(session?.id)) sessionId = session.id;
    if (!session?.url || !sessionId) throw new Error('Missing payment session.');
    if (!Array.isArray(session.payment_method_types) || session.payment_method_types.length !== 1 || session.payment_method_types[0] !== 'card') {
      throw new Error('The gateway configuration must accept cards only.');
    }
    const saved = await supabase.from('site_orders').update({
      payment_session_id: session.id,
      payment_reference: session.id,
      source: session.livemode === false ? 'stripe_sandbox' : 'website',
    }).eq('id', order.id);
    if (saved.error) {
      throw new Error('Could not attach payment session.');
    }
    return json(request, {
      checkout_url: session.url,
      order_id: order.id,
      order_number: order.order_number,
    });
  } catch (error) {
    const outcome = sessionId
      ? await closeFailedSession(supabase, order, sessionId)
      : error instanceof StripeRequestError && error.definitivelyRejected ? 'rejected' : 'unknown';
    if (outcome === 'paid') {
      return errorResponse(request, `Payment was confirmed for order ${order.order_number}. Do not pay again; contact PureForm support for your order details.`, 409);
    }
    if (outcome === 'expired' || outcome === 'rejected') {
      await releaseFailedCheckout(supabase, order, sessionId);
      return errorResponse(request, 'Secure card checkout could not be opened. Please try again later.', 502);
    }

    await flagCheckoutReview(supabase, order, sessionId);
    return errorResponse(request, `Checkout could not be confirmed. Please contact PureForm support with order ${order.order_number} before trying another payment.`, 502);
  }
}

export async function handler(request: Request) {
  try { return await createCheckout(request); }
  catch { return errorResponse(request, 'Checkout is temporarily unavailable. Please try again later.', 502); }
}
