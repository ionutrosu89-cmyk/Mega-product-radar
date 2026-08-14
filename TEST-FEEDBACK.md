# Mega Product Radar — Backlog feedback testare

Scop: colectăm toate observațiile din perioada de test și aplicăm îmbunătățirile cu prioritate pe experiența mobilă, fără să relaxăm logica TEST/BUY sau să inventăm dovezi comerciale.

## 2026-08-14 — Audit strict V2 pe iPhone

Observație utilizator: „Asta trebuie sa arate profi, acum nu arata.”

### Probleme identificate
- Tipografie și ierarhie vizuală neuniforme.
- Linkuri și butoane cu aspect nefinisat.
- KPI-uri fără structură suficient de clară.
- TOP 3 și TOP 10 prea dense pe mobil.
- Coduri tehnice afișate direct: SUPPLIER_UNVERIFIED, NO_REVIEW_EVIDENCE, EVIDENCE_LOW, LOW_NET_PROFIT, LOW_NET_MARGIN, LOW_ROI etc.
- Bara de jos putea acoperi conținutul.
- Safe-area și padding inferior trebuiau optimizate pentru iPhone.

### Implementat
- Redesign mobile-first al paginii Audit strict.
- Header și navigație premium.
- KPI-uri în carduri compacte.
- Safe-area pentru iPhone și spațiu inferior pentru bottom navigation.
- Denumiri produse afișate în română în Audit.
- Categorii localizate în română.
- Blocajele tehnice sunt mapate la explicații clare în română.
- Empty-state pentru TOP 3 refăcut și simplificat.
- Cardurile pun accent pe verdict → scor → dovezi → profit → risc → motivul blocării.

### Stare
IMPLEMENTAT — pragurile BUY/TEST nu au fost relaxate.

---

## 2026-08-14 — Inbox produse noi / Descoperire pe iPhone

Observație utilizator: pagina este prea îngrămădită și nu arată premium.

### Probleme identificate
- Header prea dens.
- Navigație de sus prea încărcată.
- KPI-uri voluminoase.
- Căutare și filtre aglomerate.
- Cardurile de produs aveau prea multe informații concurente vizual.

### Implementat
- Navigație tip chip/tab cu scroll orizontal pe mobil.
- KPI-uri compacte în grid responsive.
- Toolbar sticky, filtre scrollabile și spațiere mobile-first.
- Carduri mai aerisite și tipografie coerentă.
- Mini-imagine în card atunci când scannerul poate valida o imagine reală din sursă.
- Placeholder explicit dacă imaginea reală nu a putut fi validată.

### Stare
IMPLEMENTAT — continuă validarea vizuală pe dispozitiv real.

---

## 2026-08-14 — Numele produselor în aplicația pentru România

Observație utilizator: „Produsele sunt in limba engleza, trebuiesc in limba romana”.

### Cerință
- Toate numele produselor afișate utilizatorului trebuie să fie în limba română.
- Numele originale pot rămâne intern pentru căutări și surse.
- Căutarea trebuie să funcționeze și după numele original.

### Implementat
- Modul central `product-ro.js` cu traduceri comerciale pentru catalogul curent și fallback pentru produse noi.
- Descoperire afișează numele în română, dar păstrează numele original pentru matching și căutare.
- Audit strict afișează numele și categoriile în română.
- Radar aplică localizarea denumirilor după randarea dinamică a cardurilor.

### Stare
IMPLEMENTAT în ecranele principale de decizie. Se extinde gradual și la orice ecran secundar unde apare numele brut.

---

## 2026-08-14 — Mini-imagine produs

Observație utilizator: produsele asemănătoare trebuie diferențiate vizual; simplul titlu nu este suficient.

### Cerință
- Fiecare candidat ar trebui să aibă mini-imagine reală a produsului găsit.
- Nu se folosesc imagini generice sau inventate.
- Imaginea trebuie să provină dintr-o sursă web reală asociată candidatului.

### Implementat
- Scannerul încearcă să extragă `og:image` / `twitter:image` din prima sursă reală disponibilă.
- Sunt acceptate doar URL-uri HTTP/HTTPS reale.
- `imageUrl` și `imageSourceUrl` sunt salvate în discovery data.
- Cardul de Descoperire afișează imaginea reală dacă există; altfel afișează placeholder de validare.

### Stare
IMPLEMENTAT — acoperirea imaginilor va crește pe măsură ce produsele sunt rescannate și sursele permit accesul la preview.

---

## QA
- Workflow-ul Mega Product Radar Scan a trecut scanarea, persistarea datelor și validarea site-ului pe ultima rulare verificată.
- Safe-area mobil este inclus în UI-ul comun.
- Pragurile comerciale TEST/BUY nu au fost modificate.
