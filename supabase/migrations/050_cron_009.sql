-- 050_cron_009.sql
-- register 2 cron jobs for on-chain mirror

SELECT cron.schedule(
  'chain-mirror-dispatcher',
  '*/5 * * * *',
  $$
    select net.http_post(
      url:='http://kong:8000/functions/v1/chain-mirror-dispatcher',
      headers:=jsonb_build_object('Content-Type', 'application/json', 'Authorization', current_setting('request.jwt.claim.service_role_key', true))
    );
  $$
);

SELECT cron.schedule(
  'chain-unmirror-dispatcher',
  '*/15 * * * *',
  $$
    select net.http_post(
      url:='http://kong:8000/functions/v1/chain-unmirror-dispatcher',
      headers:=jsonb_build_object('Content-Type', 'application/json', 'Authorization', current_setting('request.jwt.claim.service_role_key', true))
    );
  $$
);
