-- 0007_auth_functions.sql
-- Authentication needs to read users/sessions ACROSS orgs (before a tenant
-- context exists) and to touch password_hash — which app_user is denied. Rather
-- than a second DB role or an RLS "bypass" flag app_user could set itself, we
-- expose a tiny, audited surface of SECURITY DEFINER functions owned by the
-- superuser. Each pins search_path and does exactly one vetted operation.

-- Look up a login candidate. Org-scoped (from the login URL's org slug) or a
-- platform admin. Returns password_hash so the app layer verifies with argon2.
create or replace function auth_find_user_for_login(p_email citext, p_org_id uuid default null)
returns table(user_id uuid, organisation_id uuid, password_hash text,
              status text, is_platform_admin boolean, full_name text)
language sql security definer set search_path = public, pg_temp
as $$
  select u.id, u.organisation_id, u.password_hash, u.status, u.is_platform_admin, u.full_name
  from users u
  where u.email = p_email
    and (
      (p_org_id is not null and u.organisation_id = p_org_id)
      or (p_org_id is null and u.is_platform_admin)
    )
$$;

create or replace function auth_create_session(
  p_user_id uuid, p_token_hash text, p_expires_at timestamptz,
  p_ip inet default null, p_user_agent text default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare sid uuid;
begin
  insert into sessions(user_id, token_hash, expires_at, ip, user_agent)
  values (p_user_id, p_token_hash, p_expires_at, p_ip, p_user_agent)
  returning id into sid;
  update users set last_login_at = now() where id = p_user_id;
  return sid;
end $$;

-- Resolve a session token hash to the identity + role context for withTenant().
create or replace function auth_resolve_session(p_token_hash text)
returns table(user_id uuid, organisation_id uuid, is_platform_admin boolean,
              full_name text, email citext, roles jsonb)
language sql security definer set search_path = public, pg_temp
as $$
  select u.id, u.organisation_id, u.is_platform_admin, u.full_name, u.email,
    coalesce((
      select jsonb_agg(jsonb_build_object('role', r.code, 'property_id', ur.property_id))
      from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.user_id = u.id
    ), '[]'::jsonb)
  from sessions s
  join users u on u.id = s.user_id
  where s.token_hash = p_token_hash
    and s.revoked_at is null
    and s.expires_at > now()
    and u.status = 'active'
$$;

create or replace function auth_revoke_session(p_token_hash text)
returns void
language sql security definer set search_path = public, pg_temp
as $$
  update sessions set revoked_at = now()
  where token_hash = p_token_hash and revoked_at is null
$$;

-- Set/replace a password (invite acceptance, reset). MUST be authorised by the
-- app layer before it is called.
create or replace function auth_set_password(p_user_id uuid, p_password_hash text)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update users
     set password_hash = p_password_hash,
         status = case when status = 'invited' then 'active' else status end
   where id = p_user_id;
end $$;

-- Lock down the privileged surface -------------------------------------------
revoke all on function auth_find_user_for_login(citext, uuid) from public;
revoke all on function auth_create_session(uuid, text, timestamptz, inet, text) from public;
revoke all on function auth_resolve_session(text) from public;
revoke all on function auth_revoke_session(text) from public;
revoke all on function auth_set_password(uuid, text) from public;

grant execute on function auth_find_user_for_login(citext, uuid) to app_user;
grant execute on function auth_create_session(uuid, text, timestamptz, inet, text) to app_user;
grant execute on function auth_resolve_session(text) to app_user;
grant execute on function auth_revoke_session(text) to app_user;
grant execute on function auth_set_password(uuid, text) to app_user;
