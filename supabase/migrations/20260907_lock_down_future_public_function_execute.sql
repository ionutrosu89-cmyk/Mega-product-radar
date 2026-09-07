-- Fail closed for future functions created by the postgres owner in public.
-- Privileged functions must be granted explicitly to service_role when needed.

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
