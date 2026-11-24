-- ============================================================
-- DCOP — Équipe, invitations et rôles (Tâche 3.1)
-- À exécuter APRÈS schema.sql dans le SQL Editor. Idempotent.
-- Tous les comptes déjà existants deviennent Directeur actif
-- (aucun blocage du compte actuel).
-- ============================================================

create table if not exists public.dcop_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('directeur','agent')),
  actif boolean not null default false,
  active_le timestamptz,
  active_par uuid references auth.users(id)
);
grant select, update on public.dcop_roles to authenticated;
grant all on public.dcop_roles to service_role;
alter table public.dcop_roles enable row level security;

create table if not exists public.dcop_profils (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nom text not null,
  prenom text not null,
  poste text not null,
  pole text not null,
  telephone text not null,
  cree_le timestamptz not null default now(),
  invitation_id uuid
);
grant select on public.dcop_profils to authenticated;
grant all on public.dcop_profils to service_role;
alter table public.dcop_profils enable row level security;

create table if not exists public.dcop_invitations (
  id uuid primary key default gen_random_uuid(),
  jeton_hash text not null unique,
  note text,
  cree_par uuid references auth.users(id) default auth.uid(),
  cree_le timestamptz not null default now(),
  expire_le timestamptz not null,
  utilisee_le timestamptz,
  utilisee_par uuid references auth.users(id) on delete set null,
  revoquee boolean not null default false
);
grant select, insert, update on public.dcop_invitations to authenticated;
grant all on public.dcop_invitations to service_role;
alter table public.dcop_invitations enable row level security;

-- Fonctions de droits (security definer : pas de récursion RLS)
create or replace function public.dcop_est_directeur() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.dcop_roles where user_id = auth.uid() and role = 'directeur' and actif)
$$;
create or replace function public.dcop_peut_ecrire() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.dcop_roles where user_id = auth.uid() and actif)
$$;
grant execute on function public.dcop_est_directeur() to authenticated;
grant execute on function public.dcop_peut_ecrire() to authenticated;

-- Reprise de l'existant : tous les comptes actuels = Directeur actif
insert into public.dcop_roles (user_id, role, actif, active_le)
select id, 'directeur', true, now() from auth.users
on conflict (user_id) do nothing;

-- Politiques équipe
drop policy if exists "Equipe - lecture roles" on public.dcop_roles;
create policy "Equipe - lecture roles" on public.dcop_roles for select to authenticated
  using (user_id = auth.uid() or public.dcop_est_directeur());
drop policy if exists "Equipe - activation" on public.dcop_roles;
create policy "Equipe - activation" on public.dcop_roles for update to authenticated
  using (public.dcop_est_directeur() and user_id <> auth.uid())
  with check (public.dcop_est_directeur() and user_id <> auth.uid());

drop policy if exists "Equipe - lecture profils" on public.dcop_profils;
create policy "Equipe - lecture profils" on public.dcop_profils for select to authenticated using (true);

drop policy if exists "Equipe - invitations" on public.dcop_invitations;
create policy "Equipe - invitations" on public.dcop_invitations for all to authenticated
  using (public.dcop_est_directeur()) with check (public.dcop_est_directeur());

-- Un Directeur ne peut changer que l'état actif (pas promouvoir un agent en directeur)
create or replace function public.dcop_roles_garde() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated' and new.role <> old.role then
    raise exception 'Changement de rôle interdit depuis l''application';
  end if;
  if new.actif and not old.actif then new.active_le := now(); new.active_par := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists dcop_roles_garde on public.dcop_roles;
create trigger dcop_roles_garde before update on public.dcop_roles
  for each row execute function public.dcop_roles_garde();

-- ------------------------------------------------------------
-- Lecture seule pour les comptes non activés : on remplace
-- les politiques « tout permis » par lecture libre + écriture
-- réservée aux comptes actifs.
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['poles','conventions','convention_points_focaux','convention_projets'] loop
    execute format('drop policy if exists "Personnel DCOP - %s" on public.%I', replace(t,'convention_',''), t);
    execute format('drop policy if exists "Personnel DCOP - points focaux" on public.%I', t);
    execute format('drop policy if exists "Lecture DCOP" on public.%I', t);
    execute format('drop policy if exists "Ecriture DCOP active" on public.%I', t);
    execute format('create policy "Lecture DCOP" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "Ecriture DCOP active" on public.%I for all to authenticated using (public.dcop_peut_ecrire()) with check (public.dcop_peut_ecrire())', t);
  end loop;
end $$;

drop policy if exists "Personnel DCOP - historique" on public.convention_historique;
drop policy if exists "Personnel DCOP - historique ajout" on public.convention_historique;
create policy "Personnel DCOP - historique ajout" on public.convention_historique
  for insert to authenticated with check (public.dcop_peut_ecrire());

drop policy if exists "Personnel DCOP - envoi PDF" on storage.objects;
create policy "Personnel DCOP - envoi PDF" on storage.objects
  for insert to authenticated with check (bucket_id = 'conventions-pdf' and public.dcop_peut_ecrire());
drop policy if exists "Personnel DCOP - suppression PDF" on storage.objects;
create policy "Personnel DCOP - suppression PDF" on storage.objects
  for delete to authenticated using (bucket_id = 'conventions-pdf' and public.dcop_peut_ecrire());
