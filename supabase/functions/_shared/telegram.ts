import { database, env, siteUrl } from './payments.ts';

export function secretMatches(actual: string, expected: string) {
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(expected) || actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let n = 0; n < expected.length; n++) mismatch |= actual.charCodeAt(n) ^ expected.charCodeAt(n);
  return mismatch === 0;
}

export function telegramReady() {
  const owner = Number(env('TELEGRAM_OWNER_ID'));
  const webhook = env('TELEGRAM_WEBHOOK_SECRET');
  const dispatch = env('TELEGRAM_DISPATCH_SECRET');
  return /^[0-9]{5,20}:[A-Za-z0-9_-]{20,}$/.test(env('TELEGRAM_BOT_TOKEN')) &&
    Number.isSafeInteger(Number(env('TELEGRAM_BOT_TOKEN').split(':')[0])) &&
    /^[1-9][0-9]{0,15}$/.test(env('TELEGRAM_OWNER_ID')) && Number.isSafeInteger(owner) && owner > 0 &&
    secretMatches(webhook,webhook) && secretMatches(dispatch,dispatch) && webhook !== dispatch &&
    Boolean(env('SUPABASE_URL')) && Boolean(env('SUPABASE_SERVICE_ROLE_KEY'));
}

export async function telegramRequest(method: 'sendMessage' | 'answerCallbackQuery', body: Record<string, unknown>) {
  // Never log this URL or propagate provider/network exceptions: the token is in the API path.
  try {
    const response = await fetch(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000), redirect: 'error',
    });
    let payload;
    try { payload = await response.json(); }
    catch { return { error: 'invalid_response', retry: 60 } as const; }
    if (response.status === 429 || payload?.error_code === 429) {
      const wait = Number(payload?.parameters?.retry_after);
      return { error: 'provider_rate_limit', retry: Number.isSafeInteger(wait) ? Math.min(3600, Math.max(5, wait)) : 60 } as const;
    }
    if (!response.ok || payload?.ok !== true) {
      return { error: 'provider_rejected', retry: response.status >= 500 || Number(payload?.error_code) >= 500 ? 60 : null } as const;
    }
    return { result: payload.result };
  } catch { return { error: 'network_uncertain', retry: 60 } as const; }
}

export async function dispatchTelegram(limit = 1) {
  const db = database();
  const { data: jobs, error } = await db.rpc('claim_site_telegram_jobs', { p_limit: limit });
  if (error || !Array.isArray(jobs)) throw new Error('Telegram queue is unavailable.');
  let sent = 0;
  for (let index = 0; index < jobs.length; index++) {
    if (index) await new Promise(resolve => setTimeout(resolve, 1100));
    const job = jobs[index];
    let text = String(job.message);
    if (job.order_id) {
      try { text += `\n${siteUrl()}/admin/dashboard.html?view=orders&order=${encodeURIComponent(job.order_id)}`; }
      catch { /* The notification remains useful when the optional admin link is unavailable. */ }
    }
    const outcome = await telegramRequest('sendMessage', {
      chat_id: job.chat_id || Number(env('TELEGRAM_OWNER_ID')), text: text.slice(0, 4096),
      link_preview_options: { is_disabled: true }, protect_content: true,
      ...(job.reply_markup ? { reply_markup: job.reply_markup } : {}),
    });
    const messageId = 'result' in outcome && Number.isSafeInteger(outcome.result?.message_id) && outcome.result.message_id > 0
      ? outcome.result.message_id : null;
    const { error: saveError } = await db.rpc('finish_site_telegram_job', {
      p_id: job.id, p_lease: job.lease, p_message_id: messageId,
      p_error: messageId ? null : 'error' in outcome ? outcome.error : 'invalid_response',
      p_retry_after: messageId ? null : 'retry' in outcome ? outcome.retry : 60,
    });
    if (saveError) throw new Error('Telegram delivery outcome could not be recorded.');
    if (messageId) sent++;
  }
  return { claimed: jobs.length, sent };
}
