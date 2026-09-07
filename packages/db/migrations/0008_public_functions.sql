-- 0008_public_functions.sql
-- The contractor induction link and the QR verification page are UNAUTHENTICATED
-- and have no tenant context yet. These SECURITY DEFINER functions map an opaque
-- token to its organisation id (only), so the server can then open a normal
-- withTenant() transaction scoped to that org. They expose ids, never personal data.

create or replace function public_resolve_enrol_token(p_token text)
returns table(organisation_id uuid, property_id uuid, induction_id uuid)
language sql security definer set search_path = public, pg_temp
as $$
  select q.organisation_id, q.property_id, q.induction_id
  from qr_codes q
  where q.token = p_token
    and q.is_active
    and q.purpose = 'enrol'
    and (q.expires_at is null or q.expires_at > now())
$$;

create or replace function public_resolve_verify_token(p_token text)
returns table(organisation_id uuid, attempt_id uuid)
language sql security definer set search_path = public, pg_temp
as $$
  select a.organisation_id, a.id
  from induction_attempts a
  where a.verification_token = p_token
$$;

revoke all on function public_resolve_enrol_token(text) from public;
revoke all on function public_resolve_verify_token(text) from public;
grant execute on function public_resolve_enrol_token(text) to app_user;
grant execute on function public_resolve_verify_token(text) to app_user;
