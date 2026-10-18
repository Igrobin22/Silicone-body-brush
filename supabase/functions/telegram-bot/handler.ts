import { database, env } from '../_shared/payments.ts';
import { dispatchTelegram, secretMatches, telegramReady, telegramRequest } from '../_shared/telegram.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ownerKinds = ['stock', 'discount', 'confirm', 'cancel', 'reply'];
const response = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export function parseCommand(text: string): Record<string, unknown> {
  const parts = text.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  if (['/start', '/help', '/settings'].includes(command)) return { kind: 'help' };
  if (['/inventory', '/discounts', '/orders'].includes(command) && parts.length === 1) return { kind: command.slice(1) };
  if (command === '/support' && parts.length > 1) return { kind: 'support', text: text.trim().slice(parts[0].length).trim().slice(0, 1000) };
  if (['/confirm', '/cancel'].includes(command) && parts.length === 2 && uuid.test(parts[1])) return { kind: command.slice(1), id: parts[1] };
  if (command === '/reply' && parts.length > 2 && uuid.test(parts[1])) return { kind: 'reply', id: parts[1], text: parts.slice(2).join(' ').slice(0, 1000) };
  if (['/stock', '/discount'].includes(command) && parts.length === 3 && ['grey', 'black', 'pink'].includes(parts[1].toLowerCase())) {
    const kind = command.slice(1);
    const value = kind === 'discount' && parts[2].toLowerCase() === 'off' ? 0 : Number(parts[2]);
    const validNumber = kind === 'stock' ? /^\d{1,6}$/.test(parts[2]) : /^(?:\d{1,3}(?:\.\d{1,2})?|off)$/i.test(parts[2]);
    if (validNumber && Number.isFinite(value) && value >= 0 && value <= (kind === 'stock' ? 100000 : 100)) {
      return { kind, slug: 'pureform-4pc-set-' + parts[1].toLowerCase(), value };
    }
  }
  return { kind: 'help' };
}

async function readUpdate(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing body');
  let bytes = 0;
  let text = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 16384) { await reader.cancel(); throw new Error('Body too large'); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}

export async function handler(request: Request) {
  if (request.method !== 'POST') return response({ error: 'Use POST.' }, 405);
  if (!telegramReady()) return response({ error: 'Telegram is not configured.' }, 503);
  if (new URL(request.url).pathname.endsWith('/dispatch')) {
    if (!secretMatches(request.headers.get('x-telegram-dispatch-secret') || '', env('TELEGRAM_DISPATCH_SECRET'))) return response({ error: 'Unauthorized.' }, 401);
    try { return response(await dispatchTelegram(5)); }
    catch { return response({ error: 'Telegram delivery requires retry.' }, 503); }
  }
  if (!secretMatches(request.headers.get('x-telegram-bot-api-secret-token') || '', env('TELEGRAM_WEBHOOK_SECRET'))) return response({ error: 'Unauthorized.' }, 401);
  let update;
  try { update = await readUpdate(request); }
  catch { return response({ error: 'Invalid update.' }, 400); }
  if (!update || !Number.isSafeInteger(update.update_id) || update.update_id < 0) return response({ error: 'Invalid update.' }, 400);
  const callback = update.callback_query;
  const message = callback?.message || update.message;
  const sender = callback?.from || message?.from;
  if (!message || message.chat?.type !== 'private' || sender?.is_bot !== false ||
    !Number.isSafeInteger(sender.id) || sender.id <= 0 || message.chat.id !== sender.id ||
    message.forward_origin || message.forward_from || message.via_bot || message.sender_chat) return response({ received: true });
  const text = callback ? String(callback.data || '').replace(/^(confirm|cancel):/, '/$1 ') : message.text;
  if (typeof text !== 'string' || text.length > 4096) return response({ received: true });
  const command = parseCommand(text);
  const owner = Number(env('TELEGRAM_OWNER_ID'));
  const issuedAt = message.date;
  // Old queued admin messages must not unexpectedly change a store after reconnecting.
  if (ownerKinds.includes(String(command.kind)) && sender.id === owner &&
    (!Number.isSafeInteger(issuedAt) || Math.abs(Date.now() / 1000 - issuedAt) > 300)) return response({ received: true });
  if (callback && (!uuid.test(String(command.id || '')) || !['confirm', 'cancel'].includes(String(command.kind)) ||
    message.from?.id !== Number(env('TELEGRAM_BOT_TOKEN').split(':')[0]))) return response({ received: true });
  try {
    const { error } = await database().rpc('process_site_telegram_update', {
      p_update_id: update.update_id, p_sender_id: sender.id, p_chat_id: message.chat.id, p_owner_id: owner, p_command: command,
    });
    if (error) return response({ error: 'Telegram update could not be saved.' }, 503);
  } catch { return response({ error: 'Telegram update could not be saved.' }, 503); }
  if (callback?.id) await telegramRequest('answerCallbackQuery', { callback_query_id: callback.id, text: 'Request received.' });
  // Delivery is separate from the committed command; the scheduled dispatcher retries failures.
  try { await dispatchTelegram(1); } catch { /* Keep the persisted outbox job for the scheduler. */ }
  return response({ received: true });
}
