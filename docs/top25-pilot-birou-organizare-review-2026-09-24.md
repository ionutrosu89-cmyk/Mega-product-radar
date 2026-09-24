# Top25 pilot: Birou și organizare — revizie de cercetare, 24 septembrie 2026

Acest document este o fișă internă de lucru. Nu aprobă produse pentru pagina Free și nu acordă drepturi de afișare pentru datele marketplace-urilor.

## Starea verificată

- Nișă: `BIROU_ORGANIZARE`; piața clasamentului cercetat: Amazon.com/SUA.
- Primele 30 de poziții din observația locală din 23 septembrie 2026: 26 necesită verificarea brandului și a potrivirii cu nișa, 2 sunt excluse pentru brand consacrat și 2 pentru nișă greșită. Produse aprobate: **0/25**. Sursa este `artifacts/amazon-pilot-triage-latest.json` (material intern, ignorat de Git).
- Cele 30 de poziții nu sunt 30 de concepte independente: apar cel puțin trei listări SMARTAKE (rangurile 9, 19, 29), două Criusia (13, 15) și două Vtopmart (7, 11). Variantele nu se deduplică după numele brandului singur; configurația și identitatea produsului trebuie verificate.
- Nu există mapare de categorie aprobată pentru eBay US, eBay DE sau AliExpress (`node scripts/report-top25-category-readiness.mjs`). Drepturile pentru publicarea clasamentului nu sunt confirmate. Nu se schimbă gate-urile de publicare.

## Extinderea bazinului de cercetare

Snapshotul intern are 60 de observații pentru fiecare dintre cele 25 de nișe, în total 1.500 de rânduri și 1.493 de identificatori Amazon distincți. Ținta configurată este de 100 de candidați pe nișă, deci lipsesc încă cel puțin 40 de observații pe nișă până la dimensiunea bazinului propus. Acestea sunt **observații brute**, nu produse aprobate. Pentru fiecare nișă sunt prezente rangurile **1–30 și 51–80**; pozițiile 31–50 lipsesc. Prin urmare, cele 60 de observații nu reprezintă un „Top 60” continuu și nu completează cele 625 de poziții publice.

Comanda `node scripts/triage-amazon-pilot.mjs --all-observed --out=artifacts/amazon-pilot-triage-all-observed-2026-09-24.json` a extins trierea negativă internă la toate observațiile disponibile în cele trei nișe-pilot. Fișierul rezultat rămâne ignorat de Git și nu se publică.

| Nișă-pilot | Observate | În așteptarea reviziei | Brand consacrat exclus | Nișă greșită exclusă | Aprobate |
| --- | ---: | ---: | ---: | ---: | ---: |
| `BIROU_ORGANIZARE` | 60 | 55 | 3 | 2 | 0 |
| `ORGANIZARE_CASA` | 60 | 43 | 16 | 1 | 0 |
| `CALATORII` | 60 | 51 | 4 | 5 | 0 |

Filtrarea automată este conservatoare: „în așteptare” nu înseamnă eligibil, iar două ASIN-uri diferite pot fi variante ale aceluiași concept. Următoarea verificare a acoperirii trebuie să recupereze ori să marcheze explicit lipsa pozițiilor 31–50, să reîmprospăteze observațiile și să revizuiască identitatea fiecărui concept înainte de numărare.

## Lot de lucru prioritar

