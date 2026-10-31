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
