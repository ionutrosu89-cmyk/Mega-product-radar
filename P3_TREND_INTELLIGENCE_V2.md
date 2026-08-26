# P3 Trend Intelligence V2

Purpose: distinguish a short-lived marketplace spike from a persistent, evidence-supported trend without converting public marketplace proxies into verified sales.

## Series identity

Trend calculations are same-source and same-surface only:

`canonicalProductId | platform | externalId | surface`

Cross-platform rank fusion is forbidden. Two BSR categories for the same Amazon ASIN remain separate series.

## Observation windows

Trend Intelligence V2 evaluates rolling evidence windows:

- 24h
- 7d
- 30d
- 90d

A 24h move can support an `EARLY_SIGNAL`, but it cannot by itself become a persistent trend. Persistence requires longer-window support.

## Signals currently supported

V2 core uses only signals that exist in `MarketObservation V1`:

- review-count movement — demand proxy only
- source-rank movement — lower rank is better
- price movement/stability — supportive/risk context only
- observation duration and density
- freshness
- source-metric completeness

Signals that are not yet present as direct evidence remain unknown. Search momentum, category momentum, brand momentum and cross-market momentum are not fabricated or silently defaulted to positive values.

## Score versus confidence

`trendScore` estimates directional strength from available evidence.

`confidence` separately measures how much longitudinal evidence exists. A high score with weak history does not become a high-confidence trend and cannot directly promote a product through the opportunity funnel.

## Status contract

Possible series classifications:

- `INSUFFICIENT_HISTORY`
- `EARLY_SIGNAL`
- `EARLY_DECLINE`
- `EARLY_MIXED`
- `SPIKE_OR_REVERSAL`
- `EMERGING_TREND`
- `PERSISTENT_TREND`
- `DECLINING`
- `MIXED_OR_STABLE`

`SPIKE_OR_REVERSAL` explicitly captures cases where recent 24h movement looks strong but longer-window behavior does not support it.

## Product-level aggregation

`MPR_PRODUCT_TREND_AGGREGATE_V2` creates one conservative trend view per exact `canonicalProductId` after series-level analysis.

Important rules:

- only canonically bound series can enter a decision aggregate;
- multiple surfaces are corroboration, not independent sales observations;
- the product score is a confidence-weighted mean and cannot be inflated simply by adding more BSR surfaces;
- conflicting positive and negative surfaces produce `MIXED_OR_CONFLICTED` and reduce confidence;
- an isolated spike is never upgraded to persistent trend by aggregation;
- unbound series are counted separately and never enter product decision evidence;
- cross-market momentum is not inferred merely because multiple surfaces exist.

## Decision authority

Trend Intelligence is evidence, not purchase authority.

- `autoPromoteOpportunityStage = false`
- no Trend result can bypass Romania Gap, Importability, Supplier or Economics gates
- unbound observations may be analyzed but remain non-decision-eligible
- verified sales remain `null`
- `salesEvidenceClass = NOT_VERIFIED_SALES`
- automatic purchase is forbidden

Trend evidence can support at most `VALIDATE`. `FINALIST`, `TEST_READY`, `TEST_VALIDATED` and `BUY_READY` remain under the canonical Decision Authority and require their independent gates.

## Initial scoring contract

Each available window starts neutral at 50 and applies only observable signals:

- review count increases: +20; decreases: -20
- rank improves: +20; rank worsens: -20
- price movement within ±15%: +10 stability support
- price movement above 30% absolute: -10 volatility risk

Window weights:

- 24h: 35%
- 7d: 35%
- 30d: 20%
- 90d: 10%

These weights are an explainable V2 baseline and must later be calibrated against real outcomes rather than treated as universal truth.

## Integration verification

This stacked PR is intended to be retargeted to `main` only after the P2 Data Foundation base is merged and its CI is green. The integration check must preserve the P2 canonical identity and append-only history safeguards rather than reintroducing title-based joins or non-canonical trend evidence.

## Non-negotiable safeguards

- spike != trend
- rank != verified sales
- review growth != verified sales
- price stability != demand proof
- missing signals stay missing
- score and confidence stay separate
- no cross-source evidence borrowing
- no paid provider execution
- no purchase authority
