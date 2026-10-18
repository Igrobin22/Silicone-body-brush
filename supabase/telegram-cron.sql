-- Run only after deploying telegram-bot and saving TELEGRAM_DISPATCH_SECRET in
-- both Edge Function Secrets and Vault (name: pureform_telegram_dispatch_secret).
-- Never put a bot token, service-role key or real dispatch secret in this file.
-- Enable pg_cron and pg_net in the dashboard before running this setup.
do $$
begin
  if not exists(select 1 from vault.decrypted_secrets where name='pureform_telegram_dispatch_secret') then
    raise exception 'Save the dispatch secret in Vault first';
  end if;
end;
$$;
select cron.schedule('pureform-telegram-delivery','* * * * *', $job$
  select net.http_post(
    url:='https://hibfipskhksboubibwbz.supabase.co/functions/v1/telegram-bot/dispatch',
    headers:=jsonb_build_object('Content-Type','application/json','x-telegram-dispatch-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='pureform_telegram_dispatch_secret')),
    body:='{}'::jsonb,timeout_milliseconds:=60000
  );
$job$);
