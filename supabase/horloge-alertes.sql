-- Horloge autonome des alertes DCOP (24h/24, même si aucun écran n'est ouvert).
-- À exécuter UNE fois dans Supabase > SQL Editor, après avoir remplacé les 2 valeurs entre < >.
-- Chaque minute, la base appelle le serveur d'envoi ; l'anti-doublon garantit
-- qu'un destinataire ne reçoit jamais deux fois le même e-mail.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('verification-alertes-dcop')
where exists (select 1 from cron.job where jobname = 'verification-alertes-dcop');

select cron.schedule(
  'verification-alertes-dcop',
  '* * * * *',
  $$
  select net.http_post(
    url := '<ADRESSE_DU_SITE>/api/public/alertes-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <CRON_SECRET>')
  );
  $$
);

-- Purge quotidienne des conventions restées 30 jours complets en corbeille.
select cron.unschedule('purge-corbeille-dcop')
where exists (select 1 from cron.job where jobname = 'purge-corbeille-dcop');

select cron.schedule(
  'purge-corbeille-dcop',
  '17 3 * * *',
  $$
  select net.http_post(
    url := '<ADRESSE_DU_SITE>/api/public/corbeille',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <CRON_SECRET>')
  );
  $$
);

-- Vérifier : select * from cron.job;  Historique : select * from cron.job_run_details order by start_time desc limit 10;
