# Pilot gratuit pentru candidați de produse

Stare la 27 septembrie 2026: am descărcat exportul oficial Open Products Facts, modificat la `2026-09-27T03:01:57Z` și având 39.394.403 octeți comprimați. Pilotul a parcurs **46.233 de înregistrări**. După verificarea identității, a nișei și a modificării în ultimele 90 de zile, a rezultat **zero candidați** pentru `BIROU_ORGANIZARE`. Un prim filtru permisiv identificase un planner deoarece categoria conținea termenul „organizers”; titlul nu descria un organizator de birou. Filtrul a fost corectat și rerulat. Nu există produse noi aprobate sau publicate. Exportul și raportul detaliat rămân locale, ignorate de Git. Nu s-au făcut apeluri API plătite.

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

## Verificare suplimentară a acoperirii gratuite — 27 septembrie 2026

Am verificat separat întregul export Open Products Facts, fără să echivalăm modificarea fișei cu o verificare a pieței: din 46.233 înregistrări, **28.365** au cod numeric de 8–14 cifre și titlu de minimum cinci caractere, iar **4.306** dintre acestea au `last_modified_t` în ultimele 90 de zile. **1.112** dintre cele recente nu au marcă declarată; absența mărcii nu dovedește totuși că sunt private label sau nebranduite.

O căutare largă, doar orientativă, în titlurile celor 4.306 fișe pentru termeni expliciți de organizare/depozitare a găsit **9 înregistrări**, toate cu marcă declarată. Exemplele includ coșuri de rufe, suporturi audio și genți de depozitare; nu reprezintă nouă produse aprobate pentru `ORGANIZARE_CASA` sau `BIROU_ORGANIZARE`. Această căutare nu este o clasificare completă a celor 25 de nișe, dar arată că extinderea automată a filtrului de birou nu ar produce o listă Top25 verificată. Niciuna dintre fișele inspectate nu aduce rang de vânzări ori drepturi asupra imaginilor comercianților.

Am verificat și [catalogul indexurilor Common Crawl](https://index.commoncrawl.org/collinfo.json): indexul din septembrie 2026 (`CC-MAIN-2026-39`) era listat. Prima interogare îngustă, pentru o pagină de categorie a unui furnizor, a răspuns `504 Gateway Time-out`; nu avem un eșantion valid de URL-uri de produs din această sursă. [Common Crawl avertizează](https://commoncrawl.org/faq) că indexul este limitat ca rată și că arhiva este doar un eșantion al webului. Chiar și dacă interogarea ar funcționa, [termenii săi](https://commoncrawl.org/terms-of-use) lasă aplicabile drepturile și condițiile site-urilor de origine. **Decizie:** nu construim un import public și nu promitem acoperire Top25 pe baza Common Crawl. Îl păstrăm numai ca pistă de cercetare internă, cu verificare separată a fiecărui site și produs.

## Rulare pentru `BIROU_ORGANIZARE`

1. Se obține arhiva oficială `https://static.openproductsfacts.org/data/openproductsfacts-products.jsonl.gz` din [pagina publică a datasetului](https://www.data.gouv.fr/datasets/open-products-facts). Fișierul mare rămâne local și nu se adaugă în Git.
2. Se rulează `node scripts/run-open-products-facts-pilot.mjs --input <cale-către-arhivă>`. Rezultatul implicit este `artifacts/opf-private-pilot-v1.json`, ignorat de Git.
3. Raportul numără toate înregistrările, cele din nișă, cele cu dată necunoscută sau veche, brandurile consacrate excluse și cel mult 100 de candidați recenți. Pragul pilotului este maximum 90 de zile de la modificarea **înregistrării sursei**, nu 72 h de la o observație marketplace. Lista rămâne `HUMAN_REVIEW_REQUIRED`.
4. Pentru fiecare candidat se verifică manual conceptul distinct, brandul, categoria, sursele de cerere, comparabilele RO, riscurile și drepturile de afișare. Un candidat nu poate intra prin acest script în `/api/free/cross-market` și nu primește rang de vânzări. Înaintea publicării unei baze derivate din OPF, implementăm atribuirea ODbL și separarea bazei derivate conform licenței.

**Decizie:** Open Products Facts nu poate alimenta nișa pilot la standardul actual și nu este sursa principală pentru Top25. Nu extindem automat aceeași promisiune la celelalte 24 de nișe. Următorul experiment gratuit trebuie să pornească de la o altă sursă de descoperire, cu drepturile de afișare clarificate înainte de publicare. Dacă rămân sub 25 de concepte eligibile, interfața arată acoperirea reală, nu completează artificial lista.
