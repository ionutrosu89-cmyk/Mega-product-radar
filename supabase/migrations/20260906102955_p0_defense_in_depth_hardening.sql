-- P0 defense-in-depth hardening for public API surface.
-- Applied to production first during the 2026-09-06 launch audit; committed here
-- immediately afterwards so repository migrations remain the source of truth.

-- SECURITY DEFINER functions in the exposed public schema remain server-only.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.fn);
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public', r.fn);
  END LOOP;
END $$;

-- New public functions must not become client-executable by default.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated;

-- Public views must respect the caller's privileges/RLS if they are ever granted.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS vw
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
  LOOP
    EXECUTE format('ALTER VIEW %s SET (security_invoker = true)', r.vw);
  END LOOP;
END $$;

-- RLS-without-policy tables are intentional server-only surfaces. Remove inherited
-- client grants as an additional barrier; service_role remains unaffected.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
      AND NOT EXISTS (
        SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid
      )
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %s FROM anon, authenticated', r.tbl);
  END LOOP;
END $$;
