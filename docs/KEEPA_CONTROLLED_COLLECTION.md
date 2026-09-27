# Colectare controlata Keepa pentru Top25

Stare: mecanism implementat ?i testat cu raspunsuri simulate. Raspunsul scris Keepa din 26 septembrie 2026 acorda afi?area publica doar �n scopul descris mai jos, pe durata unui abonament API activ. Proprietarul a decis sa nu plateasca momentan. Nu exista abonament, buget aprobat, categorii aprobate sau produse colectate prin acest mecanism. Toate activarile ram�n oprite �n `.env.example`.

## Fluxul disponibil

1. Pastram raspunsul scris al furnizorului drept dovada de licen?iere. Acordul prive?te Amazon.com Best Sellers + Product API, 25 ni?e definite, maximum 100 de candida?i pe ni?a pe zi ?i maximum 25 de produse selectate pe ni?a pentru utilizatorii Free. Sunt permise ASIN, titlu scurt, brand, link sursa, pozi?ia �n lista sursei, timpul observarii ?i ordinea editoriala MPR separata. Nu include imagini, rev�nzare, export de masa, redistribuirea printr-un API sau afi?area acestor date �n planuri platite. Extinderea cere un nou acord. Acordul este condi?ionat de abonament activ ?i poate fi retras cu preaviz de 30 de zile.
2. Verificam pentru fiecare ni?a categoria Amazon.com, domeniul, URL-ul categoriei ?i limitele de includere/excludere din `data/top25-niche-review-v1.json`. Pentru primul pilot folosim `BIROU_ORGANIZARE`. Nicio categorie nu este aprobata implicit.
3. Configuram doar pe server cheia, aprobarile, limita zilnica ?i lista de categorii. Endpointul accepta o ni?a pe cerere, maximum 25 de ni?e �n configura?ie.
4. `POST /api/internal/keepa-top25-collect`, cu headerul `x-mpr-internal-secret` ?i corpul `{"nicheId":"BIROU_ORGANIZARE"}`, rezerva atomic 150 de tokenuri �nainte de primul apel. Cere lista de subcategorie ?i identitatea primelor maximum 100 de ASIN-uri. Nu cumpara un abonament.
5. `GET /api/internal/keepa-top25-collect?nicheId=BIROU_ORGANIZARE&day=YYYY-MM-DD`, cu acela?i header, returneaza lotul privat din Netlify Blobs. Secretul nu trebuie introdus �n JavaScript public, URL sau capturi de ecran.
6. Revizuim brandul, potrivirea cu ni?a ?i identitatea conceptului. Brandurile consacrate detectate sunt excluse automat; un brand necunoscut ram�ne candidat, nu aprobare. Dublurile se elimina la selec?ia conceptelor. Nu completam automat c�mpul `reviews`.
7. Dupa minimum 25 de concepte eligibile, folosim ingestia existenta `/api/internal/top25-live-ingest`: pentru lot adaugam `platform: "MPR_GENERIC"` ?i recenziile documentate. Normalizatorul revalideaza drepturile, prospe?imea ?i cele 25 de concepte �nainte de publicare. Daca sunt mai pu?ine, extindem cercetarea fara a inventa pozi?ii.

## Configura?ie

Sunt obligatorii `KEEPA_API_KEY`, `MPR_INTERNAL_REFRESH_SECRET`, `MPR_KEEPA_TERMS_APPROVED=true`, `MPR_KEEPA_PUBLIC_DISPLAY_APPROVED=true`, `MPR_KEEPA_SUBSCRIPTION_ACTIVE=true`, `MPR_PAID_PROVIDER_CALLS_ENABLED=true` ?i `MPR_KEEPA_COLLECTION_ENABLED=true`. Nu se activeaza �naintea unui abonament efectiv ?i a deciziei separate de a cheltui. Acordul scris singur nu activeaza colectarea sau afi?area.

`MPR_KEEPA_DAILY_TOKEN_CAP` trebuie sa fie un �ntreg �ntre 150 ?i 3750. Pornirea pilotului ar folosi 150, numai dupa aprobarea bugetului. Limita este �n tokenuri API, nu �n euro ?i nu reprezinta o oferta comerciala.

`MPR_KEEPA_TOP25_TARGETS_JSON` con?ine o lista de obiecte cu:

