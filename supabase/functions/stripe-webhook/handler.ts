import { confirmPaidSession, database, env, isSettledSession, json } from '../_shared/payments.ts';

const encoder = new TextEncoder();

function parseStripeSignature(header: string) {
  const parts = header.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2) || '';
  const signatures = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3))
    .filter(Boolean);

  return { timestamp, signatures };
}

async function hmacSha256Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function verifyStripeSignature(body: string, header: string, secret: string) {
  const { timestamp, signatures } = parseStripeSignature(header);
  const timestampSeconds = Number(timestamp);

  if (!timestampSeconds || !signatures.length) {
    throw new Error('Missing Stripe webhook signature.');
  }

  const age = Math.abs(Date.now() / 1000 - timestampSeconds);
  if (age > 300) {
    throw new Error('Stripe webhook signature is too old.');
  }

  const expected = await hmacSha256Hex(secret, `${timestamp}.${body}`);
  if (!signatures.some((signature) => timingSafeEqual(signature, expected))) {
    throw new Error('Stripe webhook signature verification failed.');
  }
}

export async function handler(request: Request) {
  if (request.method !== 'POST') {
    return json(request, { error: 'Use POST for Stripe webhooks.' }, 405);
  }

  const webhookSecret = env('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');

  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return json(request, { error: 'Stripe webhook secrets are not configured.' }, 503);
  }

  const signature = request.headers.get('stripe-signature') || '';
  const rawBody = await request.text();

  try {
    await verifyStripeSignature(rawBody, signature, webhookSecret);
  } catch (error) {
    return json(request, { error: error instanceof Error ? error.message : 'Invalid Stripe signature.' }, 400);
  }

  let event;
  try { event = JSON.parse(rawBody); }
  catch { return json(request, { error: 'Invalid webhook JSON.' }, 400); }
  if (!event || typeof event.type !== 'string') return json(request, { error: 'Invalid webhook event.' }, 400);

  if (['refund.created', 'refund.updated', 'refund.failed'].includes(event.type)) {
    const refund = event.data?.object;
    const intent = typeof refund?.payment_intent === 'string' ? refund.payment_intent : refund?.payment_intent?.id;
    if (!refund || !/^re_[A-Za-z0-9_]+$/.test(refund.id || '') || !/^pi_[A-Za-z0-9_]+$/.test(intent || '') ||
      !Number.isSafeInteger(refund.amount) || refund.amount <= 0 || refund.currency !== 'aed' ||
      !['pending', 'requires_action', 'succeeded', 'failed', 'canceled'].includes(refund.status) ||
      typeof event.livemode !== 'boolean' || !Number.isSafeInteger(event.created) || event.created <= 0) {
      return json(request, { error: 'Invalid refund event.' }, 400);
    }
    try {
      const { error } = await database().rpc('record_site_refund', {
        p_refund_id: refund.id, p_payment_intent_id: intent, p_amount_minor: refund.amount,
        p_currency: refund.currency, p_status: refund.status, p_livemode: event.livemode, p_event_created: event.created,
      });
      if (error) throw error;
      return json(request, { received: true });
    } catch { return json(request, { error: 'Refund update could not be saved. Please retry this webhook.' }, 500); }
  }

  const session = event.data?.object;
  const orderId = session?.metadata?.order_id;
  // Other Stripe products can use this account without creating PureForm orders.
  if (!orderId) return json(request, { received: true });

  try {
    const supabase = database();
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      if (isSettledSession(session)) await confirmPaidSession(supabase, session);
    }
    if (['checkout.session.expired', 'checkout.session.async_payment_failed'].includes(event.type)) {
      const { error } = await supabase.rpc('release_site_order', {
        p_order_id: orderId,
        p_payment_status: event.type === 'checkout.session.expired' ? 'cancelled' : 'failed',
      });
      if (error) throw error;
    }
    return json(request, { received: true });
  } catch {
    // Non-2xx responses make Stripe retry; never acknowledge a failed database write.
    return json(request, { error: 'Payment update could not be saved. Please retry this webhook.' }, 500);
  }
}