| Concept | Observație disponibilă | Ce lipsește înainte de aprobare |
| --- | --- | --- |
| Cleme magnetice pentru cabluri de birou | `data/generic-office-discovery-2026-09-23.json` conține o listare eBay declarată „Unbranded” de vânzător. Căutarea curentă găsește [altă listare eBay de cleme magnetice](https://www.ebay.com/itm/316448586900), [produse similare în România](https://www.emag.ro/search/cleme%2Bclips%2Bfixare%2Bcablu) și [o pagină de furnizori Alibaba](https://www.alibaba.com/wholesale/cable-organizer-clip-magnetic-holder.html). Acestea nu reprezintă o potrivire exactă între listări. | Specificație fixă (număr, dimensiuni, sistem de prindere), verificare independentă a brandului, comparație RO pentru aceeași configurație, cerere demonstrată, furnizor și ofertă scrisă, drepturi de afișare. |
| Set de tăvițe transparente pentru sertar | Amazon rang 1 (`B0B1M6ML2J`, 25 bucăți) și rang 9 (`B086GFBN4D`, 13 bucăți) sunt configurații diferite. Există [o listare eBay pentru un set de 13 piese](https://www.ebay.com/itm/237079555589), fără dovada că este același produs. | Alegerea unei singure configurații, potrivirea cu utilizarea principală la birou, verificarea brandului, concurența RO pe aceeași specificație, cost complet și drepturi. |
| Organizator extensibil din plasă pentru sertarul biroului | Amazon rang 6 (`B0CCDJQ7MM`), titlu observat „Marbrasse”; documentul local `artifacts/amazon-pilot-crossmarket-2026-09-24.json` are o listare eBay asemănătoare, fără dovada unui furnizor comun. | Confirmarea statutului brandului, dimensiuni/material/număr compartimente, ofertă de furnizor, comparație RO, drepturi. |
| Organizator acrilic cu 16 sertare | Amazon rang 2 (`B0BY8V2VMS`), brand observat „caktraie”. Comparabila RO din dosarul local are **8 sertare**, deci nu este comparabilă exact; listarea Alibaba este altă configurație și nu este ofertă. | Comparabilă RO cu 16 sertare și aceleași dimensiuni, verificarea brandului, ofertă scrisă și costuri, drepturi. |
| Suporturi acrilice pentru notițe pe monitor, set de 3 | [Listarea eBay inspectată](https://www.ebay.com/itm/389796776249) indică 3 bucăți, acrilic, 11 × 3,1 inci și brand „Unbranded” declarat de vânzător. Aceasta este observație de catalog, nu dovadă de bestseller sau cerere. | Confirmarea produsului și disponibilității, cerere, concurență RO exactă, furnizor cu ofertă scrisă, verificare brand și drepturi. |

## Decizia de lucru

1. Alegem **o specificație** pentru fiecare concept înainte de a compara prețuri sau de a cere oferte. Produsele cu pachete și dimensiuni diferite nu sunt „același produs”.
2. Pentru fiecare candidat completăm: identificator, URL, sursă/piață, momentul observării, brand declarat și dovada reviziei, specificație, utilizare principală, comparabile RO exacte, semnal de cerere, ofertă furnizor, transport, taxe și drepturi de utilizare a datelor. Necunoscutul rămâne `PENDING`, nu devine `VERIFIED` prin estimare.
3. Reîmprospătăm observațiile înainte de orice propunere de publicare. Pentru acest flux, datele mai vechi de 72 de ore sunt expirate. Rangul sursei rămâne separat de un eventual rang al selecției MPR.
4. Dacă după revizie rămân sub 25 de produse distincte și eligibile, extindem cercetarea în alte categorii/surse permise. Pagina publică rămâne incompletă până când 25 de produse, drepturile și toate gate-urile trec.

Filtrul `selectGenericOpportunities` cere acum `nicheId` în opțiuni și, pentru fiecare candidat acceptat, o revizie umană cu `decision: "GENERIC_PRIVATE_LABEL"`, `nicheDecision: "IN_SCOPE"`, `nicheId`, `conceptKey` stabil, revizor, dată și linkuri HTTPS pentru dovezile de brand și nișă. Două listări cu același `conceptKey` contează ca un singur produs în Top25. Aceste aprobări de selecție nu înlocuiesc aprobarea drepturilor sursei și verificările de prospețime ale publicării.

Următoarea execuție verificabilă este revizia manuală a celor 26 de poziții încă în așteptare din CSV-ul intern, cu dovezi individuale; cercetarea celor cinci concepte de mai sus oferă o ordine utilă, dar nu contează ca cinci aprobări.
