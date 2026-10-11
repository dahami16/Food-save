-- ============================================================
-- Food Save — initial database schema + reference seed data
-- Stage: database schema only (no backend, no endpoints).
--
-- Contents, in order:
--   1. profiles table + auto-profile trigger (Supabase Auth)
--   2. categories table        (15 seeded rows, single source)
--   3. dietary_options table   (5 seeded rows)
--   4. price_options table     (10 seeded AUD ranges)
--   5. locations table         (30 seeded Australian localities)
--   6. food_items table        (NO sample food inserts — admin adds)
--   7. Indexes
--   8. Row Level Security (enabled; no permissive public policies)
--   9. Reference-data seeds (all rerunnable via ON CONFLICT)
--
-- Conventions:
--   - No passwords or password hashes anywhere: Supabase Auth
--     (auth.users) owns credentials and hashing exclusively.
--   - No user_preferences table (account toggles stay frontend-only).
--   - No storage buckets in this stage (images come later).
--   - All seed statements are safe to rerun (ON CONFLICT DO NOTHING).
-- ============================================================

-- Required for gen_random_uuid() defaults.
create extension if not exists "pgcrypto";

-- ==================== 1. profiles ====================
-- One row per Supabase Auth user. Role is customer by default;
-- admin promotion happens only via an authorised DB operation.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text not null unique,
  role text not null default 'customer'
    constraint profiles_role_check check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile on every new auth signup. Secure by design:
-- SECURITY DEFINER with a restricted search_path, schema-qualified
-- references, ON CONFLICT guard against duplicates, and the role is
-- ALWAYS 'customer' — signup metadata can never grant admin access.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==================== 2. categories ====================
-- Single source of truth for BOTH the category cards and the
-- Filters page category options. 15 rows seeded in the fixed
-- order below ('Deserts' spelling preserved). Burgers and Pizza
-- appear ONCE (no duplicates). No image_url / visibility flags —
-- every category is available everywhere; display_order drives
-- frontend ordering. The main /food listing shows admin-added
-- products, not a separate category grid.
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  display_order integer not null
);

insert into public.categories (name, slug, display_order) values
  ('Fast Food', 'fast-food', 1),
  ('Breakfast & Brunch', 'breakfast-brunch', 2),
  ('Mexican', 'mexican', 3),
  ('Bakery', 'bakery', 4),
  ('Deserts', 'deserts', 5),
  ('Burgers', 'burgers', 6),
  ('Indian', 'indian', 7),
  ('Pizza', 'pizza', 8),
  ('Brunch', 'brunch', 9),
  ('Dinner', 'dinner', 10),
  ('Chinese', 'chinese', 11),
  ('Salads', 'salads', 12),
  ('Soups', 'soups', 13),
  ('Breakfast', 'breakfast', 14),
  ('Italian', 'italian', 15)
on conflict (name) do nothing;

-- ==================== 3. dietary_options ====================
-- Single source of truth for the Filters Dietary section and the
-- Admin Add Food form. 'Any' stays frontend-only and is never
-- stored here. food_items.dietary_id is a REQUIRED foreign key.
create table if not exists public.dietary_options (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_order integer not null
);

insert into public.dietary_options (name, display_order) values
  ('Vegetarian', 1),
  ('Vegan', 2),
  ('Gluten-Free', 3),
  ('Meat', 4),
  ('Seafood', 5)
on conflict (name) do nothing;

-- ==================== 4. price_options ====================
-- Filter ranges ONLY (not product prices): the Filters page shows
-- these 10 AUD ranges; a product matches when its exact
-- food_items.price falls inside the selected range (inclusive on
-- both ends; a NULL max_price means no upper limit). The admin
-- enters an exact price per product instead of picking a range,
-- so food_items has NO price_id foreign key. NUMERIC(10,2) avoids
-- floating-point money errors. 'All'/'Any' stay frontend-only.
create table if not exists public.price_options (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  min_price numeric(10,2) not null,
  max_price numeric(10,2),
  sort_order integer not null,
  constraint price_options_range_check
    check (max_price is null or max_price >= min_price)
);

