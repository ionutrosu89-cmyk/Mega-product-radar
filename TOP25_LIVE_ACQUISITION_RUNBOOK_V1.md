# Mega Product Radar — Top 25 Live Acquisition Runbook V1

## Contract public

Free publică un clasament live numai când o nișă are exact 25 de produse distincte, toate observate în fereastra de prospețime și provenite dintr-o sursă cu drept de afișare confirmat. Poziția de platformă nu este prezentată drept număr de unități vândute. Arhiva 2023 rămâne separată.

## Taxonomie

`free-top25-live-taxonomy-v1.js` definește cele 25 de nișe, expresiile în română și engleză, ținta de 100 de candidați pe nișă și pragul public de 25 de produse. ID-urile de categorie marketplace rămân `null` până la revizuirea semantică umană.

Pentru eBay, rulează endpointul intern `POST /api/internal/ebay-category-review` cu `mode: "COVERAGE"`. Revizuiește candidații și configurează numai ID-urile aprobate în `MPR_EBAY_CROSS_MARKET_TARGETS_JSON`. Nu activa automat o sugestie de categorie.

## Surse

### eBay

Colectorul direct este implementat. Sunt necesare credențialele aplicației, accesul de producție, revizuirea termenilor și aprobarea explicită pentru afișarea publică. Jobul programat rulează zilnic la 05:30 UTC, marchează automat drept `STALE` snapshoturile mai vechi de 72 de ore și nu efectuează apeluri la provider dacă oricare dintre gate-uri lipsește.

### Amazon Creators API / Keepa

Folosește SearchItems/GetItems cu Sales Rank sau un feed Keepa Best Sellers licențiat. Datele normalizate se trimit prin `POST /api/internal/top25-live-ingest`. Activarea necesită `MPR_AMAZON_PUBLIC_DISPLAY_APPROVED=true`. Un abonament Keepa nu se cumpără și nu este apelat automat de acest proiect.

### AliExpress

Folosește Hot Products din aplicația afiliată aprobată. Transformă răspunsul în contractul normalizat și trimite snapshoturile prin endpointul intern. Activarea necesită revizuirea termenilor și `MPR_ALIEXPRESS_PUBLIC_DISPLAY_APPROVED=true`.

### Google România

Keyword Planner validează cererea de căutare și se actualizează lunar. Nu produce un clasament de produse și nu poate înlocui o poziție marketplace. Datele sale se păstrează ca semnal de cerere, separat de `current_top25_snapshots_v1`.

### TikTok și România

Commercial Content API poate furniza activitate publicitară, nu vânzări. Observațiile eMAG/retail trebuie etichetate `NOT_VERIFIED_SALES`; API-ul de seller nu reprezintă întreaga piață. Aceste surse sunt semnale de validare și nu sunt acceptate de endpointul de ingestie ca Top 25.

## Contract de ingestie

`POST /api/internal/top25-live-ingest` necesită `x-mpr-internal-secret` și acceptă maximum 25 de snapshoturi:

```json
{
  "snapshots": [{
    "nicheId": "AUTO",
    "platform": "EBAY",
    "market": "EBAY_US",
    "sourceKey": "EBAY_BUY_MARKETING_BEST_SELLING",
    "sourceLabel": "eBay Buy Marketing API",
    "products": [{
      "name": "Product name",
      "externalId": "provider-id",
      "rank": 1,
      "sourceUrl": "https://www.ebay.com/p/provider-id",
      "observedAt": "2026-09-20T06:00:00Z"
    }]
  }]
}
```

Fiecare snapshot trebuie să aibă exact 25 de produse, rangurile 1–25, identificatori unici, URL HTTPS și observații mai noi decât SLA-ul platformei. Endpointul verifică aprobarea din mediul serverului și scrie numai în `current_top25_snapshots_v1`.

## Gate de lansare

1. Migrarea `20260920090000_current_top25_live_pipeline_v1.sql` este aplicată.
2. Sunt aprobate și configurate 25 de mapări de categorie pentru cel puțin o platformă.
3. Există 25 de snapshoturi curente cu `product_count=25`, `source_rights_status=APPROVED` și `freshness_status=CURRENT`.
4. `/api/free/cross-market` raportează 25 nișe și 625 poziții pentru platforma activă.
5. Testul pe preview confirmă sursa, data și lipsa afirmațiilor despre unități vândute.
