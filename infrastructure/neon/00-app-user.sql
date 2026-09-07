-- Run this ONCE on your Neon database, as the OWNER role, BEFORE migrations.
-- (Neon SQL Editor, or: psql "$DATABASE_ADMIN_URL" -f 00-app-user.sql)
--
-- On Docker the runtime role is created by a Postgres init script; Neon has no
-- init hook, so we create it here. It is the least-privilege role the app uses
-- at runtime — Row-Level Security is ENFORCED for it. Table grants are applied
-- later by migration 0006_grants.sql.
--
-- Replace the password to match APP_DB_PASSWORD / DATABASE_URL in your .env.
-- Avoid single quotes in the password.

do $$
begin
  if not exists (select from pg_roles where rolname = 'app_user') then
    create role app_user login password 'REPLACE_WITH_APP_USER_PASSWORD';
  end if;
end
$$;

-- Neon's default database is usually "neondb" — change if yours differs.
grant connect on database neondb to app_user;
