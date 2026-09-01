-- Explicit privilege hardening for the service-side importability evidence registry.
revoke all on table public.importability_evidence_v1 from anon, authenticated;
revoke all on sequence public.importability_evidence_v1_id_seq from anon, authenticated;
revoke all on public.importability_human_decision_v1 from anon, authenticated;
revoke all on public.importability_evidence_coverage_v1 from anon, authenticated;
revoke all on public.importability_evidence_queue_v1 from anon, authenticated;
