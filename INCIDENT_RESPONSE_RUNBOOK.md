# Mega Product Radar — Incident & Personal Data Breach Runbook

Owner: RED COMMERCE S.R.L.
Version: 2026-09-07
Policy: evidence-first, fail-closed, preserve logs, do not conceal uncertainty.

## Severity

- SEV-0: confirmed cross-tenant disclosure, leaked privileged secret, destructive unauthorized access, or confirmed personal-data exfiltration.
- SEV-1: credible security compromise or sustained unauthorized access without confirmed exfiltration.
- SEV-2: contained vulnerability or service incident with no evidence of unauthorized data access.

## Immediate containment

1. Record UTC detection time and incident owner.
2. Freeze risky deployments and preserve relevant logs/evidence.
3. Revoke/rotate affected credentials and tokens when compromise is credible.
4. Disable the affected endpoint/provider with the emergency kill switch or deploy a fail-closed response.
5. For suspected tenant leakage, disable the affected data path until RLS/authorization is re-verified.
6. Do not delete evidence needed for root-cause analysis.

## Assessment record

Capture:
- what happened and how detected;
- systems, tables, endpoints and providers affected;
- categories of data potentially affected;
- approximate number of users/records where determinable;
- start/end window or best known bounds;
- confidentiality, integrity and availability impact;
- whether data was actually accessed/exfiltrated or only potentially exposed;
- containment actions and timestamps;
- residual risk and uncertainty.

## Personal-data breach decision

When personal data may be involved, create a formal breach-assessment record immediately. Determine whether notification to the competent supervisory authority is legally required and whether affected individuals must also be informed. Where a statutory notification deadline applies, calculate it from the time the controller became aware of the breach; escalation must happen immediately rather than waiting for the technical investigation to be perfect.

If notification is not made, document the factual and legal reason for that decision and retain the supporting evidence.

## Recovery

1. Patch root cause.
2. Run authorization/RLS regression tests and secret scans.
3. Validate backup/restore and data integrity where destructive access was possible.
4. Deploy through the normal CI gate; no emergency bypass of security tests.
5. Monitor for recurrence and anomalous access.
6. Close only after evidence shows containment and recovery.

## Post-incident

- root-cause analysis;
- corrective and preventive actions with owners;
- update tests/runbooks/architecture;
- verify credential rotation completion;
- verify customer/regulator communications, if required;
- preserve incident chronology and decision records.

## Hard rule

A security or privacy incident is never marked resolved because the visible symptom disappeared. Closure requires evidence that the root cause is fixed and that the same class of failure is covered by a regression control.
