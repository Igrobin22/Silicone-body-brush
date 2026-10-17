import { confirmPaidSession, database, json, originAllowed, corsHeaders, paymentConfigurationReady, stripeRequest, uaeShippingTotal } from '../_shared/payments.ts';

export async function handler(request: Request) {
  if (!originAllowed(request)) return json(request, { error: 'Storefront origin is not allowed.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method === 'GET') {
    const configured = paymentConfigurationReady();
    return json(request, { configured, shipping_total: uaeShippingTotal, currency: 'AED' }, configured ? 200 : 503);
  }
  if (request.method !== 'POST') return json(request, { error: 'Use POST to verify payment.' }, 405);
  if (!paymentConfigurationReady()) return json(request, { error: 'Secure card checkout is not configured yet.' }, 503);

  let body;
  try { body = await request.json(); }
  catch { return json(request, { error: 'Payment verification requires valid JSON.' }, 400); }
  if (!body || !/^cs_(test_|live_)?[A-Za-z0-9]{10,}$/.test(body.session_id || '') || !/^PF-[A-Z0-9-]{6,40}$/.test(body.order_number || '')) {
    return json(request, { error: 'A valid payment session and order number are required.' }, 400);
  }

  try {
    const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(body.session_id)}`, { method: 'GET' });
    if (session.metadata?.order_number !== body.order_number) {
      return json(request, { error: 'The payment does not match this order.' }, 400);
    }
    if (session.payment_status === 'unpaid') return json(request, { paid: false, order_number: body.order_number });
    await confirmPaidSession(database(), session);
    return json(request, { paid: true, order_number: body.order_number });
  } catch {
    return json(request, { error: 'Payment could not be verified. Keep your order number and contact support before trying another payment.' }, 502);
  }
}
