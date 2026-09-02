# Mega Product Radar — plan operațional Beta gratuită v1

Data: 2 septembrie 2026
Operator: RED COMMERCE S.R.L.
Regim: test B2B gratuit, fără card, fără abonament și fără cumpărare de date

## 1. Obiectiv

Beta nu urmărește încă venituri. Urmărește să afle dacă sellerii români folosesc produsul pentru o decizie reală și dacă există suficientă intenție de plată pentru a justifica investiția în surse comerciale.

## 2. Ce este permis în acest test

- acces gratuit la motorul Top 25 pe nișe;
- produse și fapte provenite numai din surse cu drepturi aprobate în registrul de surse;
- seturi istorice/publice licențiate, etichetate ca istorice;
- indicatori calculați intern și demonstrații sintetice clar etichetate;
- verificări manuale limitate, cu URL și dată, fără copiere sistematică;
- feedback, analytics de utilizare și marcarea interesului pentru planuri viitoare;
- contactarea platformelor pentru permisiuni, trialuri, credite sau acces pilot gratuit.

## 3. Ce rămâne blocat

- checkout, card, abonament, facturare și orice debitare;
- API-uri plătite, joburi care consumă credite și colectări cu cost;
- rulări automate GitHub/cron; orice reîmprospătare se pornește manual și rămâne zero-paid;
- scraping automat al Amazon, eMAG, Trendyol, TikTok, Meta sau al altor pagini fără permisiune;
- imagini, descrieri și conținut protejat fără licență separată;
- prezentarea datelor istorice ca stoc, vânzări sau trend curent;
- promovarea unui produs ca finalist fără hard-gates și dovezi suficiente.

## 4. Cohorta inițială — 30 de zile

Ținta este 25 de selleri/importatori B2B invitați. Fiecare participant trebuie să:

1. creeze contul și accepte termenii Beta;
2. completeze profilul comercial;
3. caute o nișă reală;
4. deschidă minimum un Top 25;
5. analizeze minimum un produs;
6. marcheze sau nu interesul pentru un plan viitor;
7. trimită feedback.

## 5. Praguri pentru decizia de investiție

| Indicator | Prag minim în 30 zile |
|---|---:|
| Utilizatori invitați | 25 |
| Conturi activate | 15 |
| Onboarding finalizat | 10 |
| Căutări Top 25 pe o nișă reală | 8 utilizatori |
| Produse analizate până la o decizie | 5 utilizatori |
| Feedback complet | 5 răspunsuri |
| Intenție de plată | minimum 3 utilizatori sau 20% dintre cei activați |
| Valoare decisivă confirmată independent | minimum 3 utilizatori |
| Incident critic de date/securitate | 0 |

„Valoare decisivă” înseamnă că utilizatorul spune concret că informația despre România Gap, cerere, risc, furnizor sau economie i-a schimbat o decizie reală.

## 6. Regula de decizie

- **INVESTIM**: pragurile de utilizare și intenție de plată sunt atinse, fără incidente critice.
- **ITERĂM GRATUIT**: există folosire reală, dar intenția de plată sau claritatea produsului este sub prag.
- **OPRIM/REPOZIȚIONĂM**: nu există folosire repetată sau nimeni nu poate indica o decizie îmbunătățită de aplicație.

Nicio investiție în licențe de date nu este aprobată doar pe baza numărului de înscrieri.

## 7. KPI-uri și dovezi

Evenimente minime: `SIGNUP`, `ONBOARDING_COMPLETED`, `TOP25_SEARCHED`, `PRODUCT_OPENED`, `DECISION_REACHED`, `UPGRADE_INTENT`, `FEEDBACK_SUBMITTED`.

Raportul săptămânal trebuie să separe:

- vizitatorii de utilizatorii autentificați;
- evenimentele demonstrative de acțiunile pe produse reale;
- interesul exprimat de plățile efective (care sunt zero în Beta);
- datele licențiate de estimări și de demonstrații.

## 8. Responsabilități

Echipa tehnică menține plățile și sursele neaprobate blocate. Operatorul firmei aprobă numai identitatea expeditorului, lista participanților și orice viitor buget. Orice activare de checkout necesită o lansare separată, o revizie juridică și setarea explicită server-side `MPR_PAID_BILLING_ENABLED=true`. Orice apel către AI sau un furnizor de date cu potențial de cost necesită separat `MPR_PAID_PROVIDER_CALLS_ENABLED=true`; ambele valori sunt false implicit.
