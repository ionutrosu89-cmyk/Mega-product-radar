# Pilot gratuit pentru candidați de produse

Stare la 27 septembrie 2026: am identificat exportul oficial Open Products Facts, dar accesul direct la API și la arhiva de circa 379 MB este blocat în mediul de verificare curent. **Nu am măsurat încă acoperirea reală a nișei** și nu există produse noi aprobate sau publicate. Scriptul local este pregătit și testat pe fixturi sintetice; nu face apeluri externe și nu generează costuri de API.

## Surse și roluri

| Sursă | Rol permis în acest pilot | Limită |
| --- | --- | --- |
| [Open Products Facts](https://www.data.gouv.fr/datasets/open-products-facts) | Descoperire de produse nealimentare și identitate; exportul JSONL este actualizat zilnic | Data exportului nu este data fiecărui produs; niciun câmp nu dovedește vânzări sau rang. Datele sunt sub ODbL, cu atribuire și obligații de share-alike pentru baza derivată. Imaginile au drepturi separate. |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Reuse) | Dovadă auxiliară pentru mărci | Lipsa unui brand în Wikidata nu este dovadă de produs generic. |
| [GS1 GPC](https://gpc-browser.gs1.org/) | Maparea nișelor și deduplicare semantică | Taxonomie, nu catalog de produse sau popularitate. |
| [EU Safety Gate](https://ec.europa.eu/safety-gate-alerts/) și [CPSC Recalls](https://www.cpsc.gov/th/node/5808) | Screening de risc UE/SUA | Pot invalida un candidat, dar nu îl transformă în bestseller. |
| [Eurostat Comext](https://ec.europa.eu/eurostat/web/international-trade-in-goods/information-data) | Context lunar de import pe cod de marfă | Date agregate, nu cerere sau preț per produs; verificăm excepțiile de reutilizare comercială. |
| [Open Icecat](https://icecat.com/pricing-content-users/) | Referință pentru specificații și identificarea mărcilor consacrate | Planul gratuit conține în principal produse de brand și conținut supus politicilor de sindicare. Nu este sursa listei generice. |

Common Crawl rămâne numai o posibilă sursă internă de descoperire: [arhiva este gratuită](https://commoncrawl.org/get-started), dar drepturile site-urilor de origine nu sunt cedate automat. Google Trends API [necesită acces alfa](https://developers.google.com/search/apis/trends). Nu integrăm niciuna ca flux public până la clarificarea accesului și a drepturilor.

## Rulare pentru `BIROU_ORGANIZARE`

1. Se obține arhiva oficială `https://static.openproductsfacts.org/data/openproductsfacts-products.jsonl.gz` din [pagina publică a datasetului](https://www.data.gouv.fr/datasets/open-products-facts). Fișierul mare rămâne local și nu se adaugă în Git.
2. Se rulează `node scripts/run-open-products-facts-pilot.mjs --input <cale-către-arhivă>`. Rezultatul implicit este `artifacts/opf-private-pilot-v1.json`, ignorat de Git.
3. Raportul numără toate înregistrările, cele din nișă, cele cu dată necunoscută sau veche, brandurile consacrate excluse și cel mult 100 de candidați recenți. Pragul pilotului este maximum 90 de zile de la modificarea **înregistrării sursei**, nu 72 h de la o observație marketplace. Lista rămâne `HUMAN_REVIEW_REQUIRED`.
4. Pentru fiecare candidat se verifică manual conceptul distinct, brandul, categoria, sursele de cerere, comparabilele RO, riscurile și drepturile de afișare. Un candidat nu poate intra prin acest script în `/api/free/cross-market` și nu primește rang de vânzări. Înaintea publicării unei baze derivate din OPF, implementăm atribuirea ODbL și separarea bazei derivate conform licenței.

Extinderea către celelalte 24 de nișe începe numai după măsurarea efectivă a acoperirii pilotului și revizia categoriilor. Dacă rămân sub 25 de concepte eligibile, interfața arată acoperirea reală, nu completează artificial lista.
