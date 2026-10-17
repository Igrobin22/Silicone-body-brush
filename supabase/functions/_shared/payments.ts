import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export const env = (name: string) => Deno.env.get(name)?.trim() || '';
export const uaeShippingTotal = 10;

export function siteUrl() {
  const value = env('SITE_URL').replace(/\/+$/, '');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('SITE_URL must be an HTTPS storefront origin.');
  }
  return url.origin;
}

export function paymentConfigurationReady() {
  try {
    siteUrl();
    return /^pmc_[A-Za-z0-9]+$/.test(env('STRIPE_PAYMENT_METHOD_CONFIG')) &&
      ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
      .every((name) => Boolean(env(name)) && !env(name).includes('replace_me'));
  } catch {
    return false;
  }
}

export function corsHeaders(request: Request) {
  const allowed = [env('SITE_URL'), ...env('ALLOWED_ORIGINS').split(',')]
    .map((origin) => origin.trim().replace(/\/+$/, '')).filter(Boolean);
  const origin = request.headers.get('Origin') || '';
  return {
    ...(allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}

export function originAllowed(request: Request) {
  return !request.headers.has('Origin') || Boolean(corsHeaders(request)['Access-Control-Allow-Origin']);
}

export function json(request: Request, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function database() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class StripeRequestError extends Error {
  constructor(readonly definitivelyRejected = false) {
    super('Payment gateway request failed.');
    this.name = 'StripeRequestError';
  }
}

export async function stripeRequest(path: string, options: {
  method?: string;
  params?: URLSearchParams;
  idempotencyKey?: string;
} = {}) {
  const method = options.method || 'POST';
  const url = new URL(`https://api.stripe.com/v1${path}`);
  const headers: Record<string, string> = { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}` };
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
  if (method === 'GET') url.search = options.params?.toString() || '';
  else headers['Content-Type'] = 'application/x-www-form-urlencoded';
  const body = method === 'GET' ? undefined : options.params?.toString();
  let uncertainAttempt = false;

  for (let attempt = 0; ; attempt++) {
    let response: Response;
    let payload;
    try {
      response = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(15000) });
      payload = await response.json();
    } catch {
      // A lost response can hide a successful write. Replay only the exact keyed request.
      uncertainAttempt = true;
      if (options.idempotencyKey && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      throw new StripeRequestError();
    }

    if (!response.ok) {
      const definitivelyRejected = !uncertainAttempt &&
        [400, 401, 403, 404, 429].includes(response.status) &&
        ['invalid_request_error', 'authentication_error', 'permission_error', 'rate_limit_error'].includes(payload?.error?.type) &&
        payload?.error?.code !== 'idempotency_key_in_use';
      throw new StripeRequestError(definitivelyRejected);
    }
    return payload;
  }
}

export type CheckoutSession = {
  id: string;
  mode: string;
  status: string;
  currency: string;
  payment_status: string;
  amount_total: number;
  metadata?: { order_id?: string; order_number?: string };
  client_reference_id?: string;
  payment_intent?: string | { id: string } | null;
};

export function isSettledSession(session: CheckoutSession) {
  return session.mode === 'payment' && session.status === 'complete' && session.currency === 'aed' &&
    Number.isSafeInteger(session.amount_total) && session.amount_total >= 0 &&
    (session.payment_status === 'paid' || (session.payment_status === 'no_payment_required' && session.amount_total === 0));
}

export async function confirmPaidSession(client: ReturnType<typeof database>, session: CheckoutSession) {
  if (!isSettledSession(session)) throw new Error('The card payment has not been confirmed.');
  const orderId = session.metadata?.order_id;
  if (!orderId || orderId !== session.client_reference_id || !session.metadata?.order_number) {
    throw new Error('The payment is not linked to a PureForm order.');
  }
  const { error } = await client.rpc('apply_paid_site_order', {
    p_order_id: orderId,
    p_payment_session_id: session.id,
    p_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || '',
    p_paid_total: session.amount_total / 100,
    p_payment_reference: session.id,
  });
  if (error) throw new Error('The payment could not be recorded. Please contact support with your order number.');
}
