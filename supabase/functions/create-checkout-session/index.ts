import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

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

const jsonHeaders = (request: Request, status = 200) => ({
  status,
  headers: {
    ...corsHeaders(request),
    'Content-Type': 'application/json; charset=utf-8',
  },
});

function corsHeaders(request: Request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function errorResponse(request: Request, message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), jsonHeaders(request, status));
}

function env(name: string) {
  return Deno.env.get(name)?.trim() || '';
}

function normalizeSlug(value: unknown) {
  const slug = String(value || '').trim();
  return legacyAliases[slug] || slug;
}

function clampQuantity(value: unknown) {
  const quantity = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(quantity) ? Math.min(Math.max(quantity, 1), 20) : 1;
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

function siteUrlFromRequest(request: Request) {
  const configured = env('SITE_URL').replace(/\/+$/, '');
  if (configured) return configured;

  const origin = request.headers.get('Origin') || '';
  if (origin.startsWith('https://') || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
    return origin.replace(/\/+$/, '');
  }

  return 'https://siliconebodybrush2.pages.dev';
}

function absoluteImageUrl(url: string, siteUrl: string) {
  if (!url) return '';
  if (/^https:\/\//i.test(url)) return url;
  if (/^http:\/\//i.test(url)) return '';
  return `${siteUrl}/${url.replace(/^\/+/, '')}`;
}

async function stripeRequest(path: string, init: { method?: string; params?: URLSearchParams }) {
  const secretKey = env('STRIPE_SECRET_KEY');
  const method = init.method || 'POST';
  const url = new URL(`https://api.stripe.com/v1${path}`);
  const fetchInit: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  };

  if (method === 'GET') {
    url.search = init.params?.toString() || '';
  } else {
    (fetchInit.headers as Record<string, string>)['Content-Type'] = 'application/x-www-form-urlencoded';
    fetchInit.body = init.params;
  }

  const response = await fetch(url, fetchInit);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Stripe request failed.');
  }

  return payload;
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

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return errorResponse(request, 'Use POST to create a checkout session.', 405);
  }

  const supabaseUrl = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const stripeSecretKey = env('STRIPE_SECRET_KEY');

  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey) {
    return errorResponse(
      request,
      'Secure card checkout is not configured yet. Add STRIPE_SECRET_KEY, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY to Supabase function secrets.',
      503,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch (_error) {
    return errorResponse(request, 'Checkout payload must be valid JSON.');
  }

  const rawItems = Array.isArray(body.line_items) ? body.line_items as CheckoutLine[] : [];
  const requestedItems = new Map<string, number>();

  rawItems.forEach((item) => {
    const slug = normalizeSlug(item?.id);
    if (!officialSlugs.includes(slug)) return;
    requestedItems.set(slug, (requestedItems.get(slug) || 0) + clampQuantity(item?.quantity));
  });

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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const slugs = Array.from(requestedItems.keys());
  const { data: listings, error: listingsError } = await supabase
    .from('site_listings')
    .select('slug,name,description,price,discount,discount_mode,discount_starts_at,discount_ends_at,inventory_quantity,inventory_status,inventory_note,photo_urls')
    .in('slug', slugs)
    .eq('visible', true);

  if (listingsError) {
    return errorResponse(request, `Could not load current product data: ${listingsError.message}`, 502);
  }

  const listingsBySlug = new Map((listings || []).map((listing: Listing) => [listing.slug, listing]));
  const siteUrl = siteUrlFromRequest(request);
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
    const lineTotal = unitAmount * quantity / 100;
    const imageUrl = absoluteImageUrl((listing.photo_urls || [])[0] || '', siteUrl);

    subtotal += lineTotal;
    orderItems.push({
      id: slug,
      name: listing.name,
      meta: listing.inventory_note || '4-piece PureForm set',
      image: imageUrl,
      price: activePrice,
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
    total: subtotal,
    currency: 'AED',
    source: 'website',
  };

  const { data: order, error: orderError } = await supabase
    .from('site_orders')
    .insert(orderPayload)
    .select('id,order_number')
    .single();

  if (orderError || !order) {
    return errorResponse(request, `Could not save the order before payment: ${orderError?.message || 'Unknown error'}`, 502);
  }

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('payment_method_types[0]', 'card');
  params.set('success_url', `${siteUrl}/checkout.html?payment=success&order=${encodeURIComponent(order.order_number)}&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${siteUrl}/checkout.html?payment=cancelled&order=${encodeURIComponent(order.order_number)}`);
  params.set('client_reference_id', order.id);
  params.set('customer_creation', 'if_required');
  params.set('phone_number_collection[enabled]', 'true');
  params.set('shipping_address_collection[allowed_countries][0]', 'AE');
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
    params.set(`line_items[${index}][price_data][product_data][description]`, item.listing.inventory_note || item.listing.description || 'PureForm silicone brush set');
    params.set(`line_items[${index}][price_data][product_data][metadata][slug]`, item.listing.slug);
    if (item.imageUrl) {
      params.set(`line_items[${index}][price_data][product_data][images][0]`, item.imageUrl);
    }
  });

  const session = await stripeRequest('/checkout/sessions', { params });
  const checkoutUrl = session?.url;

  if (!checkoutUrl) {
    return errorResponse(request, 'Stripe did not return a checkout URL.', 502);
  }

  await supabase
    .from('site_orders')
    .update({
      payment_session_id: session.id || '',
      payment_reference: session.id || '',
    })
    .eq('id', order.id);

  return new Response(JSON.stringify({
    checkout_url: checkoutUrl,
    order_id: order.id,
    order_number: order.order_number,
  }), jsonHeaders(request));
});
