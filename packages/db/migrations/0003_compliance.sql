-- 0003_compliance.sql
-- Attempts, answers, declarations, signatures, immutable certificates, and the
-- computed compliance record per (contractor x induction).

-- Attempts --------------------------------------------------------------------
create table induction_attempts (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references organisations(id) on delete cascade,
  property_id          uuid references properties(id) on delete set null,
  contractor_id        uuid not null references contractors(id) on delete cascade,
  induction_version_id uuid not null references induction_versions(id) on delete cascade,
  status               text not null default 'in_progress'
                       check (status in ('in_progress','passed','failed','abandoned')),
  score                integer,
  passed               boolean,
  progress             jsonb not null default '{}'::jsonb,   -- section/slide completion
  verification_token   text unique,                          -- opaque, for QR/cert
  idempotency_key      text,
  ip                   inet,
  user_agent           text,
  started_at           timestamptz not null default now(),
  completed_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (organisation_id, idempotency_key)
);
create index idx_attempts_org on induction_attempts(organisation_id);
create index idx_attempts_contractor on induction_attempts(contractor_id);
create index idx_attempts_version on induction_attempts(induction_version_id);
create trigger trg_attempts_updated before update on induction_attempts
  for each row execute function set_updated_at();

-- Answers ---------------------------------------------------------------------
create table induction_answers (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references organisations(id) on delete cascade,
  attempt_id           uuid not null references induction_attempts(id) on delete cascade,
  question_id          uuid not null references induction_questions(id) on delete cascade,
  selected_option_ids  uuid[] not null default '{}',
  is_correct           boolean,
  answered_at          timestamptz not null default now()
);
create index idx_answers_attempt on induction_answers(attempt_id);
create index idx_answers_org on induction_answers(organisation_id);

-- Declarations (the exact text accepted) -------------------------------------
create table declarations (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references organisations(id) on delete cascade,
  attempt_id           uuid not null references induction_attempts(id) on delete cascade,
  declaration_text     text not null,
  induction_version_id uuid not null references induction_versions(id) on delete cascade,
  accepted_at          timestamptz not null default now()
);
create index idx_declarations_attempt on declarations(attempt_id);
create index idx_declarations_org on declarations(organisation_id);

-- Signatures ------------------------------------------------------------------
create table signatures (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  attempt_id       uuid not null references induction_attempts(id) on delete cascade,
  storage_key      text,                       -- signature image
  signed_name      text not null,
  ip               inet,
  user_agent       text,
  signed_at        timestamptz not null default now()
);
create index idx_signatures_attempt on signatures(attempt_id);
create index idx_signatures_org on signatures(organisation_id);

-- Certificates (IMMUTABLE, insert-only; enforced by trigger in 0005) ----------
create table certificates (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references organisations(id) on delete cascade,
  property_id          uuid references properties(id) on delete set null,
  contractor_id        uuid not null references contractors(id) on delete cascade,
  induction_version_id uuid not null references induction_versions(id) on delete cascade,
  attempt_id           uuid not null references induction_attempts(id) on delete cascade,
  certificate_number   text not null unique,       -- human-facing id
  storage_key          text,                       -- signed PDF ref
  content_hash         text,                       -- tamper-evidence
  issued_at            timestamptz not null default now(),
  valid_until          timestamptz
);
create index idx_certificates_org on certificates(organisation_id);
create index idx_certificates_contractor on certificates(contractor_id);

-- Compliance records (current computed status) -------------------------------
create table compliance_records (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references organisations(id) on delete cascade,
  property_id          uuid not null references properties(id) on delete cascade,
  contractor_id        uuid not null references contractors(id) on delete cascade,
  induction_id         uuid not null references inductions(id) on delete cascade,
  current_version_id   uuid references induction_versions(id) on delete set null,
  latest_attempt_id    uuid references induction_attempts(id) on delete set null,
  certificate_id       uuid references certificates(id) on delete set null,
  status               text not null default 'pending'
                       check (status in ('compliant','pending','expiring',
                                         'expired','reinduction_required')),
  valid_until          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (contractor_id, induction_id)
);
create index idx_compliance_org on compliance_records(organisation_id);
create index idx_compliance_property on compliance_records(property_id);
create index idx_compliance_status on compliance_records(status);
create trigger trg_compliance_updated before update on compliance_records
  for each row execute function set_updated_at();
