# Free Cross-Market — plan de activare

Versiune: 4 septembrie 2026
Operator: RED COMMERCE S.R.L.

## Regula de publicare

Un tab de platformă poate exista în interfață fără date publicate. Un Top 25 devine `LIVE` numai dacă sunt îndeplinite simultan:

1. acces oficial sau licențiat și dreptul de utilizare documentat;
2. exact 25 poziții valide pentru nișă;
3. URL HTTPS valid și eticheta sursei pentru fiecare poziție;
4. observație în fereastra de prospețime a platformei;
5. sensul rankului este afișat exact, fără a-l transforma în unități vândute;
6. nu sunt expuse chei API, tokenuri sau nume interne de secrete;
7. brand gate rămâne obligatoriu înainte de analiza comercială.

Consensus se publică numai când același concept este confirmat de minimum două platforme live independente.

## Ordinea zero-cost

| Prioritate | Platformă | Acces urmărit | Cost activat acum | Ce trebuie făcut de operator |
|---|---|---|---:|---|
| P0 | AliExpress | API oficial Hot Products / afiliere, dacă termenii permit utilizarea SaaS | 0 € | Cont developer pe RED COMMERCE S.R.L.; acceptarea termenilor; chei în variabilele Netlify, niciodată în repository |
| P0 | eBay | eBay Developers + Buy Marketing API `BEST_SELLING` | 0 € | Creează aplicația Production pe RED COMMERCE S.R.L.; obține Client ID + Client Secret; finalizează eligibilitatea/aprobarea Buy API Production; introdu doar credentialele în Netlify. Aplicația generează automat Application Access Token server-side și nu cere token manual |
| P1 | România | feeduri, pagini permise, index public sau verificare umană limitată | 0 € | Aprobarea fiecărei surse în registrul de drepturi înainte de automatizare |
| P1 | Google | Merchant Center Best Sellers / Trends, conform eligibilității și termenilor | 0 € | Verificarea accesului contului și a permisiunilor de utilizare în produsul SaaS |
| P2 | Amazon US/DE | API oficial ori dataset licențiat cu drept de utilizare comercială | 0 € până la ofertă aprobată | Nu se pornește un furnizor plătit fără aprobare separată |
| P2 | TikTok | API aprobat pentru Research/Shop/Ads, după caz | 0 € | Aplicarea pentru produsul API adecvat; fără scraping Creative Center |

## eBay — gate de producție

Implementarea eBay este fail-closed. Starea devine `READY_TO_COLLECT` numai când sunt prezente credentialele aplicației și sunt confirmate atât termenii, cât și accesul Buy API în producție. Până atunci nu se execută apeluri către eBay și nu se publică Top 25.

Tokenul OAuth de tip Application Access Token este generat prin client-credentials grant cu scope-ul minim Buy Marketing și reutilizat până aproape de expirare. Tokenul nu se stochează în repository, nu se trimite în browser și nu trebuie introdus manual în Netlify.

Top 25 eBay folosește `BEST_SELLING` numai pentru nișe care au o mapare explicit aprobată la `category_id`. Categoria nu este ghicită din numele nișei. Configurația server-side `MPR_EBAY_CROSS_MARKET_TARGETS_JSON` conține doar mapările aprobate, de forma `nicheId + categoryId + marketplaceId`. În prima versiune sunt acceptate numai `EBAY_US` și `EBAY_DE`, pentru care avem și link public de produs determinist. Dacă lista API nu produce exact 25 de produse valide, snapshot-ul nu este scris.

Refresh-ul este expus numai pe ruta internă protejată și folosește `MPR_INTERNAL_REFRESH_SECRET`. Secretul se generează și se păstrează numai în Netlify. Un refresh reușit scrie în `top25_snapshots` sub cheia `XMARKET:EBAY:<NICHE>`; endpoint-ul public Cross-Market îl preia apoi prin contractul existent, fără bypass al validării de prospețime și 25/25.

## Secret management

- Toate credentialele rămân server-side în Netlify Environment Variables.
- Se acordă numai scope-urile minime necesare citirii.
- Se folosesc aplicații și conturi deținute de RED COMMERCE S.R.L.
- Valorile secrete nu se trimit prin chat, email sau commit Git.
- Tokenurile se rotesc imediat dacă au fost expuse accidental.

## Snapshot contract

Snapshot-urile viitoare folosesc cheia `XMARKET:<PLATFORM>:<NICHE>` și sunt păstrate separat de arhiva istorică. Colectorul scrie mai întâi în zona internă; API-ul public validează apoi numărul de produse, prospețimea, URL-urile și tipul dovezii. Orice eșec produce listă indisponibilă, nu fallback inventat.

## KPI pentru decizia de investiție

Înainte de orice API plătit se urmăresc minimum:

- sesiuni care deschid Radarul Free;
- nișe și platforme selectate;
- produse adăugate în shortlist;
- comparații finalizate;
- cereri explicite pentru platforme încă inactive;
- clickuri spre contul gratuit și feedback;
- revenirea utilizatorilor autentificați, după activarea alertelor.

O cheltuială de date se propune numai dacă platforma cerută are interes observat și există un caz de utilizare pe care versiunea gratuită actuală nu îl poate satisface.
