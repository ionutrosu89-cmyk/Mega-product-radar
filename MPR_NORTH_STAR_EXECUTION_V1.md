# MPR North-Star Execution V1

Principiu: **DATA → INTELLIGENCE → DECISION → EXECUTION**.

Acest document definește cele 10 workstream-uri care duc Mega Product Radar de la catalog la un sistem disciplinat de identificare, validare și lansare a oportunităților. Existența unui modul nu înseamnă automat că workstream-ul este READY; dovezile trebuie să treacă gate-urile proprii.

## 1. DATA FOUNDATION
**Stare:** IN_PROGRESS.

- Product Universe: 1.000 identități Amazon canonice.
- 255 au prima observație live publică persistată.
- Round 2 rulează numai după minimum 24h pentru fiecare identitate.
- Următorul milestone de breadth: 10.000 produse.
- Public ranking nu este sales volume; lipsa unui câmp rămâne `null`, nu zero.

**Definition of Done:** ≥10K produse canonice, istoric append-only, surse cu provenance și minimum două observații longitudinale pentru un subset util.

## 2. TREND INTELLIGENCE
**Stare:** BLOCKED pe date longitudinale reale până la Round 2.

- Early Trend, Category Momentum, New Entrants și cross-platform confirmation există.
- Un trend nu poate fi confirmat dintr-o singură observație.
- Review velocity și price movement cer două observații publice la ≥24h.
- Rank velocity rămâne `null` fără două rank-uri observate explicit.

**Definition of Done:** semnale longitudinale reale pentru un eșantion suficient, cu confidence și provenance.

## 3. ROMANIA GAP
**Stare:** BLOCKED pe comparable exact local evidence.

- eMAG + Trendyol folosesc același ledger append-only și aceeași cheie semantică.
- `656+`, `512+`, `1636+` sunt lower bounds, nu count-uri exacte.
- Scope-uri necomparabile nu se însumează.

**Definition of Done:** minimum un niche cu eMAG + Trendyol market-wide, manual-reviewed, exact și comparabil, apoi extindere la 5–10 niches.

## 4. SUPPLIER INTELLIGENCE
**Stare:** IN_PROGRESS.

- Supplier candidate discovery, RFQ, benchmark, verification și negotiation engine există.
- Listing price ≠ verified quote.
- Seed-ul curent conține supplier-stated evidence, nu `MANUALLY_VERIFIED` quote.

**Definition of Done:** 3+ quote-uri complete și comparabile pentru un produs VALIDATE, cu MOQ, unit price, shipping/DDP, lead time, compliance evidence și provenance.

## 5. ECONOMICS
**Stare:** BLOCKED pentru confirmed economics până există quote + landed evidence complet.

- Landed Cost și Profit Engine sunt disponibile.
- Profit, margin și ROI pot fi confirmate numai după landed cost confirmat.
- Missing FX/freight/tax/compliance nu poate fi înlocuit cu zero implicit.

**Definition of Done:** cel puțin un produs cu landed cost confirmat și economics calculat din dovezi complete.

## 6. OPPORTUNITY ENGINE V4
**Stare:** IMPLEMENTED în acest PR.

Funnel oficial:
`DISCOVERED → PROMISING → VALIDATE → FINALIST → TEST_READY → BUY_READY`

V4 emite până la `TEST_READY`; BUY_READY rămâne în gate-ul de test măsurat ulterior.

- Trend + Romania Gap formează market opportunity.
- Supplier + Economics cresc commercial maturity.
- FINALIST cere supplier verificat + economics confirmat.
- maximum 3 FINALIST.
- `TEST_READY` nu autorizează cumpărare.

## 7. RADAR
**Stare:** infrastructură existentă; strict alerts rămân BLOCKED până la trend + Romania Gap valide.

- watchlist
- rising/new
- category momentum
- Romania Gap
- Opportunity alerts

**Definition of Done:** alerte generate numai din evidence-qualified longitudinal signals și Romania Gap comparabil.

## 8. LAUNCH
**Stare:** IN_PROGRESS, Academy V1 este structurată în 10 module.

Include:
- firmă / TVA / EORI / contabilitate / marketplace / import / compliance / listing / PPC / test
- sourcing și negociere
- acces/introducere la **agent China testat/verificat de noi** pentru planul Launch; serviciile agentului se contractează separat

**Definition of Done:** partner network verificat, checklist-uri operaționale complete și traseu de la TEST_READY la test măsurat fără bypass de money/compliance gates.

## 9. ONBOARDING INTELIGENT
**Stare:** IMPLEMENTED / corrected în acest PR.

Mapare canonică:
- EXPLORE → FREE
- VALIDATE supplier/economics → DISCOVER
- TRENDS / opportunity monitoring → RADAR
- EXECUTE sau agent China → LAUNCH

## 10. SCALE
**Stare:** IN_PROGRESS, staged only.

Secvență:
`1K → 10K → 50K → 100K → 500K → 1M`

Nu se sare direct la 500K. Paid providers nu se execută automat, iar Alibaba supply discovery nu se numără ca demand breadth.

## Milestone de produs

Primul milestone comercial urmărit este:

> **Primul produs care ajunge legitim în FINALIST numai din date reale și dovezi suficiente.**

Abia după aceea urmărim primul `TEST_READY`, apoi un test măsurat. Niciun scor, alert sau workflow nu poate autoriza automat o cumpărare.
