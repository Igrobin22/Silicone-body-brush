import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const encoder = new TextEncoder();

function corsHeaders(request: Request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Headers': 'stripe-signature, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(request: Request, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function env(name: string) {
  return Deno.env.get(name)?.trim() || '';
}

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

async function verifyStripeSignature(body: string, header: string, secret: string) {
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

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

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

  const event = JSON.parse(rawBody);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object || {};
    const orderId = session.metadata?.order_id || session.client_reference_id || '';
    const amountTotal = Number(session.amount_total || 0) / 100;

    if (orderId) {
      const { error } = await supabase.rpc('apply_paid_site_order', {
        p_order_id: orderId,
        p_payment_session_id: session.id || '',
        p_payment_intent_id: String(session.payment_intent || ''),
        p_paid_total: amountTotal,
        p_payment_reference: session.id || '',
      });

      if (error) {
        return json(request, { error: error.message }, 500);
      }
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data?.object || {};
    const orderId = session.metadata?.order_id || session.client_reference_id || '';

    if (orderId) {
      await supabase
        .from('site_orders')
        .update({
          payment_status: 'cancelled',
          payment_session_id: session.id || '',
          payment_reference: session.id || '',
        })
        .eq('id', orderId)
        .eq('payment_status', 'requires_payment');
    }
  }

  return json(request, { received: true });
});
