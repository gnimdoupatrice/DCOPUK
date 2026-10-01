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
