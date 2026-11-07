-- RAJAWALI EVENT ORGANIZER — skema Supabase
-- Jalankan sekali di Supabase SQL Editor. Buat user admin terlebih dahulu di Authentication.
create extension if not exists pgcrypto;

create table if not exists public.organizer_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null default 'Olahraga',
  summary text,
  description text,
  venue text,
  start_date date not null,
  end_date date,
  registration_deadline date,
  status text not null default 'draft' check(status in ('draft','published','archived')),
  registration_type text not null default 'individual' check(registration_type in ('individual','team','both')),
  fee_mode text not null default 'free' check(fee_mode in ('free','manual_transfer')),
  fee_amount bigint not null default 0 check(fee_amount >= 0),
  fee_basis text not null default 'registration' check(fee_basis in ('registration','participant')),
  bank_name text,
  bank_account_number text,
  bank_account_holder text,
  approval_required boolean not null default true,
  cover_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_menus (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,
  target text not null,
  sort_order int not null default 0,
  is_visible boolean not null default true
);

create table if not exists public.event_fields (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  field_key text not null,
  label text not null,
  field_type text not null default 'text',
  is_required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  unique(event_id,field_key)
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  token text not null unique,
  registrant_name text,
  whatsapp text not null,
  registration_type text not null check(registration_type in ('individual','team')),
  team_name text,
  custom_data jsonb not null default '{}'::jsonb,
  payment_amount bigint not null default 0,
  payment_suffix char(3),
  payment_status text not null default 'not_required' check(payment_status in ('not_required','pending','verified','rejected')),
  registration_status text not null default 'pending' check(registration_status in ('pending','approved','rejected')),
  payment_verified_at timestamptz,
  payment_verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  participant_no text not null unique,
  full_name text not null,
  participant_role text not null default 'Peserta',
  team_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.event_assets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  bucket_name text not null default 'event-assets',
  object_path text not null,
  created_at timestamptz not null default now(),
  unique(bucket_name,object_path)
);

create table if not exists public.site_settings (
  id int primary key default 1 check(id=1),
  contact_email text,
  contact_phone text,
  contact_address text,
  social_url text,
  updated_at timestamptz not null default now()
);
insert into public.site_settings(id) values(1) on conflict(id) do nothing;

create index if not exists events_status_start_idx on public.events(status,start_date);
create index if not exists registrations_event_idx on public.registrations(event_id);
create index if not exists registrations_token_idx on public.registrations(token);
create index if not exists participants_event_idx on public.participants(event_id);

-- Admin check yang dipakai oleh Edge Function.
create or replace function public.is_organizer_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.organizer_admins where user_id=auth.uid()); $$;
revoke all on function public.is_organizer_admin() from public;
grant execute on function public.is_organizer_admin() to authenticated;

alter table public.organizer_admins enable row level security;
drop policy if exists "admins read own membership" on public.organizer_admins;
create policy "admins read own membership" on public.organizer_admins
  for select to authenticated using(user_id=auth.uid());

alter table public.events enable row level security;
alter table public.event_menus enable row level security;
alter table public.event_fields enable row level security;
alter table public.registrations enable row level security;
alter table public.participants enable row level security;
alter table public.event_assets enable row level security;
alter table public.site_settings enable row level security;

-- Public hanya dapat membaca event aktif dan konfigurasi form milik event aktif.
drop policy if exists "published events are public" on public.events;
create policy "published events are public" on public.events for select using(status='published');
drop policy if exists "admins manage events" on public.events;
create policy "admins manage events" on public.events for all to authenticated using(public.is_organizer_admin()) with check(public.is_organizer_admin());

drop policy if exists "public fields for published events" on public.event_fields;
create policy "public fields for published events" on public.event_fields for select using(exists(select 1 from public.events e where e.id=event_id and e.status='published'));
drop policy if exists "admins manage fields" on public.event_fields;
create policy "admins manage fields" on public.event_fields for all to authenticated using(public.is_organizer_admin()) with check(public.is_organizer_admin());

drop policy if exists "admins manage menus" on public.event_menus;
create policy "admins manage menus" on public.event_menus for all to authenticated using(public.is_organizer_admin()) with check(public.is_organizer_admin());

drop policy if exists "admins manage registrations" on public.registrations;
create policy "admins manage registrations" on public.registrations for all to authenticated using(public.is_organizer_admin()) with check(public.is_organizer_admin());

drop policy if exists "admins manage participants" on public.participants;
create policy "admins manage participants" on public.participants for all to authenticated using(public.is_organizer_admin()) with check(public.is_organizer_admin());

drop policy if exists "admins manage assets" on public.event_assets;
create policy "admins manage assets" on public.event_assets for all to authenticated using(public.is_organizer_admin()) with check(public.is_organizer_admin());

drop policy if exists "public can read contact" on public.site_settings;
create policy "public can read contact" on public.site_settings for select using(true);
drop policy if exists "admins update contact" on public.site_settings;
create policy "admins update contact" on public.site_settings for all to authenticated using(public.is_organizer_admin()) with check(public.is_organizer_admin());

-- Storage bucket untuk poster dan gambar event.
insert into storage.buckets(id,name,public) values('event-assets','event-assets',true) on conflict(id) do nothing;
drop policy if exists "public reads event assets" on storage.objects;
create policy "public reads event assets" on storage.objects for select using(bucket_id='event-assets');
drop policy if exists "admins upload event assets" on storage.objects;
create policy "admins upload event assets" on storage.objects for insert to authenticated with check(bucket_id='event-assets' and public.is_organizer_admin());
drop policy if exists "admins update event assets" on storage.objects;
create policy "admins update event assets" on storage.objects for update to authenticated using(bucket_id='event-assets' and public.is_organizer_admin()) with check(bucket_id='event-assets' and public.is_organizer_admin());
drop policy if exists "admins delete event assets" on storage.objects;
create policy "admins delete event assets" on storage.objects for delete to authenticated using(bucket_id='event-assets' and public.is_organizer_admin());

-- Tambahkan admin sesudah membuat user melalui Authentication:
-- insert into public.organizer_admins(user_id) values ('UUID_USER_DARI_AUTH_USERS');
