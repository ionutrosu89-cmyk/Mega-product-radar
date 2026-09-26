# Dovezi Free — 26 septembrie 2026

## Implementare și validare

- Colector Keepa protejat, pentru o nișă per cerere, maximum 100 de candidați. Drepturile, cheia, aprobarea consumului, limita zilnică și categoria revizuită sunt obligatorii. Configurația implicită nu permite niciun apel plătit.
- Rezervare atomică de 150 de tokenuri per nișă/zi UTC, într-un document comun. Scanările concurente și reluările după timeout nu pot cheltui din nou aceeași rezervare. Maximum 3750 de tokenuri rezervate pe zi pentru acest endpoint, în același site Netlify.
- Loturile rămân private și necesită verificarea brandului, nișei și conceptului înaintea ingestiei publice. Data descărcării nu înlocuiește data sursei. Brandurile consacrate detectate, identitățile vechi și piețele greșite sunt excluse.
- Verificarea Free respinge numerele negative, șirurile numerice, procentele imposibile și numărul de sesiuni mai mare decât numărul de participanți. Rezultatul favorabil rămâne doar `READY_FOR_HUMAN_REVIEW`.
- `npm test`: **1810/1810**, zero eșecuri. Prima rulare a identificat lista structurală a funcțiilor care trebuia actualizată pentru cele două module noi; suita completă a trecut după actualizare.
- `npm run check` și `npm run build`: trecute. QA automată a verificat 26 de pagini; nu echivalează cu testarea pe un telefon fizic.

## Verificare în browser

Pe preview-ul privat al PR #596, la versiunea anterioară publicării colectorului (`5f2242e`), contul deja conectat a parcurs cei patru pași de onboarding. Un câmp de profil a fost modificat temporar, salvat și verificat după reîncărcare. Apoi valoarea inițială a fost restaurată și aplicația a confirmat salvarea. Recomandarea rezultată a fost Free. Testul nu a activat un abonament.

Acesta este un test de scriere și persistență pentru un singur cont. Nu dovedește izolarea completă între două conturi în browser și nu reprezintă o sesiune beta cu un participant real. Evenimentele de onboarding generate de această verificare sunt activitate QA.

## Ce nu este încă demonstrat

- Niciun apel Keepa real și niciun produs public nou nu au fost obținute prin colector. Nu există încă aprobarea de afișare, abonamentul/bugetul, categoria de pilot aprobată și politica de retenție agreată cu furnizorul.
- Colectarea Keepa nu este programată automat. Protocolul de operare și condițiile de activare sunt în `KEEPA_CONTROLLED_COLLECTION.md`.
- Nu avem încă 625 de concepte aprobate, ofertele furnizorilor, cele cinci sesiuni beta, testul pe telefon și toate dovezile operaționale necesare lansării.
- Solicitarea de licențiere Keepa a fost aprobată explicit și trimisă pe 26 septembrie; Gmail a confirmat trimiterea. Nu este un acord de licențiere sau o comandă de abonament. La următoarea verificare nu exista încă un răspuns.

Verdictul de lansare publică Free rămâne **NO_GO**. Nicio activare de plăți sau publicare a site-ului nu rezultă din aceste teste.

## Continuare — persistența fluxului Free

- Shortlist-ul nu mai afișează o salvare/ștergere reușită când browserul refuză stocarea. Starea precedentă rămâne intactă, interfața explică eroarea și nu înregistrează un eveniment de succes. Limita de 100 de produse și cheile invalide sunt tratate explicit. Accesul la `localStorage` este protejat inclusiv când getterul browserului aruncă o eroare de securitate.
- Onboardingul păstrează bugetul zero la reîncărcare. Salvarea profilului în cont este distinctă de salvarea locală a răspunsurilor despre plan: o problemă locală nu mai transformă un profil deja salvat într-o eroare aparentă de server. Profilurile neîncărcate și formularele rămase deschise după schimbarea contului sunt refuzate înaintea salvării.
- Testele dedicate acoperă refuzul stocării, limita shortlist-ului, lipsa unei confirmări false, salvarea parțială, bugetul zero și schimbarea contului.
- Verificarea automată pentru mobil include acum cele șase pagini suplimentare din fluxul Free (32 în total). Pagina de feedback are spațiu pentru marginile de siguranță ale dispozitivului. Acesta rămâne un control static; testarea pe telefon fizic nu este declarată realizată.
- `npm test`: **1819/1819**, zero eșecuri. `npm run check` și `npm run build` trecute.
- Testul tranzacțional `seller-preferences-isolation.sql` a trecut din nou pe proiectul Supabase conectat; fixture-urile sintetice au fost anulate prin `ROLLBACK`. Confirmă politicile bazei de date, nu înlocuiește testul cu două conturi în browser.
