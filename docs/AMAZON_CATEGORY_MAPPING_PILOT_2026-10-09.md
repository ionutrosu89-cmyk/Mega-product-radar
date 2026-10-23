# Pilot de mapare Amazon.com pentru cele 25 de nișe

Data: 9 octombrie 2026. Document de cercetare internă; **zero mapări de subcategorie aprobate, zero produse colectate, zero clasamente publicabile**. Nu modifică `free-top25-live-taxonomy-v1.js`, drepturile, programarea colectării sau interfața publică.

## Ce știm

Cele 25 de ID-uri de mai jos sunt cele din `free-top25-expanded-registry.js`. [Documentația API Direct pentru categorii](https://apidirect.io/docs/amazon-categories) enumeră rădăcini Amazon.com; furnizorul spune în [răspunsul scris](https://mail.google.com/mail/u/?authuser=office.redcommerce%40gmail.com#all/1a11e958c80725ac) că un subnod se cere ca `parent-slug/node-id`. Acest tabel identifică **doar rădăcini candidate** din documentația furnizorului. Nu dovedește existența, identitatea sau acoperirea unui subnod, nici dreptul Amazon de afișare publică. O rădăcină largă poate fi împărțită între mai multe nișe, dar nu poate fi folosită ca Top25 specific fiecărei nișe fără revizie.

| Nișă MPR | Rădăcină candidată Amazon.com | Ce trebuie verificat |
| --- | --- | --- |
| `CASA` | `garden` | Rădăcină foarte largă; posibil mai multe departamente. |
| `AUTO` | `automotive` | Necesită subcategorie pentru produsul vizat. |
| `ELECTRONICE` | `electronics / computers / smart-home` | Nișă mixtă; rădăcina depinde de subcategorie. |
| `BEAUTY` | `beauty` | Necesită subcategorie și filtrarea produselor reglementate. |
| `PET` | `pets` | Câini și pisici trebuie separate la nivel de subcategorie. |
| `SPORT` | `sporting` | Necesită subcategorie. |
| `COPII` | `toys-and-games / baby-products` | Nișă mixtă; nu se aprobă un singur top generic. |
| `BIROU` | `office-products` | Necesită subcategorie pentru accesorii de birou. |
| `ORGANIZARE_CASA` | `garden` | Necesită subcategorie de depozitare/organizare. |
| `CURATENIE` | `hpc / garden` | Rădăcina depinde de tipul produsului. |
| `TELEFON_TECH` | `mobile` | Necesită subcategorie de accesorii. |
| `FITNESS_ACASA` | `sporting` | Necesită subcategorie de echipament pentru acasă. |
| `GRADINA_BALCON` | `lawngarden` | Necesită subcategorie. |
| `DIY_SCULE` | `tools` | Necesită subcategorie. |
| `BABY_ACCESORII` | `baby-products` | Necesită subcategorie și verificarea riscului produsului. |
| `AUTO_ACCESORII` | `automotive` | Necesită subcategorie de accesorii. |
| `HOBBY_CRAFT` | `arts-crafts` | Necesită subcategorie. |
| `PARTY` | `toys-and-games / arts-crafts` | Încadrare neclară; cere revizie. |
| `BIROU_ORGANIZARE` | `office-products` | Pilot: căutăm nodul exact pentru organizatoare de birou. |
| `FASHION_ORGANIZARE` | `fashion / garden` | Încadrare neclară; cere revizie. |
| `CAINI_ACCESORII` | `pets` | Necesită subcategorie pentru câini. |
| `PISICI_ACCESORII` | `pets` | Necesită subcategorie pentru pisici. |
| `LAUNDRY` | `garden / hpc` | Încadrare neclară; cere revizie. |
| `COPII_EDUCATIONAL` | `toys-and-games` | Necesită subcategorie educațională. |
| `CALATORII` | `fashion-luggage` | Pilot: căutăm nodul exact pentru accesorii de călătorie. |

## Pilotul următor, fără card sau colectare

1. Pentru `BIROU_ORGANIZARE`, `ORGANIZARE_CASA` și `CALATORII`, obținem URL-ul categoriei Best Sellers Amazon.com și perechea exactă `parent-slug/node-id`. Un query de căutare nu este o categorie.
2. Verificăm eșantionul JSON gratuit solicitat API Direct: `category`, `category_name`, `type=best_sellers`, `page`, `count`, ranguri 1–25 fără lipsuri, ASIN distinct, URL oficial, timp de cerere/observație. Schema publicată nu conține un câmp de timestamp per produs, deci momentul cererii trebuie înregistrat separat. Un rezultat gol, duplicat sau incomplet este respins.
3. Examinăm manual relevanța categoriei și câte produse fără brand consacrat rămân din primele 50–100; rangul original nu se renumerotează după filtrare. Brandul poate necesita endpointul Product Details separat, cu cotă distinctă.
4. Completăm dovezi de mapare: URL oficial, ID nod, versiune/data verificării, revizor, exemplu de 25 poziții reale și evaluarea drepturilor. Până atunci toate mapările rămân `HUMAN_REVIEW_REQUIRED` și `null` în cod.
5. [Endpointul API Direct](https://apidirect.io/docs/amazon-best-sellers) oferă maximum 50 poziții pe pagină și două pagini. 25 nișe × 2 pagini = 50 cereri, cât [cota gratuită lunară](https://apidirect.io/docs/pricing), dar numai dacă toate categoriile sunt valide și fiecare apel reușește. Reîmprospătarea la 14 zile ar depăși această cotă; nu adăugăm card și nu pornim apeluri plătite. Furnizorul nu deține drepturile asupra conținutului Amazon; [termenii săi](https://apidirect.io/terms) lasă conformitatea cu platforma sursă în sarcina noastră. **Niciun rând Amazon nu se publică pe baza acestei mapări.**

## Condiția de ieșire

Pilotul se închide numai cu subcategorii verificate, eșantion real complet, criterii de prospețime trecute și drepturi documentate pentru câmpurile afișate. Altfel raportăm lipsa acoperirii și păstrăm Top25 gol.
