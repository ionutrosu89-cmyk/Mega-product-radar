# Top 25: acces la surse și pilotul de colectare

Stare la 23 septembrie 2026: **0 conturi/API-uri aprobate**, **0 mapări de categorie aprobate**, **0/25 clasamente live**. Acest document pregătește cererile; nu afirmă că au fost trimise.

## 1. Acces eBay

Operatorul creează contul [eBay Developers Program](https://developer.ebay.com/develop/get-started) și contul [eBay Partner Network](https://partnernetwork.ebay.com/solutions/joining-the-ebay-partner-network) pe identitatea firmei. Pentru Buy Marketing API în producție, [eBay cere aprobarea modelului de afaceri și contracte](https://developer.ebay.com/api-docs/buy/buy-requirements.html). Aplicația EPN trebuie să descrie explicit SaaS-ul, publicul din România, afișarea titlului, linkului, rangului și datei, stocarea snapshoturilor și durata de păstrare. Un cont sau chei Sandbox nu reprezintă acces Production.

Text de lucru pentru aplicație, care trebuie adaptat și trimis de operator:

> Mega Product Radar, operat de RED COMMERCE S.R.L., este o aplicație de cercetare a produselor pentru comercianți din România. Solicităm acces la Buy Marketing API, resursa `merchandised_product`, metric `BEST_SELLING`, pentru categorii eBay US/DE revizuite manual. Vrem să afișăm utilizatorilor rangul, titlul, identificatorul, linkul sursei și momentul observației pentru maximum 25 de produse pe categorie. Nu prezentăm rangul ca unități vândute. Vă rugăm să confirmați în scris drepturile de afișare, stocare, derivare și perioada permisă de păstrare pentru acest model SaaS.

După aprobarea EPN, operatorul urmează procesul oficial de acces Buy API în producție și configurează `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `MPR_EBAY_TERMS_APPROVED`, `MPR_EBAY_PRODUCTION_ACCESS_APPROVED` și `MPR_EBAY_PUBLIC_DISPLAY_APPROVED` în Netlify. Cheile nu se pun în repository sau în conversație.

## 2. Acces AliExpress

[Documentația Hot Products](https://developer.alibaba.com/docs/doc.htm?articleId=45794&docType=2&treeId=674) este în secțiunea etichetată **„Affiliate API (depreciat)”**. Înainte de configurarea colectorului, operatorul trebuie să obțină confirmare de la AliExpress că acest endpoint încă funcționează pentru aplicația sa sau să primească documentația API-ului actual care îl înlocuiește.

Text de lucru pentru cerere:

> Mega Product Radar dorește să analizeze produse pentru 25 de nișe și să afișeze în SaaS 25 de produse pe nișă, cu titlu, identificator, link, poziție și data colectării. `aliexpress.affiliate.hotproduct.query` apare în documentația „Affiliate API (depreciat)”. Este endpointul disponibil pentru un cont nou? Dacă nu, care este API-ul actual pentru produse populare pe categorii? Vă rugăm să confirmați drepturile de afișare către utilizatori, stocarea snapshoturilor, perioada de păstrare, limitele de apel și semnificația exactă a câmpului `lastest_volume`.

Colectorul rămâne blocat prin `MPR_ALIEXPRESS_API_CURRENT_CONFIRMED=false` până la această confirmare. După confirmare, operatorul configurează App Key, App Secret, Tracking ID, aprobarea termenilor și a afișării publice în Netlify. Dacă se furnizează un API nou, adaptorul trebuie actualizat și testat înainte de activare.

## 3. Maparea celor 25 de nișe

[Matricea de revizuire](../data/top25-niche-review-v1.json) definește produsele incluse și excluse din fiecare nișă și marchează trei nișe pilot: `ORGANIZARE_CASA`, `BIROU_ORGANIZARE`, `CALATORII`. Niciun ID de categorie nu este aprobat implicit.

Pentru fiecare nișă și piață, operatorul verifică în taxonomy-ul oficial categoria leaf, versiunea arborelui, numărul de rezultate și cel puțin zece produse exemplu. Înregistrarea aprobării conține `mappingStatus: "APPROVED"`, numele revizorului, `reviewedAt`, `categoryEvidenceUrl` și ID-ul categoriei. Rularea `node scripts/report-top25-category-readiness.mjs` arată acoperirea actuală și produce lista de ținte numai pentru mapări aprobate. Acea listă se introduce în variabila Netlify corespunzătoare; nu se copiază ID-uri din exemplele testelor.

## 4. Pilotul pe trei nișe

1. Se aprobă accesul și trei mapări relevante. Se rulează colectarea în mediu de test pentru fiecare sursă, fără publicare dacă drepturile de afișare lipsesc.
2. Pentru fiecare din primele 25 de poziții se salvează: sursa, piața, nișa, categoria, ID-ul produsului, titlul, rangul, URL-ul și `observedAt`. Se verifică manual primele 10 și un eșantion din restul listei pentru relevanță, variații duplicate și categoria corectă.
3. Se colectează un bazin de candidați mai mare decât 25, numai dacă sursa și drepturile permit acest lucru. Clasamentul brut al sursei rămâne distinct de lista de oportunități MPR. `top25-generic-selection-v1.js` exclude brandurile consacrate cunoscute și cere o revizie umană documentată pentru fiecare brand necunoscut sau generic. Un produs cu rangul 26 în sursă poate avea rangul 25 în lista MPR, dar interfața trebuie să păstreze ambele ranguri și să explice filtrarea. Dacă rămân sub 25 produse aprobate, lista este incompletă și nu se prezintă drept „Top 25 fără brand”.
4. Se repetă trei zile. O listă incompletă, veche de peste 72 de ore sau fără drept de afișare nu se publică. Se compară stabilitatea rangurilor și proporția de produse relevante.
5. După pilot se completează mapările rămase. Pragul pentru „Top 25 fără brand consacrat” este 25 nișe cu câte 25 oportunități revizuite și publicabile, timp de trei colectări zilnice consecutive, urmate de revizuire umană. Clasamentul brut și lista filtrată au praguri de acoperire separate.

### Limita eBay pentru o listă filtrată

[Ghidul oficial eBay Marketing](https://developer.ebay.com/develop/guides/buy/marketing-and-discounts-guide) documentează `metric_name`, `category_id` și `aspect_filter` pentru `getMerchandisedProducts`, dar nu documentează paginare pentru acest apel. Colectorul actual cere 25 poziții; dacă printre ele există branduri consacrate, nu putem completa onest lista filtrată la 25 folosind poziții suplimentare din același clasament. Înainte de a promite 25 oportunități pe fiecare nișă, trebuie confirmat cu eBay un volum suficient de poziții ori contractată o altă sursă licențiată de candidați clasați. Rezultatele Browse neclasate după vânzări pot servi la descoperire, dar nu vor fi etichetate „best selling”.

## 5. Dacă accesul este refuzat

Se solicită oferte de la furnizori de feeduri licențiate pentru clasamente pe categorii. Contractul trebuie să permită explicit afișarea în SaaS, stocarea, actualizarea zilnică și derivarea. Până la obținerea unei astfel de surse, pagina Free arată acoperirea reală și nu promite 625 de produse recente.

### Pilot fără EPN

Înscrierea EPN poate fi amânată fără oprirea cercetării. [eBay precizează](https://partnernetwork.ebay.com/page/developer-questionnaire) că Browse API nu necesită aprobare suplimentară, dar [Browse](https://developer.ebay.com/api-docs/buy/api-browse.html) este o sursă de descoperire prin căutare, nu dovadă de vânzări sau rang `BEST_SELLING`. Cheile Production, termenii aplicabili și limitele trebuie totuși verificați înainte de automatizare. Nu se pornește publicarea din rezultate de căutare fără drepturi clare de afișare.

Lotul intern [generic-office-discovery-2026-09-23.json](../data/generic-office-discovery-2026-09-23.json) conține cinci listări publice găsite manual în două nișe de birou. Mențiunea `Unbranded` este declarația vânzătorului din rezultatul indexat; nu este verificare independentă a brandului. Rangul, cererea, comparabilele românești, furnizorul și costul rămân necunoscute. Lotul nu este servit de API-ul public.
