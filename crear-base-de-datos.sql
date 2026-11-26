-- Configuración de fichas y fotografías para Inmobiliaria La Alcayna.
-- Ejecutar en Supabase > SQL Editor > New query.

create extension if not exists pgcrypto;

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  type text not null check (type in ('piso', 'casa', 'atico', 'local', 'terreno')),
  operation text not null check (operation in ('venta', 'alquiler')),
  price numeric not null check (price >= 0),
  location text not null,
  address text not null default '',
  map_url text not null default '',
  bedrooms integer not null default 0,
  bathrooms integer not null default 0,
  area numeric not null default 0,
  parking integer not null default 0,
  badge text not null default '',
  description text not null default '',
  features text[] not null default '{}',
  images jsonb not null default '[]'::jsonb,
  is_published boolean not null default true
);

alter table public.properties enable row level security;
grant select on public.properties to anon, authenticated;
grant insert, update, delete on public.properties to authenticated;

drop policy if exists "Public and admin can read properties" on public.properties;
create policy "Public and admin can read properties"
  on public.properties for select to anon, authenticated
  using (is_published or (auth.jwt() ->> 'email') = 'inmoalcayna@gmail.com');

drop policy if exists "La Alcayna admin can add properties" on public.properties;
create policy "La Alcayna admin can add properties"
  on public.properties for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'inmoalcayna@gmail.com');

drop policy if exists "La Alcayna admin can update properties" on public.properties;
create policy "La Alcayna admin can update properties"
  on public.properties for update to authenticated
  using ((auth.jwt() ->> 'email') = 'inmoalcayna@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'inmoalcayna@gmail.com');

drop policy if exists "La Alcayna admin can delete properties" on public.properties;
create policy "La Alcayna admin can delete properties"
  on public.properties for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'inmoalcayna@gmail.com');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-photos', 'property-photos', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view property photos" on storage.objects;
create policy "Public can view property photos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'property-photos');

drop policy if exists "La Alcayna admin can upload property photos" on storage.objects;
create policy "La Alcayna admin can upload property photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'property-photos' and (auth.jwt() ->> 'email') = 'inmoalcayna@gmail.com');

drop policy if exists "La Alcayna admin can update property photos" on storage.objects;
create policy "La Alcayna admin can update property photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'property-photos' and (auth.jwt() ->> 'email') = 'inmoalcayna@gmail.com')
  with check (bucket_id = 'property-photos' and (auth.jwt() ->> 'email') = 'inmoalcayna@gmail.com');

drop policy if exists "La Alcayna admin can delete property photos" on storage.objects;
create policy "La Alcayna admin can delete property photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'property-photos' and (auth.jwt() ->> 'email') = 'inmoalcayna@gmail.com');
