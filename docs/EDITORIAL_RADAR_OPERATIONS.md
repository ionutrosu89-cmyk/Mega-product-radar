# Selecția MPR — operare editorială Free

Stare la 27 septembrie 2026: codul pentru un catalog editorial parțial este implementat. **Zero fișe sunt aprobate pentru publicare.** Există 10 concepte `DRAFT` în `BIROU_ORGANIZARE`, cu diferențele și blocajele detaliate în `EDITORIAL_PILOT_REVIEW_2026-09-27.md`; nu intră în bundle-ul public. `BO-03` rămâne suspendat. Top25 și poarta de lansare completă rămân separate și neschimbate.

## Ce înlocuiește acest flux

Selecția MPR este destinația pentru cercetarea proprie a conceptelor generice. Înlocuiește încercarea de a umple cele 25 de poziții Top25 cu produse fără rang de sursă. Nu elimină Top25, registrul celor 25 de nișe, semnalele gratuite sau politica etapelor comerciale. O fișă editorială are mereu `sourceRank: null` și etapa `DISCOVERED` / „În cercetare”; `FINALIST` și `TEST_READY` se stabilesc doar prin fluxul comercial existent.

## Traseul unei fișe

1. Cercetătorul adaugă un concept în `data/editorial-radar-candidates-v1.json`, cu ID stabil, nișă, nevoie, motiv de includere, surse HTTPS și rezumate originale. O ofertă analogă din România nu confirmă potrivirea exactă, stocul sau vânzările.
2. Reviewerul verifică identitatea, brandul, dreptul de a publica doar textul original MPR și linkurile, datele și fiecare afirmație. Documentele comerciale private și prețurile neautorizate nu intră în fișierul public.
3. Numai după revizia reală se setează `brandReview.status=GENERIC_CONCEPT_REVIEWED` și `publication.status=APPROVED_RESEARCH`, cu numele reviewerului și orele ISO ale verificării. Nu se completează aceste câmpuri pentru a demonstra funcționarea interfeței.
4. Buildul validează fișele aprobate și generează `_site/editorial-radar-v1.json`. Fișele draft nu sunt copiate în `_site`, dar fișierul `data/editorial-radar-candidates-v1.json` este urmărit în Git: nu se introduc aici oferte, date personale sau alte documente private. Materialele private rămân în depozitul protejat deja folosit de proiect.
5. `editorial-radar.html` afișează numărul real de fișe, dosarul, dovezile încă actuale și ce lipsește. Cheia stabilă `MPR_EDITORIAL:<ID>` păstrează shortlistul local per cont după reîncărcare.
6. Identitatea și revizia expiră după 30 de zile. Observațiile de cerere după 35, ofertele RO și costurile după 7, iar furnizorul după 30 de zile. La expirare, browserul retrage dovada; dacă expiră identitatea, retrage cardul. Reconstruirea site-ului cu o fișă aprobată dar expirată eșuează până la revizie.

## Import gratuit Google Trends

Exportă din interfața oficială Google Trends un CSV **Interest over time** pentru România, cu o singură serie. Comanda locală este:

```powershell
node scripts/stage-google-trends.mjs --csv C:\cale\export.csv --niche BIROU_ORGANIZARE --concept "suport documente" --source-url "https://trends.google.com/trends/explore?date=today%2012-m&geo=RO&q=suport%20documente"
```

Importul acceptă date ISO, indicii întregi 0–100, maximum 35 de zile de la ultimul interval și exportul oficial cu regiunea România. Termenul din CSV trebuie să coincidă cu `q` din URL și cu `--concept`; altfel importul eșuează. Rezultatul este un JSON `PENDING_REVIEW` în `artifacts/trends-imports/`. Nu apelează API-ul, nu plătește, nu publică automat și nu transformă indicele relativ în volum de căutări sau vânzări. Reviewerul verifică exportul și URL-ul, apoi poate transcrie rezumatul original în `data/free-signal-observations-v1.json` conform contractului existent. Semnalul de nișă nu devine automat dovadă de cerere pentru un produs individual.

## Verificare și limite actuale

`npm run editorial:report` afișează pentru fiecare candidat starea de publicare, câte dovezi sunt încă eligibile, câte sunt doar piste, câte sunt expirate ori invalide și ce categorii de dovezi lipsesc. Raportul citește fișierul intern, nu adaugă drafturile în site și nu transformă o ofertă comparabilă într-o identitate confirmată. `approvedPublicCount` trebuie comparat cu `_site/editorial-radar-v1.json` după build.

`npm run editorial:beta-gate` evaluează separat o posibilă beta publică limitată la `BIROU_ORGANIZARE`. Cerința de catalog este între 10 și 25 de fișe `APPROVED_RESEARCH` actuale **într-o singură nișă**, verificate din fișierul sursă la rulare. Fiecare fișă numărată pentru beta trebuie să aibă identitatea listării, o observație `DEMAND` marcată explicit `PRODUCT_SPECIFIC` și un comparabil RO actual. Sursa interesului trebuie să fie pe alt domeniu decât sursele listării și comparabilului. Un indice Trends pentru o nișă întreagă rămâne context în panoul Free și nu este promovat automat la interes pentru fiecare produs. Raportul separă `reviewedCardCount` de `betaEligibleCardCount`; în prezent ambele sunt zero. Această cerință de beta este mai strictă decât publicarea unei singure fișe exploratorii.

Raportul mai cere acceptarea explicită a reducerii de scop (`editorialBetaScopeApproved`), drepturi de afișare verificate, flux de produs confirmat, test între două workspace-uri, test pe telefon fizic, domeniu și recuperarea accesului, suport și restaurare, cinci sesiuni beta reale cu pragurile 80%/60%/80% și zero incidente critice. Datele de intrare exemplu sunt în `docs/free-go-live-evidence-input.example.json`; valorile `false` și `null` nu sunt completate doar pentru a obține un rezultat verde. Dacă toate condițiile sunt dovedite, rezultatul este numai `READY_FOR_HUMAN_REVIEW`, fără lansare automată sau plăți. Poarta de lansare completă 25 × 25 rămâne neschimbată.

Rulează `node --test test/editorial-radar-v1.test.mjs test/google-trends-csv-v1.test.mjs`, apoi `npm test` și `npm run build`. Verifică în `_site/editorial-radar-v1.json` că `products` conține doar fișele aprobate și că fișierul sursă cu drafturi nu a fost copiat.

Există acum un export Google Trends real pentru termenul general „organizator birou” și un rezumat de nișă aprobat în panoul Free. Nu există încă o ofertă de furnizor confirmată sau o fișă de produs aprobată pentru `BO-06`. Testele validează contractul și trecerea prin shortlist cu storage simulat; nu substituie testul cu două conturi reale, telefonul sau utilizatorii beta. Nici această pagină, nici testele ei nu schimbă verdictul de lansare `NO_GO`.

La 28 septembrie, verificarea directă a adăugat observații de identitate pentru șase dintre cele zece concepte. Cinci au și un comparabil românesc, dar fiecare pereche de observații provine dintr-un singur URL Office Direct; interfața afișează separat numărul de surse distincte și numărul de observații. `BO-01` are cantitate contradictorie, iar listarea de referință `BO-05` este încheiată. Cele zece fișe rămân draft și feedul public are zero produse.
