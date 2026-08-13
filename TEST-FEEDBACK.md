# Mega Product Radar — Backlog feedback testare

Scop: colectăm toate observațiile din perioada de test fără să schimbăm motorul sau interfața în timpul evaluării, cu excepția erorilor critice. După încheierea testului, aplicăm îmbunătățirile în ordinea priorității.

## 2026-08-14 — Audit strict V2 pe iPhone

Observație utilizator: „Asta trebuie sa arate profi, acum nu arata.”

### Probleme vizibile din captură
- Tipografia nu este coerentă cu restul aplicației premium; aspectul pare de pagină web simplă, nu de aplicație SaaS.
- Linkurile de navigare apar în albastrul implicit al browserului și arată nefinisat.
- Butonul „Rulează auditul” are aspect implicit de browser/iOS și nu respectă designul premium.
- KPI-urile sunt afișate ca listă verticală de text, fără carduri sau ierarhie vizuală clară.
- Spațierea dintre titluri, KPI-uri și secțiuni este neuniformă.
- „TOP 3 pentru bani reali” ocupă mult spațiu chiar când nu există rezultate; empty state-ul trebuie compactat și stilizat.
- Cardurile din TOP 10 sunt prea dense și greu de scanat pe mobil.
- Codurile tehnice sunt afișate direct utilizatorului în engleză: SUPPLIER_UNVERIFIED, NO_REVIEW_EVIDENCE, EVIDENCE_LOW, LOW_NET_PROFIT, LOW_NET_MARGIN, LOW_ROI etc. Trebuie mapate la explicații clare în română.
- Informațiile importante (profit, marjă, ROI, dovezi, furnizor, risc) nu au suficientă ierarhie vizuală.
- Bara de navigare de jos se suprapune peste conținut/carduri și ascunde informații.
- Safe-area / padding inferior trebuie îmbunătățit pentru iPhone.
- Contrastul și dimensiunea textului secundar trebuie optimizate pentru citire rapidă.
- Cardul produsului ar trebui să aibă structură clară: verdict → scor → profit → dovezi → risc → blocaje → acțiune.
- Auditul trebuie să folosească același limbaj vizual ca Descoperire / Command Center.

### Cerință după perioada de test
Refacere completă a paginii Audit strict pentru mobil și desktop, fără modificarea logicii de audit sau a pragurilor BUY/TEST.

---

## 2026-08-14 — Inbox produse noi / Descoperire pe iPhone

Observație utilizator: pagina este prea îngrămădită și nu arată premium.

### Probleme vizibile din captură
- Headerul este prea dens și ocupă prea mult spațiu pe mobil.
- Titlul și subtitlul sunt prea mari raportat la lățimea ecranului.
- Navigația de sus folosește linkuri text simple, cu aspect nefinisat.
- Secțiunea explicativă „Regulă 6.0” este prea lungă și domină ecranul.
- KPI-urile sunt voluminoase și folosesc prea mult spațiu vertical.
- Ierarhia vizuală nu conduce rapid utilizatorul către „ce este nou / ce merită atenție / ce merită testat”.
- Căutarea și filtrele trebuie integrate mai elegant într-un flux mobil compact.
- Pagina trebuie să aibă mai mult spațiu controlat între secțiuni și mai puține elemente concurente vizual.

### Cerință după perioada de test
Redesign premium mobile-first pentru Descoperire, cu navigație tip tab/chip, KPI-uri compacte, explicații scurte și accent pe decizia de business.

---

## 2026-08-14 — Numele produselor în aplicația pentru România

Observație utilizator: „Produsele sunt in limba engleza, trebuiesc in limba romana”.

### Cerință
- Toate numele produselor afișate utilizatorului trebuie să fie în limba română.
- Traducerea trebuie aplicată consecvent în Descoperire, Radar, Audit, Oportunitățile de azi, Furnizori, Achiziții și orice alt ecran unde apare produsul.
- Numele originale în engleză pot fi păstrate intern pentru căutare, surse și potrivire, dar interfața pentru România trebuie să afișeze denumirea românească.
- Traducerile trebuie să fie naturale și comerciale, nu traduceri mot-a-mot nefirești.
- Pentru produse noi descoperite automat, aplicația trebuie să genereze automat și câmpul de denumire în română înainte de afișare.
- Căutarea ar trebui să poată găsi produsul atât după denumirea românească, cât și după denumirea originală.

### Prioritate după perioada de test
RIDICATĂ — este necesar pentru coerența unei aplicații dedicate pieței din România.

---

Adăugăm aici toate observațiile următoare ale utilizatorului pe durata testării.
