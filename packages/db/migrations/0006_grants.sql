-- 0006_grants.sql
-- Least-privilege grants for the runtime role app_user. The role is created by
-- the DB init script (infrastructure/docker/postgres-init) so it exists before
-- migrations run. Immutability of certificates/audit is enforced here by simply
-- NOT granting UPDATE/DELETE (superuser cascades still work; app code cannot tamper).

grant usage on schema public to app_user;

-- Baseline DML on all current tables -----------------------------------------
grant select, insert, update, delete on all tables in schema public to app_user;

-- Insert-only / immutable evidence tables ------------------------------------
revoke update, delete on certificates from app_user;
revoke update, delete on audit_logs  from app_user;

-- Read-only lookups for the app role -----------------------------------------
revoke insert, update, delete on roles from app_user;
revoke insert, update, delete on plans from app_user;

-- Protect users.password_hash: app_user must never read or write it directly.
-- Password lifecycle goes through the SECURITY DEFINER auth functions (0007).
revoke select, insert, update on users from app_user;
grant select (id, organisation_id, email, full_name, phone, is_platform_admin,
              status, last_login_at, created_at, updated_at)
  on users to app_user;
grant insert (id, organisation_id, email, full_name, phone, is_platform_admin, status)
  on users to app_user;
grant update (organisation_id, email, full_name, phone, is_platform_admin,
              status, last_login_at)
  on users to app_user;

-- Sessions are managed only through the auth functions --------------------
revoke insert, update, delete on sessions from app_user;
-- (SELECT retained so a user can list/revoke their own sessions via RLS.)

-- Future tables created by later migrations should also default to app_user.
alter default privileges in schema public
  grant select, insert, update, delete on tables to app_user;