- `nicheId`: un ID din taxonomia publica de 25 de ni?e;
- `domain`: 1 pentru Amazon.com, 3 pentru Amazon.de;
- `categoryId`: ID numeric verificat; nu exista un ID demonstrativ aprobat;
- `mappingStatus`: `APPROVED` numai dupa revizuire;
- `reviewer`, `reviewedAt`: persoana ?i data reala a verificarii, cel mult 90 de zile;
- `categoryEvidenceUrl`: URL HTTPS Amazon pentru pia?a respectiva.

Configura?ia invalida este respinsa integral. Schimbarea categoriei nu permite o a doua taxare a aceleia?i ni?e �n aceea?i zi UTC.

## Cost, concuren?a ?i erori

Documenta?ia furnizorului indica 50 de tokenuri pentru [Best Sellers](https://keepa.com/api-docs/best-sellers.html) ?i costul de baza de un token per ASIN pentru [Product](https://keepa.com/api-docs/product.html). Rezervarea conservatoare este 50 + 100 = 150 per ni?a, maximum 3750 pentru 25 de ni?e. Consumul efectiv poate fi mai mic.

Planul Starter afi?at public la 27 septembrie 2026 este **49 EUR/luna**, preplatit, cu 20 de tokenuri pe minut. Tokenurile nefolosite expira dupa 60 de minute, deci cele 25 de cereri trebuie distribuite �n timp; 3750 de tokenuri pe zi nu �nseamna ca pot fi consumate instantaneu. Nu exista aprobare de cumparare ?i nu am facut apeluri facturabile.

Bugetul ?i ni?ele rezervate sunt ?inute �ntr-un singur document zilnic cu scriere condi?ionata �n store-ul `mpr-keepa-private`. Acest buget acopera invocarile endpointului din acela?i site Netlify, nu alte aplica?ii sau alte site-uri care folosesc aceea?i cheie Keepa. Nu exista retry automat. Un timeout poate fi deja taxat de furnizor, deci rezervarea nu se restituie. La e?ec, investigam recipisa privata ?i reluam cel mai devreme �n ziua urmatoare; nu ?tergem bugetul pentru a for?a retry.

Fiecare cerere externa are timeout de 10 secunde. Redirecturile sunt refuzate, mesajele de eroare ale furnizorului nu sunt retransmise ?i cheia nu este salvata �n loturi/recipise. Daca store-ul nu poate rezerva bugetul, nu se apeleaza furnizorul.

Lista folose?te `sublist=1` ?i `variations=0`, fara perioade istorice. Hidratarea folose?te `history=0` ?i `update=-1`, fara op?iuni suplimentare taxabile. In consecin?a, identita?ile vechi sunt respinse; descarcarea nu garanteaza ca furnizorul are date recente pentru fiecare ASIN.

Datele listei ?i ale identita?ii trebuie sa fie mai noi de 72 de ore. `observedAt` pastreaza cea mai veche dintre aceste doua date, iar `fetchedAt` marcheaza doar descarcarea. Pozi?ia sursei ram�ne distincta de pozi?ia selec?iei MPR. Nu deducem v�nzari unitare din clasament.

## Ce ram�ne pentru activare

Nu exista �nca programare automata pentru Keepa: colectorul este manual, protejat ?i cu buget limitat. Schedulerul eBay/AliExpress existent ram�ne separat. Acordul cere atribuirea exacta [Product data by Keepa](https://keepa.com) pe fiecare pagina cu datele furnizorului; pagina Top25 are atribuirea pregatita. Datele stocate trebuie eliminate �n maximum 60 de zile dupa �ncetarea abonamentului. Endpointul JSON public `/api/free/cross-market` exclude acum orice snapshot Keepa, inclusiv daca sunt setate din gre?eala aprobarea de afi?are ?i indicatorul de abonament. Aceasta blocheaza calea de export prin API, dar �nseamna ?i ca **nu exista �nca un flux public de afi?are Keepa** �n interfa?a. Inainte de prima colectare reala, trebuie implementate ?tergerea verificabila din Blob ?i Supabase ?i proiectat un flux de afi?are care respecta explicit interdic?ia Keepa privind API-ul/exportul de masa. C�t timp aceste puncte ram�n deschise ?i proprietarul nu dore?te abonamentul, nu activam Keepa.

Testele acopera autorizarea, aprobarile, categoriile, concuren?a, limita zilnica, prospe?imea, pia?a, brandurile, erorile fara secrete ?i stocarea privata. Aceste teste nu sunt dovada accesului real la API ?i nu aproba lansarea.

