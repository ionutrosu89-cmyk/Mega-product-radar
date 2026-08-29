# Mega Product Radar — Public Price Opportunity Engine V2 Backlog

Status: EXECUTION MAP
Date: 2026-08-29
Parent plan: `MPR_PUBLIC_PRICE_OPPORTUNITY_PLAN_V2.md`

## Epics

- #358 — V2 P0: freeze public-price opportunity contracts and KPI definitions
- #359 — V2 P1: implement ProductFingerprint and unified price observation schemas
- #360 — V2 P2: build scalable marketplace price database
- #361 — V2 P3: build 1688/Alibaba public supplier price database
- #362 — V2 P4: implement marketplace-to-supplier product matching engine
- #363 — V2 P5: implement conservative landed-cost and marketplace economics screening
- #364 — V2 P6: normalize demand and scalable competition signals
- #365 — V2 P7: implement explainable Opportunity Score and Confidence Score
- #366 — V2 P8: build opportunity dashboard and human review workflow
- #367 — V2 validation: run first 10K end-to-end cohort and calibrate precision

## Dependency order

`#358 → #359 → (#360 + #361) → #362 → #363 → #364 → #365 → #366`

`#367` begins once the first usable versions of #360–#365 exist and blocks aggressive scale-up until precision is measured.

## Sprint 1 — contracts and identity

Primary: #358, #359.

Deliver:
- screening truth contract;
- ProductFingerprint V1;
- marketplace price observation schema;
- supplier public-price observation schema;
- deterministic match/mismatch fixture set.

## Sprint 2 — sell-side + supplier ingestion

Primary: #360, #361.

Deliver:
- first 10K commercially useful marketplace records;
- supplier candidate retrieval path;
- conservative public supplier price normalization;
- provenance/freshness ledgers.

## Sprint 3 — matching + economics

Primary: #362, #363.

Deliver:
- precision-first match engine;
- >=80 screening threshold;
- Best/Base/Conservative economics;
- ROI/margin/profit/break-even outputs;
- unknown != zero tests.

## Sprint 4 — demand + ranking

Primary: #364, #365.

Deliver:
- demand signal classes;
- scalable competition classes;
- Opportunity Score;
- separate Confidence Score;
- deterministic Top 100 queue.

## Sprint 5 — review UI + validation

Primary: #366, #367.

Deliver:
- human review dashboard;
- 10K end-to-end cohort;
- stratified manual QA;
- threshold calibration;
- top 20 commercial shortlist.

## Core business thresholds — initial

Conservative screening shortlist:
- matchConfidence >= 80;
- estimated ROI >= 80%;
- estimated net margin >= 25%;
- positive absolute profit above configured floor;
- no critical import blocker;
- no missing cost silently treated as zero.

High-priority band:
- matchConfidence >= 90;
- estimated ROI >= 150%;
- estimated net margin >= 35%;
- positive demand signal.

Thresholds are calibration defaults, not permanent truths.

## Scale gates

Do not scale economics matching to 100K merely because raw catalog size is available.

Scale gates:
1. identity precision acceptable;
2. HIGH_CONFIDENCE_MATCH manual precision >=90%;
3. economics false-positive rate measured;
4. supplier price normalization verified on sample;
5. sell-price rule does not systematically use unrealistic high prices;
6. unknown-cost rate is visible and controlled.

## KPI checkpoints

### 10K checkpoint
- 10K useful marketplace products
- >=3K supplier candidates target
- >=1K match>=80 target
- >=500 screening economics target
- first Top 100

### 50K checkpoint
- 50K marketplace products
- >=12K supplier candidates target
- >=5K high-confidence matches target
- >=2K economics-ready target

### 100K checkpoint
- 100K+ marketplace identities
- >=20K supplier candidates target
- >=10K high-confidence matches target
- >=5K economics-ready target
- >=1K demand-screened target
- 100 human-review opportunities
- 20 commercial shortlist products
- 5-10 strongest opportunities

## Management rule

Precision precedes scale. Negotiation is excluded from base economics. Public prices are the discovery baseline; any later negotiated discount is separate upside.
