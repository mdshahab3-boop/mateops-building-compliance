-- 0001_core.sql
-- Platform + identity + contractor tables. Authoritative schema (part 1).

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- case-insensitive email

-- Shared trigger to maintain updated_at ---------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Subscription plans (GLOBAL, not tenant-scoped) -----------------------------
create table plans (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,          -- 'starter' | 'pro' | 'enterprise'
  name              text not null,
  max_properties    integer,                       -- null = unlimited
  max_active_contractors integer,                  -- null = unlimited
  features          jsonb not null default '{}'::jsonb,
  monthly_price_cents integer not null default 0,
  currency          text not null default 'AUD',
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger trg_plans_updated before update on plans
  for each row execute function set_updated_at();

-- Organisations (TENANT ROOT) ------------------------------------------------
create table organisations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  abn          text,
  brand        jsonb not null default '{}'::jsonb,   -- logo url, colours
  status       text not null default 'active'
               check (status in ('active','suspended','inactive')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_org_updated before update on organisations
  for each row execute function set_updated_at();

-- Subscriptions (org <-> plan) -----------------------------------------------
create table subscriptions (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  plan_id          uuid not null references plans(id),
  status           text not null default 'trialing'
                   check (status in ('trialing','active','past_due','canceled','paused')),
  current_period_start timestamptz,
  current_period_end   timestamptz,
  external_ref     text,                            -- payment provider id
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_subscriptions_org on subscriptions(organisation_id);
create trigger trg_subscriptions_updated before update on subscriptions
  for each row execute function set_updated_at();

-- Properties (buildings) -----------------------------------------------------
create table properties (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  name             text not null,                   -- '101-121 Castlereagh St'
  address_line1    text,
  address_line2    text,
  suburb           text,
  state            text,
  postcode         text,
  timezone         text not null default 'Australia/Sydney',
  status           text not null default 'active'
                   check (status in ('active','inactive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_properties_org on properties(organisation_id);
create trigger trg_properties_updated before update on properties
  for each row execute function set_updated_at();

-- Locations (sub-areas within a property) ------------------------------------
create table locations (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  property_id      uuid not null references properties(id) on delete cascade,
  name             text not null,                   -- 'B1 Loading Dock', 'Riser 4'
  description      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_locations_property on locations(property_id);
create index idx_locations_org on locations(organisation_id);
create trigger trg_locations_updated before update on locations
  for each row execute function set_updated_at();

-- Users ----------------------------------------------------------------------
-- organisation_id is NULL for platform admins.
create table users (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid references organisations(id) on delete cascade,
  email            citext not null,
  password_hash    text,                            -- null until invite accepted
  full_name        text not null,
  phone            text,
  is_platform_admin boolean not null default false,
  status           text not null default 'invited'
                   check (status in ('active','invited','disabled')),
  last_login_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organisation_id, email)
);
create index idx_users_org on users(organisation_id);
create trigger trg_users_updated before update on users
  for each row execute function set_updated_at();

-- Sessions (opaque tokens; only the hash is stored) --------------------------
create table sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  token_hash       text not null unique,            -- sha-256 of raw token
  ip               inet,
  user_agent       text,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  revoked_at       timestamptz
);
create index idx_sessions_user on sessions(user_id);
create index idx_sessions_expires on sessions(expires_at);

-- Roles (seeded) -------------------------------------------------------------
create table roles (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         text not null,
  description  text
);

-- user_roles (optionally property-scoped) ------------------------------------
create table user_roles (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid references organisations(id) on delete cascade,
  user_id          uuid not null references users(id) on delete cascade,
  role_id          uuid not null references roles(id),
  property_id      uuid references properties(id) on delete cascade,
  created_at       timestamptz not null default now(),
  unique (user_id, role_id, property_id)
);
create index idx_user_roles_user on user_roles(user_id);
create index idx_user_roles_org on user_roles(organisation_id);

-- Contractor companies -------------------------------------------------------
create table contractor_companies (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  name             text not null,
  abn              text,
  contact_email    citext,
  contact_phone    text,
  status           text not null default 'active'
                   check (status in ('active','inactive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_contractor_companies_org on contractor_companies(organisation_id);
create trigger trg_contractor_companies_updated before update on contractor_companies
  for each row execute function set_updated_at();

-- Contractors (individual workers) -------------------------------------------
create table contractors (
  id                     uuid primary key default gen_random_uuid(),
  organisation_id        uuid not null references organisations(id) on delete cascade,
  contractor_company_id  uuid references contractor_companies(id) on delete set null,
  user_id                uuid references users(id) on delete set null,
  full_name              text not null,
  email                  citext,
  phone                  text,
  trade                  text,
  status                 text not null default 'active'
                         check (status in ('active','inactive')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index idx_contractors_org on contractors(organisation_id);
create index idx_contractors_company on contractors(contractor_company_id);
create trigger trg_contractors_updated before update on contractors
  for each row execute function set_updated_at();

-- Contractor documents (insurances / licences / SWMS with expiry) ------------
create table contractor_documents (
  id                     uuid primary key default gen_random_uuid(),
  organisation_id        uuid not null references organisations(id) on delete cascade,
  contractor_company_id  uuid references contractor_companies(id) on delete cascade,
  contractor_id          uuid references contractors(id) on delete cascade,
  doc_type               text not null
                         check (doc_type in (
                           'insurance_public_liability','insurance_workers_comp',
                           'license','swms','whs_plan','other')),
  title                  text not null,
  storage_key            text,                       -- object storage ref
  issued_on              date,
  expires_on             date,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (contractor_company_id is not null or contractor_id is not null)
);
create index idx_contractor_documents_org on contractor_documents(organisation_id);
create index idx_contractor_documents_expires on contractor_documents(expires_on);
create trigger trg_contractor_documents_updated before update on contractor_documents
  for each row execute function set_updated_at();

-- Seed roles ------------------------------------------------------------------
insert into roles (code, name, description) values
  ('platform_admin','Platform Admin','All organisations, plans, system settings, support/audit'),
  ('org_admin','Organisation Admin','Properties, contractors, inductions, users, reports'),
  ('building_manager','Building Manager','Assigned properties, contractors, compliance, reports'),
  ('security','Security / Concierge','QR verification, view current compliance only'),
  ('contractor_company_admin','Contractor Company Admin','Company profile, workers, induction status, certificates'),
  ('contractor_worker','Contractor Worker','Own profile, assigned inductions, attempts, certificates');

-- Seed plans ------------------------------------------------------------------
insert into plans (code, name, max_properties, max_active_contractors, monthly_price_cents, features) values
  ('starter','Starter',1,150,0,
    '{"ai_builder":false,"insurance_tracking":false,"sms":false,"white_label":false,"api":false}'::jsonb),
  ('pro','Pro',10,2000,0,
    '{"ai_builder":true,"insurance_tracking":true,"sms":true,"white_label":false,"api":false}'::jsonb),
  ('enterprise','Enterprise',null,null,0,
    '{"ai_builder":true,"insurance_tracking":true,"sms":true,"white_label":true,"api":true,"sso":true}'::jsonb);
