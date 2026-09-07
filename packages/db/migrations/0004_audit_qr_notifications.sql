-- 0004_audit_qr_notifications.sql
-- QR verification tokens, notification log, immutable audit trail.

-- QR codes (opaque verification tokens) --------------------------------------
create table qr_codes (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  property_id      uuid references properties(id) on delete cascade,
  induction_id     uuid references inductions(id) on delete cascade,
  contractor_id    uuid references contractors(id) on delete cascade,
  token            text not null unique,          -- opaque; never an internal id
  purpose          text not null default 'verify'
                   check (purpose in ('verify','enrol')),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz
);
create index idx_qr_codes_org on qr_codes(organisation_id);
create index idx_qr_codes_property on qr_codes(property_id);

-- Notifications (outbound log) ------------------------------------------------
create table notifications (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  channel          text not null default 'email' check (channel in ('email','sms')),
  notif_type       text not null
                   check (notif_type in ('invite','completion','expiry_reminder',
                                         'expired','reinduction_required',
                                         'failed_or_overdue')),
  recipient        text not null,
  subject          text,
  body             text,
  entity_type      text,
  entity_id        uuid,
  status           text not null default 'queued'
                   check (status in ('queued','sent','failed')),
  sent_at          timestamptz,
  created_at       timestamptz not null default now()
);
create index idx_notifications_org on notifications(organisation_id);
create index idx_notifications_status on notifications(status);

-- Audit logs (IMMUTABLE, insert-only; enforced by trigger in 0005) -----------
create table audit_logs (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid references organisations(id) on delete set null,
  actor_user_id    uuid references users(id) on delete set null,
  event_type       text not null,                 -- e.g. 'induction.published'
  entity_type      text not null,
  entity_id        uuid,
  before_data      jsonb,
  after_data       jsonb,
  request_id       text,
  ip               inet,
  created_at       timestamptz not null default now()
);
create index idx_audit_logs_org on audit_logs(organisation_id);
create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index idx_audit_logs_created on audit_logs(created_at);
