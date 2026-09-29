# Radarul de bestselleruri pe mai multe platforme

## Produsul dorit

Utilizatorul caută una dintre cele 25 de nișe și deschide clasamente separate pentru Amazon.com, eBay US, AliExpress și, ulterior, alte piețe aprobate. Fiecare clasament are maximum 25 de poziții, cu sursa, piața, categoria sursei, rangul exact, indicatorul folosit și data observației. Selecția MPR pentru produse fără brand consacrat este un strat separat: eliminarea unui brand nu schimbă rangul original al marketplace-ului.

O listă capturată o dată pe lună se numește „snapshot observat la data X”, nu „cele mai vândute produse din luna trecută”. Această din urmă afirmație este permisă doar când furnizorul oferă explicit o metrică agregată pentru intervalul calendaristic respectiv. Rangul nu este un volum de vânzări și nu poate fi convertit în unități fără o estimare etichetată.

## Starea verificată în cod

- Există 25 de nișe în `free-top25-expanded-registry.js` și șase interogări EN/RO pe nișă în `free-top25-live-taxonomy-v1.js`.
- Toate mapările oficiale de categorii Amazon/eBay/AliExpress sunt încă `null` și cer revizie umană. Un query nu este echivalent cu o categorie bestseller.
- `top25.html` și `top25.js` au căutarea nișei, taburi pe surse și comparația produselor. Acest pas face vizibile direct și sursele încă nepublicate și afișează data observației pentru clasamentele publicate.
- `current_top25_snapshots_v1` și `/api/free/cross-market` acceptă numai 25 poziții complete, recente și cu drepturi aprobate. Prospețimea actuală este 72 de ore, deci nu există încă un istoric public bilunar/lunar.
- Accesul Developer eBay și cheile API nu confirmă accesul Production la Buy Marketing API. Amazon Creators API oferă căutare și BSR pe produs, dar nu furnizează prin `SearchItems` un Top 25 al categoriei sortat după vânzări.

## Fluxul de construcție

1. **Taxonomie:** pentru fiecare nișă se aprobă categoria exactă a sursei și piața. Se păstrează mappingul versionat, URL-ul oficial și revizorul. Nișele fără categorie potrivită rămân fără Top 25 pentru acea sursă.
2. **Drepturi și acces:** fiecare conector stă dezactivat până există acces Production și drept de afișare în aplicația publică. Sandbox eBay nu este dovadă de produse reale. Nicio colectare plătită nu pornește automat.
3. **Colectare:** jobul per sursă ia 25 ranguri exacte, identificatori stabili, URL oficial, categoria, momentul UTC și răspunsul brut pentru audit. Nu amestecă rezultatele căutării cu un bestseller rank.
4. **Validare:** se resping rândurile duplicate, rangurile lipsă, URL-urile greșite, seturile sub 25, drepturile absente și datele expirate. Eșecul unui refresh nu înlocuiește ultimul snapshot valid, dar acesta se marchează expirat.
5. **Istoric:** se introduce un store separat, append-only, pentru snapshoturi autorizate. Cheia logică este `(platformă, piață, nișă, categorie sursă, observat_la)`. API-ul public expune doar câmpurile permise de licență; un istoric de date cu drepturi revocate este retras din API.
6. **Interfață:** implicit se arată ultima observație validă, apoi selectorul „snapshot anterior”. Datele de observație și actualizare sunt afișate separat. Amazon, eBay și AliExpress rămân liste independente; Consensus compară concepte numai când există dovezi din cel puțin două surse.
7. **Ritm:** ținta este un refresh la 14 zile pentru sursele care îl permit și lunar unde licența sau limitele API îl cer. Frecvența se configurează separat de expirarea datelor. Un job ratat ridică alertă; nu transformă un snapshot vechi în „recent”.

## Ordinea realistă de livrare

| Etapă | Rezultat verificabil | Dependență |
| --- | --- | --- |
| Pilot eBay, 2 nișe | 25/25 poziții reale per nișă, rang și dată vizibile | Aprobare EPN/Buy Marketing Production și categorii validate |
| Istoric | Două snapshoturi succesive, selecție în UI, expirare corectă | Drept de stocare/afișare istoric confirmat |
| Extindere eBay | 25 nișe cu mapping și acoperire măsurată | API disponibil pentru categoriile respective |
| Amazon.com | Top 25 licențiat sau ranguri oficiale verificate, cu eticheta corectă | Sursă și drept de redistribuire aprobate |
| AliExpress și Consensus | Topuri independente și suprapuneri explicabile | Acces/API și drepturi aprobate |

Ținta completă este **625 poziții pentru fiecare marketplace** (25 nișe × 25 produse). Nu promitem 625 poziții Amazon sau eBay până când drepturile, taxonomia și colectarea sunt demonstrate. Versiunea Free poate deschide treptat nișele acoperite, cu numărătoare reală a listelor publicate, fără rânduri inventate.