insert into public.price_options (label, min_price, max_price, sort_order) values
  ('A$0–A$4.99', 0.00, 4.99, 1),
  ('A$5–A$9.99', 5.00, 9.99, 2),
  ('A$10–A$14.99', 10.00, 14.99, 3),
  ('A$15–A$19.99', 15.00, 19.99, 4),
  ('A$20–A$24.99', 20.00, 24.99, 5),
  ('A$25–A$29.99', 25.00, 29.99, 6),
  ('A$30–A$39.99', 30.00, 39.99, 7),
  ('A$40–A$49.99', 40.00, 49.99, 8),
  ('A$50–A$74.99', 50.00, 74.99, 9),
  ('A$75+', 75.00, null, 10)
on conflict (label) do nothing;

-- ==================== 5. locations ====================
-- Single source of truth for the Filters location list and the
-- Admin Add Food location picker. Each location is ONE text value
-- (Australian locality/suburb, state, postcode for filtering —
-- not verified shop street addresses). No extra columns.
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  address text not null unique
);

insert into public.locations (address) values
  ('Sydney CBD, NSW 2000'),
  ('Parramatta, NSW 2150'),
  ('Bondi, NSW 2026'),
  ('Newtown, NSW 2042'),
  ('Chatswood, NSW 2067'),
  ('Manly, NSW 2095'),
  ('Melbourne CBD, VIC 3000'),
  ('Carlton, VIC 3053'),
  ('Fitzroy, VIC 3065'),
  ('Richmond, VIC 3121'),
  ('St Kilda, VIC 3182'),
  ('Footscray, VIC 3011'),
  ('Brisbane CBD, QLD 4000'),
  ('South Brisbane, QLD 4101'),
  ('Fortitude Valley, QLD 4006'),
  ('West End, QLD 4101'),
  ('Surfers Paradise, QLD 4217'),
  ('Maroochydore, QLD 4558'),
  ('Perth CBD, WA 6000'),
  ('Fremantle, WA 6160'),
  ('Northbridge, WA 6003'),
  ('Adelaide CBD, SA 5000'),
  ('Glenelg, SA 5045'),
  ('Canberra City, ACT 2601'),
  ('Hobart CBD, TAS 7000'),
  ('Launceston, TAS 7250'),
  ('Darwin City, NT 0800'),
  ('Cairns, QLD 4870'),
  ('Townsville, QLD 4810'),
  ('Newcastle, NSW 2300')
on conflict (address) do nothing;

-- ==================== 6. food_items ====================
-- Admin-added products shown on the customer /food listing (with
-- actual prices) and on Admin Home / Expiry Alarm. Exact product
-- price in AUD (NUMERIC, never negative) — NO price_id: price
-- filtering compares food_items.price against the selected
-- price_options range in the backend. Dietary is REQUIRED.
-- image_url stores a Supabase Storage public URL (buckets are a
-- later stage — no bucket created here). NO sample food inserts;
-- the admin creates products through the app.
create table if not exists public.food_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text not null,
  category_id uuid not null references public.categories (id),
  location_id uuid not null references public.locations (id),
  dietary_id uuid not null references public.dietary_options (id),
  price numeric(10,2) not null
    constraint food_items_price_non_negative check (price >= 0),
  expiry_date date not null,
  reminder_enabled boolean not null default true,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ==================== 7. Indexes ====================
-- Cover the foreign keys and the fields the filter queries use.
create index if not exists food_items_category_id_idx
  on public.food_items (category_id);
create index if not exists food_items_location_id_idx
  on public.food_items (location_id);
create index if not exists food_items_dietary_id_idx
  on public.food_items (dietary_id);
create index if not exists food_items_price_idx
  on public.food_items (price);
create index if not exists food_items_expiry_date_idx
  on public.food_items (expiry_date);
create index if not exists food_items_created_by_idx
  on public.food_items (created_by);
create index if not exists food_items_name_trgm_like_idx
  on public.food_items (name);

-- ==================== 8. Row Level Security ====================
-- Enabled on every table in this stage. No permissive public
-- access: no policies allowing anonymous reads/writes, no
-- role self-promotion, no unauthorised product modification.
-- The Python backend uses the SECRET (service_role) key, which
-- bypasses RLS; narrow user-facing policies are added in a later
-- stage only if a direct client-to-Supabase path is ever needed.
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.dietary_options enable row level security;
alter table public.price_options enable row level security;
alter table public.locations enable row level security;
alter table public.food_items enable row level security;

-- End of initial schema migration.