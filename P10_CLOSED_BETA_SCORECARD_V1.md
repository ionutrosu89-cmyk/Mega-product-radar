# P10 — Closed Beta Scorecard V1

## Purpose

P10 measures whether Mega Product Radar is useful to the initial Romanian marketplace/import entrepreneur ICP before broader release.

This scorecard does not infer success from page views alone and does not convert missing evidence into zero.

## Canonical targets

- cohort: 10–15 relevant beta participants
- activation: >70%
- median time to first explicitly useful opportunity: <10 minutes
- weekly active beta participants: >50%
- useful opportunity rating: >70%
- false-positive rate: <20%
- Romania Gap useful: >70%
- willingness to pay €29/month: >30%
- week-4 retention: >40%

## Evidence rules

- Opportunity usefulness is measured only from explicit `BETA_OPPORTUNITY_RATED` telemetry.
- False positives are explicit user classifications, never inferred from IGNORE/WATCH/VALIDATE.
- Romania Gap usefulness uses explicit beta feedback with `area=ROMANIA_GAP` and rating 4–5.
- Willingness to pay is price-specific: `metadata.wouldPay29`; generic `would_pay` is not silently relabeled as willingness to pay €29.
- Week-4 retention requires a participant linked to a workspace and an observed event during days 22–28 after activation.
- Time to first useful opportunity requires a linked participant, `activated_at`, and an explicit useful rating event.
- Missing denominators produce `UNKNOWN`, not 0%.

## Cohort identity

`beta_participants` now supports server-managed `user_id` and `workspace_id` binding. Browser roles retain no direct registry write access.

## Statuses

- `BUILD_COHORT`: cohort is outside 10–15 participants.
- `MEASURING`: cohort exists but one or more target metrics still lack direct evidence.
- `CALIBRATE`: all required metrics are measurable and at least one target fails.
- `BETA_TARGETS_MET`: all measured target gates pass.

Even `BETA_TARGETS_MET` does not automatically authorize public launch, paid-provider execution, testing spend, or product purchase.

## Instrumentation

Opportunity Detail exposes a small Beta Pulse with `UTILĂ`, `FALS POZITIV`, and `NECLARĂ`. This telemetry is isolated from Opportunity V5 and cannot modify score, confidence, FINALIST, TEST_READY or BUY_READY.

The beta feedback form separately captures Romania Gap feedback and the explicit €29/month willingness-to-pay question.

## Admin API

`GET /api/internal/closed-beta-scorecard`

The endpoint is restricted through the existing server-side beta analytics admin authorization and reads participant, journey and feedback evidence with the Supabase service role server-side only.
