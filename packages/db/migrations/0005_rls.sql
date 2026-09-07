-- 0005_rls.sql
-- Row-Level Security: the HARD tenant boundary. The runtime role app_user can
-- only ever touch rows whose organisation_id matches the request context set via
-- SET LOCAL app.current_org_id (see @scip/db withTenant). Platform admins are
-- honoured explicitly via app.is_platform_admin.

-- Context helpers -------------------------------------------------------------
create or replace function app_current_org_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.current_org_id', true), '')::uuid
$$;

create or replace function app_current_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid
$$;

create or replace function app_is_platform_admin() returns boolean
language sql stable as $$
  select coalesce(current_setting('app.is_platform_admin', true), 'false') = 'true'
$$;

-- Standard org-scoped policy applied to every tenant table -------------------
do $$
declare
  t text;
  org_tables text[] := array[
    'subscriptions','properties','locations','user_roles',
    'contractor_companies','contractors','contractor_documents',
    'documents','document_versions','inductions','induction_versions',
    'induction_sections','induction_slides','induction_media',
    'induction_questions','induction_question_options',
    'induction_attempts','induction_answers','declarations','signatures',
    'certificates','compliance_records','qr_codes','notifications','audit_logs'
  ];
begin
  foreach t in array org_tables loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy tenant_isolation on %I '
      'using (organisation_id = app_current_org_id() or app_is_platform_admin()) '
      'with check (organisation_id = app_current_org_id() or app_is_platform_admin())',
      t);
  end loop;
end $$;

-- organisations: own org visible; only platform admin creates/deletes ---------
alter table organisations enable row level security;
alter table organisations force row level security;
create policy org_select on organisations for select
  using (id = app_current_org_id() or app_is_platform_admin());
create policy org_update on organisations for update
  using (id = app_current_org_id() or app_is_platform_admin())
  with check (id = app_current_org_id() or app_is_platform_admin());
create policy org_insert on organisations for insert
  with check (app_is_platform_admin());
create policy org_delete on organisations for delete
  using (app_is_platform_admin());

-- users: same org, or self, or platform admin --------------------------------
alter table users enable row level security;
alter table users force row level security;
create policy users_rw on users
  using (organisation_id = app_current_org_id()
         or id = app_current_user_id()
         or app_is_platform_admin())
  with check (organisation_id = app_current_org_id() or app_is_platform_admin());

-- sessions: only the owning user (or platform admin) -------------------------
alter table sessions enable row level security;
alter table sessions force row level security;
create policy sessions_rw on sessions
  using (user_id = app_current_user_id() or app_is_platform_admin())
  with check (user_id = app_current_user_id() or app_is_platform_admin());

-- roles + plans: global read-only lookups ------------------------------------
alter table roles enable row level security;
alter table roles force row level security;
create policy roles_read on roles for select using (true);

alter table plans enable row level security;
alter table plans force row level security;
create policy plans_read on plans for select using (true);
create policy plans_write on plans for all
  using (app_is_platform_admin()) with check (app_is_platform_admin());
