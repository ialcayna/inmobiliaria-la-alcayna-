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

create table if not exists public.site_settings (
  id text primary key check (id = 'main'),
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Los datos de contacto e identificación de los propietarios son privados.
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

insert into public.site_settings (id, content) values ('main', '{
  "aboutTitle": "Una buena mudanza empieza con confianza.",
  "aboutText": "Comprar o vender una casa es una decisión importante. Por eso ponemos a las personas primero, explicamos cada paso y cuidamos los detalles que hacen que todo resulte más fácil.",
  "aboutStat": "100%",
  "aboutStatLabel": "Atención personal",
  "phone": "",
  "whatsapp": "",
  "email": "inmoalcayna@gmail.com",
  "reviews": []
}'::jsonb) on conflict (id) do nothing;

alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;

drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings"
  on public.site_settings for select to anon, authenticated using (true);

drop policy if exists "La Alcayna admin can update site settings" on public.site_settings;
create policy "La Alcayna admin can update site settings"
  on public.site_settings for update to authenticated
  using ((auth.jwt() ->> 'email') = 'inmoalcayna@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'inmoalcayna@gmail.com');

alter table public.properties enable row level security;
revoke all on public.properties from anon, authenticated;
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

alter table public.owners enable row level security;
alter table public.owners force row level security;
revoke all on public.owners from public, anon, authenticated;
grant select, insert, update, delete on public.owners to authenticated;

drop policy if exists "La Alcayna admin can manage owners" on public.owners;
create policy "La Alcayna admin can manage owners"
  on public.owners for all to authenticated
  using ((auth.jwt() ->> 'email') = 'inmoalcayna@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'inmoalcayna@gmail.com');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-photos', 'property-photos', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view property photos" on storage.objects;
drop policy if exists "La Alcayna admin can list property photos" on storage.objects;
create policy "La Alcayna admin can list property photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'property-photos' and (auth.jwt() ->> 'email') = 'inmoalcayna@gmail.com');

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
