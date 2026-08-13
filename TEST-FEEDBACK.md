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

Adăugăm aici toate observațiile următoare ale utilizatorului pe durata testării.
