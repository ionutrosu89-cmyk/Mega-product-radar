# Colectare controlată Keepa pentru Top25

Stare: mecanism implementat și testat cu răspunsuri simulate. Nu există încă un acord de afișare publică, un buget aprobat, categorii aprobate sau produse colectate prin acest mecanism. Toate activările rămân oprite în `.env.example`.

## Fluxul disponibil

1. Obținem răspunsul furnizorului privind stocarea, afișarea publică, atribuirea și retenția datelor. O cheie API sau plata unui abonament nu înlocuiește acest răspuns. Proprietarul aprobă separat costul.
2. Verificăm pentru fiecare nișă categoria Amazon.com, domeniul, URL-ul categoriei și limitele de includere/excludere din `data/top25-niche-review-v1.json`. Pentru primul pilot folosim `BIROU_ORGANIZARE`. Nicio categorie nu este aprobată implicit.
3. Configurăm doar pe server cheia, aprobările, limita zilnică și lista de categorii. Endpointul acceptă o nișă pe cerere, maximum 25 de nișe în configurație.
4. `POST /api/internal/keepa-top25-collect`, cu headerul `x-mpr-internal-secret` și corpul `{"nicheId":"BIROU_ORGANIZARE"}`, rezervă atomic 150 de tokenuri înainte de primul apel. Cere lista de subcategorie și identitatea primelor maximum 100 de ASIN-uri. Nu cumpără un abonament.
5. `GET /api/internal/keepa-top25-collect?nicheId=BIROU_ORGANIZARE&day=YYYY-MM-DD`, cu același header, returnează lotul privat din Netlify Blobs. Secretul nu trebuie introdus în JavaScript public, URL sau capturi de ecran.
6. Revizuim brandul, potrivirea cu nișa și identitatea conceptului. Brandurile consacrate detectate sunt excluse automat; un brand necunoscut rămâne candidat, nu aprobare. Dublurile se elimină la selecția conceptelor. Nu completăm automat câmpul `reviews`.
7. După minimum 25 de concepte eligibile, folosim ingestia existentă `/api/internal/top25-live-ingest`: pentru lot adăugăm `platform: "MPR_GENERIC"` și recenziile documentate. Normalizatorul revalidează drepturile, prospețimea și cele 25 de concepte înainte de publicare. Dacă sunt mai puține, extindem cercetarea fără a inventa poziții.

## Configurație

Sunt obligatorii `KEEPA_API_KEY`, `MPR_INTERNAL_REFRESH_SECRET`, `MPR_KEEPA_TERMS_APPROVED=true`, `MPR_KEEPA_PUBLIC_DISPLAY_APPROVED=true`, `MPR_PAID_PROVIDER_CALLS_ENABLED=true` și `MPR_KEEPA_COLLECTION_ENABLED=true`. Nu se activează înaintea aprobărilor reale.

`MPR_KEEPA_DAILY_TOKEN_CAP` trebuie să fie un întreg între 150 și 3750. Pornirea pilotului ar folosi 150, numai după aprobarea bugetului. Limita este în tokenuri API, nu în euro și nu reprezintă o ofertă comercială.

`MPR_KEEPA_TOP25_TARGETS_JSON` conține o listă de obiecte cu:

- `nicheId`: un ID din taxonomia publică de 25 de nișe;
- `domain`: 1 pentru Amazon.com, 3 pentru Amazon.de;
- `categoryId`: ID numeric verificat; nu există un ID demonstrativ aprobat;
- `mappingStatus`: `APPROVED` numai după revizuire;
- `reviewer`, `reviewedAt`: persoana și data reală a verificării, cel mult 90 de zile;
- `categoryEvidenceUrl`: URL HTTPS Amazon pentru piața respectivă.

Configurația invalidă este respinsă integral. Schimbarea categoriei nu permite o a doua taxare a aceleiași nișe în aceeași zi UTC.

## Cost, concurență și erori

Documentația furnizorului indică 50 de tokenuri pentru [Best Sellers](https://keepa.com/api-docs/best-sellers.html) și costul de bază de un token per ASIN pentru [Product](https://keepa.com/api-docs/product.html). Rezervarea conservatoare este 50 + 100 = 150 per nișă, maximum 3750 pentru 25 de nișe. Consumul efectiv poate fi mai mic.

Bugetul și nișele rezervate sunt ținute într-un singur document zilnic cu scriere condiționată în store-ul `mpr-keepa-private`. Acest buget acoperă invocările endpointului din același site Netlify, nu alte aplicații sau alte site-uri care folosesc aceeași cheie Keepa. Nu există retry automat. Un timeout poate fi deja taxat de furnizor, deci rezervarea nu se restituie. La eșec, investigăm recipisa privată și reluăm cel mai devreme în ziua următoare; nu ștergem bugetul pentru a forța retry.

Fiecare cerere externă are timeout de 10 secunde. Redirecturile sunt refuzate, mesajele de eroare ale furnizorului nu sunt retransmise și cheia nu este salvată în loturi/recipise. Dacă store-ul nu poate rezerva bugetul, nu se apelează furnizorul.

Lista folosește `sublist=1` și `variations=0`, fără perioade istorice. Hidratarea folosește `history=0` și `update=-1`, fără opțiuni suplimentare taxabile. În consecință, identitățile vechi sunt respinse; descărcarea nu garantează că furnizorul are date recente pentru fiecare ASIN.

Datele listei și ale identității trebuie să fie mai noi de 72 de ore. `observedAt` păstrează cea mai veche dintre aceste două date, iar `fetchedAt` marchează doar descărcarea. Poziția sursei rămâne distinctă de poziția selecției MPR. Nu deducem vânzări unitare din clasament.

## Ce rămâne pentru activare

Nu există încă programare automată pentru Keepa: colectorul este manual, protejat și cu buget limitat. Schedulerul eBay/AliExpress existent rămâne separat. După validarea primului lot și a condițiilor furnizorului, putem programa nișele în cereri separate, păstrând rezervarea zilnică. Retenția și ștergerea loturilor private trebuie configurate după răspunsul contractual, înainte de prima colectare reală. Nu colectăm în avans presupunând că drepturile vor fi acordate.

Testele acoperă autorizarea, aprobările, categoriile, concurența, limita zilnică, prospețimea, piața, brandurile, erorile fără secrete și stocarea privată. Aceste teste nu sunt dovada accesului real la API și nu aprobă lansarea.
