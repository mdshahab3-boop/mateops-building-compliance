-- 0009_auth_org_lookup.sql
-- Login is workspace-scoped: a user signs in under their organisation's slug.
-- This SECURITY DEFINER lookup maps a slug to an org id before any tenant
-- context exists, so the login flow can then scope the credential check.

create or replace function auth_find_org_by_slug(p_slug text)
returns uuid
language sql security definer set search_path = public, pg_temp
as $$
  select id from organisations where slug = p_slug and status = 'active'
$$;

revoke all on function auth_find_org_by_slug(text) from public;
grant execute on function auth_find_org_by_slug(text) to app_user;
