-- Module 2 — Veille et alertes sur les conventions & partenariats (DCOP)
-- À exécuter une seule fois dans Supabase : SQL Editor > New query > Run.

create table if not exists public.poles (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.conventions (
  id uuid primary key default gen_random_uuid(),
  pole text not null,
  cadre_juridique text not null,
  partenaire_nom text not null,
  partenaire_pays text not null,
  partenaire_ville text,
  thematique text,
  date_signature date not null,
  duree_mois integer not null check (duree_mois > 0),
  date_echeance date not null,
  preavis_mois integer not null default 3 check (preavis_mois >= 0),
  reconduction text not null default 'Expresse',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.poles to authenticated;
grant select, insert, update, delete on public.conventions to authenticated;
grant all on public.poles to service_role;
grant all on public.conventions to service_role;

alter table public.poles enable row level security;
alter table public.conventions enable row level security;

-- Seul le personnel connecté de la DCOP accède au registre.
drop policy if exists "Personnel DCOP - poles" on public.poles;
create policy "Personnel DCOP - poles" on public.poles
  for all to authenticated using (true) with check (true);

drop policy if exists "Personnel DCOP - conventions" on public.conventions;
create policy "Personnel DCOP - conventions" on public.conventions
  for all to authenticated using (true) with check (true);

insert into public.poles (nom) values
  ('Partenariat National'),
  ('Partenariat International'),
  ('Mobilité Internationale'),
  ('Projets & Programmes')
on conflict (nom) do nothing;

-- ============================================================
-- Mise à jour Module 2 (finalisation) — à exécuter aussi (idempotent)
-- Archivage, document PDF, historique des actions
-- ============================================================
alter table public.conventions add column if not exists archived boolean not null default false;
alter table public.conventions add column if not exists archived_at timestamptz;
alter table public.conventions add column if not exists archive_note text;
alter table public.conventions add column if not exists pdf_path text;

create table if not exists public.convention_historique (
  id uuid primary key default gen_random_uuid(),
  convention_id uuid not null references public.conventions(id) on delete cascade,
  action text not null,
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.convention_historique to authenticated;
grant all on public.convention_historique to service_role;
alter table public.convention_historique enable row level security;

drop policy if exists "Personnel DCOP - historique" on public.convention_historique;
create policy "Personnel DCOP - historique" on public.convention_historique
  for all to authenticated using (true) with check (true);

-- Stockage privé des conventions scannées (PDF)
insert into storage.buckets (id, name, public)
values ('conventions-pdf', 'conventions-pdf', false)
on conflict (id) do nothing;

drop policy if exists "Personnel DCOP - lecture PDF" on storage.objects;
create policy "Personnel DCOP - lecture PDF" on storage.objects
  for select to authenticated using (bucket_id = 'conventions-pdf');
drop policy if exists "Personnel DCOP - envoi PDF" on storage.objects;
create policy "Personnel DCOP - envoi PDF" on storage.objects
  for insert to authenticated with check (bucket_id = 'conventions-pdf');
drop policy if exists "Personnel DCOP - suppression PDF" on storage.objects;
create policy "Personnel DCOP - suppression PDF" on storage.objects
  for delete to authenticated using (bucket_id = 'conventions-pdf');

-- Seuil d'alerte personnalisé par convention (jours avant échéance). NULL = règle générale J-150.
alter table public.conventions add column if not exists seuil_alerte_jours integer check (seuil_alerte_jours is null or seuil_alerte_jours >= 0);

-- Alerte personnalisée (date + heure choisies par le Directeur) et préavis optionnel
alter table public.conventions add column if not exists date_alerte date;
alter table public.conventions alter column preavis_mois drop not null;
alter table public.conventions alter column reconduction set default 'Non reconductible';

-- ============================================================
-- Mise à jour : e-mails d'alerte, points focaux, projets (idempotent)
-- ============================================================
alter table public.conventions add column if not exists emails_alerte text[] not null default '{}';

create table if not exists public.convention_points_focaux (
  id uuid primary key default gen_random_uuid(),
  convention_id uuid not null references public.conventions(id) on delete cascade,
  institution_type text not null check (institution_type in ('universite','partenaire')),
  nom text not null,
  prenom text not null,
  fonction text,
  email text,
  telephone text,
  recoit_alertes boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_points_focaux_convention on public.convention_points_focaux(convention_id);
grant select, insert, update, delete on public.convention_points_focaux to authenticated;
grant all on public.convention_points_focaux to service_role;
alter table public.convention_points_focaux enable row level security;
drop policy if exists "Personnel DCOP - points focaux" on public.convention_points_focaux;
create policy "Personnel DCOP - points focaux" on public.convention_points_focaux
  for all to authenticated using (true) with check (true);

create table if not exists public.convention_projets (
  id uuid primary key default gen_random_uuid(),
  convention_id uuid not null references public.conventions(id) on delete cascade,
  titre text not null,
  date_debut date,
  date_fin date,
  description text,
  activites text,
  budget_montant numeric check (budget_montant is null or budget_montant >= 0),
  budget_devise text default 'FCFA',
  apport_kara text,
  apport_partenaire text,
  lecons_apprises text,
  created_at timestamptz not null default now()
);
create index if not exists idx_projets_convention on public.convention_projets(convention_id);
grant select, insert, update, delete on public.convention_projets to authenticated;
grant all on public.convention_projets to service_role;
alter table public.convention_projets enable row level security;
drop policy if exists "Personnel DCOP - projets" on public.convention_projets;
create policy "Personnel DCOP - projets" on public.convention_projets
  for all to authenticated using (true) with check (true);

-- ============================================================
-- Alertes e-mail : reprise par destinataire (idempotent)
-- Exécuter ce bloc sur la base externe avant d'activer l'envoi.
-- ============================================================
alter table public.conventions add column if not exists heure_alerte time;
alter table public.conventions add column if not exists alarme_arretee_le timestamptz;
alter table public.conventions add column if not exists alarme_reportee_jusqu_a timestamptz;
alter table public.conventions add column if not exists email_alerte_envoye_pour timestamptz;
alter table public.conventions add column if not exists email_report_envoye_pour timestamptz;

create table if not exists public.convention_email_envois (
  convention_id uuid not null references public.conventions(id) on delete cascade,
  type_evenement text not null check (type_evenement in ('alerte', 'report')),
  moment_evenement timestamptz not null,
  destinataire text not null,
  envoye_le timestamptz not null default now(),
  primary key (convention_id, type_evenement, moment_evenement, destinataire)
);
grant all on public.convention_email_envois to service_role;
revoke all on public.convention_email_envois from anon, authenticated;
alter table public.convention_email_envois enable row level security;
-- Aucun accès navigateur : seul le traitement serveur authentifié par secret l'utilise.

-- ============================================================
-- Suivi des e-mails en clair + sécurité renforcée (idempotent)
-- À exécuter dans Supabase : SQL Editor > New query > Run.
-- ============================================================

-- 1. Accusés d'envoi : succès ou échec avec motif compréhensible
alter table public.convention_email_envois add column if not exists statut text not null default 'envoye';
alter table public.convention_email_envois add column if not exists motif_erreur text;
alter table public.convention_email_envois add column if not exists definitif boolean not null default false;
alter table public.convention_email_envois add column if not exists tentatives integer not null default 1;
alter table public.convention_email_envois drop constraint if exists convention_email_envois_statut_check;
alter table public.convention_email_envois add constraint convention_email_envois_statut_check check (statut in ('envoye', 'echec'));

-- Lecture seule pour le personnel connecté ; seul le serveur écrit.
grant select on public.convention_email_envois to authenticated;
drop policy if exists "Personnel DCOP - lecture envois" on public.convention_email_envois;
create policy "Personnel DCOP - lecture envois" on public.convention_email_envois
  for select to authenticated using (true);

-- 2. Historique infalsifiable : ajout et lecture uniquement.
-- (La suppression d'une convention efface encore son historique par cascade.)
revoke update, delete on public.convention_historique from authenticated;
drop policy if exists "Personnel DCOP - historique" on public.convention_historique;
drop policy if exists "Personnel DCOP - historique lecture" on public.convention_historique;
drop policy if exists "Personnel DCOP - historique ajout" on public.convention_historique;
create policy "Personnel DCOP - historique lecture" on public.convention_historique
  for select to authenticated using (true);
create policy "Personnel DCOP - historique ajout" on public.convention_historique
  for insert to authenticated with check (true);

-- 3. Verrou juridique 48 h côté base : identité du contrat figée après la fenêtre de correction.
-- Les dates et l'alerte restent modifiables pour permettre les avenants.
create or replace function public.verrou_convention_48h()
returns trigger language plpgsql as $$
begin
  if now() > old.created_at + interval '48 hours'
     and auth.role() = 'authenticated'
     and (new.pole is distinct from old.pole
       or new.cadre_juridique is distinct from old.cadre_juridique
       or new.partenaire_nom is distinct from old.partenaire_nom
       or new.partenaire_pays is distinct from old.partenaire_pays
       or new.date_signature is distinct from old.date_signature
       or new.created_at is distinct from old.created_at) then
    raise exception 'Convention verrouillée : les informations juridiques ne sont plus modifiables après 48 heures. Utilisez un avenant.';
  end if;
  return new;
end $$;
drop trigger if exists verrou_convention_48h on public.conventions;
create trigger verrou_convention_48h before update on public.conventions
  for each row execute function public.verrou_convention_48h();

-- 4. À vérifier dans le tableau de bord Supabase (Authentication > Sign In / Providers) :
--    désactiver « Allow new users to sign up » pour que seuls les comptes créés par la DCOP existent.
