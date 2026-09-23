# Mega Product Radar — Top 25 Live Acquisition Runbook V1

## Contract public

Free publică un clasament live numai când o nișă are exact 25 de produse distincte, toate observate în fereastra de prospețime și provenite dintr-o sursă cu drept de afișare confirmat. Poziția de platformă nu este prezentată drept număr de unități vândute. Datele istorice nu sunt publicate și nu sunt utilizate ca rezervă.

## Taxonomie

`free-top25-live-taxonomy-v1.js` definește cele 25 de nișe, expresiile în română și engleză, ținta de 100 de candidați pe nișă și pragul public de 25 de produse. ID-urile de categorie marketplace rămân `null` până la revizuirea semantică umană.

Pentru eBay, rulează endpointul intern `POST /api/internal/ebay-category-review` cu `mode: "COVERAGE"`. Revizuiește candidații și configurează numai ID-urile aprobate în `MPR_EBAY_CROSS_MARKET_TARGETS_JSON`. Nu activa automat o sugestie de categorie.

## Surse

### eBay

Colectorul direct este implementat. Sunt necesare credențialele aplicației, accesul de producție, revizuirea termenilor și aprobarea explicită pentru afișarea publică. Jobul programat rulează zilnic la 05:30 UTC, marchează automat drept `STALE` snapshoturile mai vechi de 72 de ore și nu efectuează apeluri la provider dacă oricare dintre gate-uri lipsește.

### Amazon

Creators API poate îmbogăți datele de catalog, dar nu este acceptat ca dovadă de clasament. Ingestia acceptă numai `KEEPA_BEST_SELLERS` sau `AMAZON_LICENSED_BEST_SELLERS`, cu aprobarea explicită `MPR_KEEPA_PUBLIC_DISPLAY_APPROVED`. Nu sunt executate automat apeluri plătite.

### AliExpress

Colectorul direct Hot Products este implementat pe `POST /api/internal/aliexpress-cross-market-refresh`, protejat cu `x-mpr-internal-secret`. Jobul zilnic îl apelează numai cu cheile, tracking ID, termenii și dreptul de afișare aprobate. Configurați `MPR_ALIEXPRESS_TOP25_TARGETS_JSON` cu mapări revizuite: `[{"nicheId":"AUTO","categoryIds":["ID_APROBAT"],"keywords":"expresie revizuită"}]`. Exemplul nu este o mapare activabilă.

Sunt păstrate primele 25 de poziții valide din răspunsul Hot Products sortat `LAST_VOLUME_DESC`. O poziție invalidă sau duplicată respinge lista, fără a o înlocui cu rezultate inferioare. Indicatorul furnizorului nu este prezentat ca volum de vânzări verificat independent.

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

6. Trei colectări zilnice consecutive reușite pentru toate cele 25 de nișe. Dovezile execuțiilor trebuie revizuite uman înainte de lansare.
7. Lansarea și plățile necesită decizie umană; acoperirea tehnică nu le activează.
