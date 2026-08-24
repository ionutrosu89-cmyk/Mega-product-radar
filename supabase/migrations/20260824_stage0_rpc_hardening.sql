-- Stage 0 target functions are server-side only. GitHub Actions reads them through
-- the OIDC-authorized `stage0-targets` Edge Function using Supabase service_role.
revoke execute on function public.stage0_ro_keyword_targets() from public, anon, authenticated;
revoke execute on function public.stage0_deep_marketplace_targets() from public, anon, authenticated;
revoke execute on function public.stage0_paid_targets() from public, anon, authenticated;

grant execute on function public.stage0_ro_keyword_targets() to service_role;
grant execute on function public.stage0_deep_marketplace_targets() to service_role;
grant execute on function public.stage0_paid_targets() to service_role;
