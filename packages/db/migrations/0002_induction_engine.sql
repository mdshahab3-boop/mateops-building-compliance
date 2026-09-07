-- 0002_induction_engine.sql
-- Generic induction engine. Site Induction / House Rules / Traffic Management
-- Plan are CONTENT TYPES on this one engine, never hard-coded.

-- Source documents (uploaded PDFs/DOCX) --------------------------------------
create table documents (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  property_id      uuid references properties(id) on delete set null,
  title            text not null,
  doc_kind         text not null default 'other'
                   check (doc_kind in ('site_induction','house_rules',
                                       'traffic_management','emergency','other')),
  created_by       uuid references users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_documents_org on documents(organisation_id);
create index idx_documents_property on documents(property_id);
create trigger trg_documents_updated before update on documents
  for each row execute function set_updated_at();

-- Immutable document versions -------------------------------------------------
create table document_versions (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  document_id      uuid not null references documents(id) on delete cascade,
  version_number   integer not null,
  storage_key      text not null,               -- object storage ref
  page_count       integer,
  content_hash     text,
  uploaded_by      uuid references users(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (document_id, version_number)
);
create index idx_document_versions_org on document_versions(organisation_id);
create index idx_document_versions_document on document_versions(document_id);

-- Induction "template" (per property) ----------------------------------------
create table inductions (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  property_id      uuid not null references properties(id) on delete cascade,
  title            text not null,
  content_type     text not null default 'general'
                   check (content_type in ('general','site_induction','house_rules',
                                           'traffic_management','emergency')),
  is_mandatory     boolean not null default true,
  status           text not null default 'active'
                   check (status in ('active','archived')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_inductions_org on inductions(organisation_id);
create index idx_inductions_property on inductions(property_id);
create trigger trg_inductions_updated before update on inductions
  for each row execute function set_updated_at();

-- Immutable induction versions ------------------------------------------------
create table induction_versions (
  id                        uuid primary key default gen_random_uuid(),
  organisation_id           uuid not null references organisations(id) on delete cascade,
  induction_id              uuid not null references inductions(id) on delete cascade,
  version_number            integer not null,
  status                    text not null default 'draft'
                            check (status in ('draft','review','approved','published','archived')),
  effective_from            timestamptz,
  expires_after_days        integer,            -- null = no expiry
  pass_score                integer not null default 100,   -- percent
  max_attempts              integer,            -- null = unlimited
  randomise_questions       boolean not null default false,
  language                  text not null default 'en',
  source_document_version_id uuid references document_versions(id) on delete set null,
  declaration_text          text,
  content_hash              text,
  published_by              uuid references users(id) on delete set null,
  published_at              timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (induction_id, version_number)
);
create index idx_induction_versions_org on induction_versions(organisation_id);
create index idx_induction_versions_induction on induction_versions(induction_id);
create index idx_induction_versions_status on induction_versions(status);
create trigger trg_induction_versions_updated before update on induction_versions
  for each row execute function set_updated_at();

-- Sections --------------------------------------------------------------------
create table induction_sections (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references organisations(id) on delete cascade,
  induction_version_id uuid not null references induction_versions(id) on delete cascade,
  title                text not null,
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now()
);
create index idx_induction_sections_version on induction_sections(induction_version_id);
create index idx_induction_sections_org on induction_sections(organisation_id);

-- Slides (with source traceability) ------------------------------------------
create table induction_slides (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references organisations(id) on delete cascade,
  induction_version_id uuid not null references induction_versions(id) on delete cascade,
  section_id           uuid references induction_sections(id) on delete cascade,
  sort_order           integer not null default 0,
  title                text,
  body                 text,
  narration            text,
  source_document_id   uuid references documents(id) on delete set null,
  source_page          integer,
  safety_critical      boolean not null default false,
  reviewer_status      text not null default 'unreviewed'
                       check (reviewer_status in ('unreviewed','approved','rejected')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index idx_induction_slides_version on induction_slides(induction_version_id);
create index idx_induction_slides_org on induction_slides(organisation_id);
create trigger trg_induction_slides_updated before update on induction_slides
  for each row execute function set_updated_at();

-- Media attached to slides ----------------------------------------------------
create table induction_media (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  slide_id         uuid not null references induction_slides(id) on delete cascade,
  media_type       text not null check (media_type in ('image','video','diagram','map')),
  storage_key      text not null,
  alt_text         text,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now()
);
create index idx_induction_media_slide on induction_media(slide_id);
create index idx_induction_media_org on induction_media(organisation_id);

-- Knowledge check questions ---------------------------------------------------
create table induction_questions (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references organisations(id) on delete cascade,
  induction_version_id uuid not null references induction_versions(id) on delete cascade,
  section_id           uuid references induction_sections(id) on delete set null,
  prompt               text not null,
  question_type        text not null default 'single_choice'
                       check (question_type in ('single_choice','multi_choice','true_false')),
  explanation          text,
  safety_critical      boolean not null default false,
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now()
);
create index idx_induction_questions_version on induction_questions(induction_version_id);
create index idx_induction_questions_org on induction_questions(organisation_id);

-- Answer options --------------------------------------------------------------
create table induction_question_options (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  question_id      uuid not null references induction_questions(id) on delete cascade,
  label            text not null,
  is_correct       boolean not null default false,
  sort_order       integer not null default 0
);
create index idx_induction_question_options_question on induction_question_options(question_id);
create index idx_induction_question_options_org on induction_question_options(organisation_id);
