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
- Solicitarea de licențiere Keepa este redactată separat și așteaptă aprobarea expeditorului; nu este un acord și nu a fost trimisă.

Verdictul de lansare publică Free rămâne **NO_GO**. Nicio activare de plăți sau publicare a site-ului nu rezultă din aceste teste.
