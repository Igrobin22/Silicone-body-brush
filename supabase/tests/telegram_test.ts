import assert from 'node:assert/strict';
import { handler, parseCommand } from '../functions/telegram-bot/handler.ts';
import { dispatchTelegram, secretMatches } from '../functions/_shared/telegram.ts';

Deno.test('Telegram webhook authentication and safe delivery', async test => {
  const settings = {
    TELEGRAM_BOT_TOKEN:'12345:fixture_token_not_a_real_bot_token',TELEGRAM_OWNER_ID:'123456789',
    TELEGRAM_WEBHOOK_SECRET:'fixture_webhook_secret_1234567890_abcd',TELEGRAM_DISPATCH_SECRET:'different_dispatch_secret_1234567890_abcd',
    SUPABASE_URL:'https://backend.example.test',SUPABASE_SERVICE_ROLE_KEY:'fixture_service_key',SITE_URL:'https://store.example.test',
  };
  const previous = Object.fromEntries(Object.keys(settings).map(key => [key,Deno.env.get(key)]));
  for (const [key,value] of Object.entries(settings)) Deno.env.set(key,value);
  const realFetch = globalThis.fetch;
  const calls: {path: string,body: Record<string,unknown>}[] = [];
  let jobs: Record<string,unknown>[] = [];
  let providerStatus = 200;
  let transportFailure = false;
  let databaseFailure = false;
  const message = { message_id: 1,from:{id:123456789,is_bot:false},chat:{id:123456789,type:'private'},date:Math.floor(Date.now()/1000),text:'/stock grey 24' };
  const update = (text = '/stock grey 24') => ({update_id:100,message:{...message,text}});
  const request = (body: unknown,secret = settings.TELEGRAM_WEBHOOK_SECRET,path='') => new Request('https://backend.example.test/functions/v1/telegram-bot'+path,{
    method:'POST',headers:{'Content-Type':'application/json',[path? 'x-telegram-dispatch-secret':'x-telegram-bot-api-secret-token']:secret},body:JSON.stringify(body),
  });
  globalThis.fetch = async (input,options) => {
    const url = new URL(String(input));
    const body = JSON.parse(String((options as RequestInit | undefined)?.body || '{}'));
    calls.push({path:url.pathname,body});
    const reply = (value: unknown,status=200) => new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
    if (url.pathname.endsWith('/process_site_telegram_update')) return databaseFailure?reply({message:'private database error'},500):reply(true);
    if (url.pathname.endsWith('/claim_site_telegram_jobs')) return reply(jobs);
    if (url.pathname.endsWith('/finish_site_telegram_job')) return reply(null);
    if (url.hostname === 'api.telegram.org') {
      if (transportFailure) throw new Error('secret token and request URL must not escape');
      return providerStatus===200?reply({ok:true,result:{message_id:321}}):reply({ok:false,error_code:providerStatus,description:'Private provider error',parameters:{retry_after:30}},providerStatus);
    }
    throw new Error('Unexpected test request');
  };
  try {
    await test.step('requires configured credentials and the exact independent secret for each route',async () => {
      calls.length=0;
      assert.equal((await handler(new Request('https://example.test/telegram-bot'))).status,405);
      assert.equal((await handler(request(update(),''))).status,401);
      assert.equal((await handler(request(update(),'bad-secret'))).status,401);
      assert.equal((await handler(request({},settings.TELEGRAM_WEBHOOK_SECRET,'/dispatch'))).status,401);
      assert.equal(calls.length,0);
      Deno.env.delete('TELEGRAM_OWNER_ID');
      assert.equal((await handler(request(update()))).status,503);
      Deno.env.set('TELEGRAM_OWNER_ID',settings.TELEGRAM_OWNER_ID);
      Deno.env.set('TELEGRAM_DISPATCH_SECRET',settings.TELEGRAM_WEBHOOK_SECRET);
      assert.equal((await handler(request(update()))).status,503);
      Deno.env.set('TELEGRAM_DISPATCH_SECRET',settings.TELEGRAM_DISPATCH_SECRET);
      assert.equal(secretMatches('',''),false);
    });
    await test.step('parses only explicit bounded commands for the canonical colors', () => {
      assert.deepEqual(parseCommand('/stock GREY 24'),{kind:'stock',slug:'pureform-4pc-set-grey',value:24});
      assert.deepEqual(parseCommand('/discount pink 10.5'),{kind:'discount',slug:'pureform-4pc-set-pink',value:10.5});
      assert.deepEqual(parseCommand('/discount black off'),{kind:'discount',slug:'pureform-4pc-set-black',value:0});
      for (const text of ['/stock grey -1','/stock grey 1.5','/stock grey 100001','/discount pink 101','/discount pink 5.123','/stock red 3','please change stock to 5','/pay 1','/refund 20']) assert.equal(parseCommand(text).kind,'help');
    });
    await test.step('passes only authenticated identity and parsed fields, not the raw update',async () => {
      calls.length=0;
      assert.equal((await handler(request({...update(),private_extra:'discard'}))).status,200);
      const rpc=calls.find(call=>call.path.endsWith('/process_site_telegram_update'))!.body;
      assert.deepEqual(rpc,{p_update_id:100,p_sender_id:123456789,p_chat_id:123456789,p_owner_id:123456789,p_command:{kind:'stock',slug:'pureform-4pc-set-grey',value:24}});
    });
    await test.step('ignores group, bot, forwarded, edited and stale owner commands',async () => {
      calls.length=0;
      for (const altered of [
        {...message,chat:{id:-1,type:'group'}}, {...message,from:{id:123456789,is_bot:true}},
        {...message,forward_origin:{type:'user'}}, {...message,via_bot:{id:999}},
        {...message,date:Math.floor(Date.now()/1000)-301},
      ]) assert.equal((await handler(request({update_id:101,message:altered}))).status,200);
      assert.equal((await handler(request({update_id:101,edited_message:message}))).status,200);
      assert.equal(calls.length,0);
    });
    await test.step('rejects oversized or malformed requests and retries failed database writes',async () => {
      calls.length=0;
      assert.equal((await handler(request({padding:'x'.repeat(17000)}))).status,400);
      assert.equal((await handler(request({update_id:'100',message}))).status,400);
      assert.equal(calls.length,0);
      databaseFailure=true;
      const failed=await handler(request(update()));
      assert.equal(failed.status,503);
      assert(!JSON.stringify(await failed.json()).includes('private database error'));
      databaseFailure=false;
    });
    await test.step('confirmation callbacks require the bot-authored private message',async () => {
      calls.length=0;
      const callback={id:'callback-test',from:message.from,data:'confirm:00000000-0000-4000-8000-000000000001',message:{...message,from:{id:12345,is_bot:true}}};
      assert.equal((await handler(request({update_id:102,callback_query:callback}))).status,200);
      assert(calls.some(call=>call.path.endsWith('/answerCallbackQuery')));
      calls.length=0;
      assert.equal((await handler(request({update_id:103,callback_query:{...callback,message:{...callback.message,from:{id:54321,is_bot:true}}}}))).status,200);
      assert.equal(calls.length,0);
    });
    await test.step('delivery uses plain protected text and an authenticated admin link',async () => {
      calls.length=0;
      jobs=[{id:'job',lease:'lease',chat_id:null,message:'Payment received',order_id:'00000000-0000-4000-8000-000000000001'}];
      assert.deepEqual(await dispatchTelegram(),{claimed:1,sent:1});
      const sent=calls.find(call=>call.path.endsWith('/sendMessage'))!.body;
      assert.equal(sent.chat_id,123456789);
      assert.equal(sent.parse_mode,undefined);
      assert.equal(sent.protect_content,true);
      assert(String(sent.text).includes('https://store.example.test/admin/dashboard.html?view=orders&order='));
      const saved=calls.find(call=>call.path.endsWith('/finish_site_telegram_job'))!.body;
      assert.equal(saved.p_message_id,321);
    });
    await test.step('rate limits and uncertain delivery stay retryable, without leaking errors',async () => {
      calls.length=0;providerStatus=429;
      await dispatchTelegram();
      let saved=calls.find(call=>call.path.endsWith('/finish_site_telegram_job'))!.body;
      assert.equal(saved.p_error,'provider_rate_limit');assert.equal(saved.p_retry_after,30);
      calls.length=0;transportFailure=true;
      await dispatchTelegram();
      saved=calls.find(call=>call.path.endsWith('/finish_site_telegram_job'))!.body;
      assert.equal(saved.p_error,'network_uncertain');assert.equal(saved.p_retry_after,60);
      assert(!JSON.stringify(saved).includes('secret token'));
      calls.length=0;transportFailure=false;providerStatus=403;
      await dispatchTelegram();
      saved=calls.find(call=>call.path.endsWith('/finish_site_telegram_job'))!.body;
      assert.equal(saved.p_error,'provider_rejected');assert.equal(saved.p_retry_after,null);
      providerStatus=200;jobs=[];
    });
  } finally {
    globalThis.fetch=realFetch;
    for (const [key,value] of Object.entries(previous)) value===undefined?Deno.env.delete(key):Deno.env.set(key,value);
  }
});
