# Free Cross-Market — plan de activare

Versiune: 3 septembrie 2026
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
| P0 | eBay | eBay Developers + Marketing API `BEST_SELLING` | 0 € | Cont developer și aplicație; token OAuth server-side; confirmarea dreptului de afișare/retentie |
| P1 | România | feeduri, pagini permise, index public sau verificare umană limitată | 0 € | Aprobarea fiecărei surse în registrul de drepturi înainte de automatizare |
| P1 | Google | Merchant Center Best Sellers / Trends, conform eligibilității și termenilor | 0 € | Verificarea accesului contului și a permisiunilor de utilizare în produsul SaaS |
| P2 | Amazon US/DE | API oficial ori dataset licențiat cu drept de utilizare comercială | 0 € până la ofertă aprobată | Nu se pornește un furnizor plătit fără aprobare separată |
| P2 | TikTok | API aprobat pentru Research/Shop/Ads, după caz | 0 € | Aplicarea pentru produsul API adecvat; fără scraping Creative Center |

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
