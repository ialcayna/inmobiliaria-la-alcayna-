-- Migración aditiva para proyectos Supabase ya configurados.
-- Crea una lista privada de propietarios sin modificar las tablas existentes.

create extension if not exists pgcrypto;

create table if not exists public.owners (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text not null,
  phone text not null default '',
  email text not null default '',
  dni text not null default '',
  address text not null default ''
);

alter table public.owners enable row level security;
alter table public.owners force row level security;
revoke all on public.owners from public, anon, authenticated;
grant select, insert, update, delete on public.owners to authenticated;

drop policy if exists "La Alcayna admin can manage owners" on public.owners;
create policy "La Alcayna admin can manage owners"
  on public.owners for all to authenticated
  using ((auth.jwt() ->> 'email') = 'inmoalcayna@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'inmoalcayna@gmail.com');
