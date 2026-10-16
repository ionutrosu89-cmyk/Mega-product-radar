# Acceptare beta și verificări de cont — 16 octombrie 2026

Acest document continuă registrul [celor patru planuri](FOUR_PLAN_RELEASE_EXECUTION_2026-10-04.md). Nu autorizează publicarea, cheltuieli, colectare plătită sau checkout Live.

## Rezultatul sesiunii tehnice

Codul de bază verificat: `2dafc9c1e1a6d23de7eedd0873b76410c8ff33c9`, PR #596, preview privat. Corecția formularului și cele șase teste noi sunt în `1498db2c9a18d0e3e6aaba86da956935eafaf3b0`. Cele 20 de teste locale țintite au trecut într-un snapshot izolat; verificările CI și deploy-ul nou se consemnează separat după terminare.

- Contul B, cu profil eMAG/Birou și buget 3.000 RON, a fost salvat și reîncărcat în sesiunea din 12 octombrie.
- La 16 octombrie, utilizatorul a revenit în contul A. Pagina de cont a confirmat identitatea primului cont și planul Free.
- În contul A au rămas eMAG RO, Trendyol RO, Site propriu; Auto, Electronice, Beauty, Pet, Sport, Birou; buget 7.800 RON, risc echilibrat, China, TVA necunoscut. Aceleași valori au reapărut după reload.
- Nu s-a salvat un profil nou în această verificare. A fost completată proba de revenire la profilul A după salvarea profilului B. Aceasta nu este o probă completă RLS pentru toate operațiile/tabelele și nu validează watchlist-ul cu produse reale.

Formularul beta acceptă acum răspunsuri „Nu am testat” / „Indisponibil” pentru dovezi și utilitate. Acestea se păstrează explicit, cu rezultat necunoscut (`null`), fără a deveni succes sau răspuns negativ al unui participant. Lipsa produselor nu poate satisface pragurile de lansare. Un eșec la salvare reface butonul și afișează eroarea; clickurile repetate nu dublează o cerere în curs. Formatul `STABILIZATION_2` rămâne compatibil cu agregatorul existent.

## Situația celor patru planuri

| Plan | Dovadă existentă | Următoarea probă obligatorie |
| --- | --- | --- |
| Free | Onboarding A → B → A cu preferințe distincte; controale de acces testate | Produse recente autorizate, salvare reală în lista Free, reload și schimbare de cont |
| Discover | Entitlement testat; activare în lifecycle-ul Stripe TEST separat | Trenduri/istoric/alerte pe semnale reale autorizate și parcurs în browser |
| Radar | Reguli de acces/decizie testate; activare Stripe TEST separat | Cerere și comparabile RO, scan controlat și persistența watchlist-ului real |
| Launch | Module de furnizori/economie testate; activare/anulare Stripe TEST separat | Ofertă scrisă, ambalaj, cantitate, transport și cost complet pentru un produs |

Lifecycle-ul de billing 6/6 aparține Sandbox-ului separat, sursa `4d69d9e3b51c27ee60c1a11b8a0f4b0e43bde912`, GitHub run 38122609657, attempt 2. Nu este probă de produs sau de checkout în browser pe noul deploy al PR #596.

## Protocol pentru telefon fizic

Responsabil: proprietarul proiectului. Status: **NEEXECUTAT**. Emularea unei lățimi mobile nu înlocuiește acest test.

Înainte de sesiune, se notează commitul/deploy-ul exact, data, modelul telefonului, OS-ul și browserul. Se folosește preview-ul privat autorizat.

1. Deschide `account.html`, autentifică-te, verifică emailul contului și planul.
2. Deschide `onboarding.html`: în timpul încărcării câmpurile și navigarea trebuie blocate. La final trebuie să apară profilul corect.
3. Parcurge cei patru pași, salvează preferințele, reîncarcă pagina și verifică valorile.
4. Deschide `top25.html`. Verifică meniul, selecția nișei, lizibilitatea, scroll-ul și absența depășirii orizontale.
5. Numai dacă există un produs aprobat: notează ID-ul, sursa, piața, data observării și linkul; salvează-l în lista Free, reîncarcă și redeschide browserul.
6. La schimbarea contului, lista contului precedent nu trebuie afișată în contul nou.
7. Pe Free, accesul direct la watchlist-ul Radar trebuie să conducă la explicația planului necesar. Nu iniția plăți.
8. Documentează o eroare de rețea și recuperarea fără mesaj fals de salvare. Nu declara pasul trecut dacă nu poate fi provocat în condiții controlate.
9. Completează `beta-study.html` doar cu observațiile reale. Lipsa produselor = indisponibil.

Dovezi: capturi fără parole/coduri/tokenuri, descrierea rezultatului așteptat și observat, bug și severitate. Orice eroare critică rămâne blocantă.

## Cinci sesiuni beta reale

Participanții de mai jos sunt **sloturi nealocate**, nu persoane invitate sau rezultate de test. Nu se introduc evaluări simulate în `journey_events`.

| Slot | Participant real / identitate legată | Telefon / browser | Produs / sursă / dată | Înțelegere | Utilitate | Watchlist după reload | Rezultat |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B01 | Nealocat | De completat | Indisponibil până la aprobare | Netestat | Netestat | Netestat | ÎN AȘTEPTARE |
| B02 | Nealocat | De completat | Indisponibil până la aprobare | Netestat | Netestat | Netestat | ÎN AȘTEPTARE |
| B03 | Nealocat | De completat | Indisponibil până la aprobare | Netestat | Netestat | Netestat | ÎN AȘTEPTARE |
| B04 | Nealocat | De completat | Indisponibil până la aprobare | Netestat | Netestat | Netestat | ÎN AȘTEPTARE |
| B05 | Nealocat | De completat | Indisponibil până la aprobare | Netestat | Netestat | Netestat | ÎN AȘTEPTARE |

Fiecare participant: login → onboarding → selectare nișă/sursă → citire fișă → explicarea dovezilor → salvare/reload → evaluare. Moderatorul nu sugerează răspunsurile. Se poate testa navigarea înainte de date, dar sesiunea nu contează ca flux de produs complet.

Praguri pe minimum cinci participanți reali și cinci fluxuri de produs: minimum 4/5 înțeleg dovezile, 3/5 găsesc recomandarea utilă, 4/5 finalizează watchlist; zero probleme critice și minimum un produs confirmat cap-coadă. Cu mai mult de cinci participanți se folosesc procentele, nu doar aceste numere. Celelalte ținte ale scorecard-ului (cohortă, activare, feedback etc.) rămân aplicabile și nu sunt înlocuite de acest lot minim.

## Pilotul DataForSEO

**BLOCAT DE ACTIVAREA CONTULUI ȘI CLARIFICĂRILE FURNIZORULUI.** La 16 octombrie, formularul Business rămâne fără câmp telefon. Ultimul răspuns Anna cere introducerea telefonului, fără să rezolve nepotrivirea formularului sau să confirme utilizarea pe firmă cu Gmail. A fost trimisă escaladarea tehnică în același fir. Nu s-a găsit un răspuns ulterior la verificarea emailului din această sesiune.

După rezolvare:
1. Proprietarul introduce parola nouă și finalizează termenii. Nicio plată, niciun card sau top-up.
2. Se confirmă soldul gratuit și prețul/cota endpointului înainte de execuție; dacă nu se încadrează în creditul gratuit, se oprește.
3. Se execută maximum două căutări private inițiale din planul local, cu piață/limbă și moment de observare explicite.
4. Se păstrează rangul de căutare separat de bestseller/volum de vânzări. Se verifică produsul, variația, marca, duplicatele și potrivirea nișei.
5. Se verifică permisiunea de stocare și afișare. Până la confirmare, datele nu intră în feedul public și nu contează la acoperirea 25×25.

## Ordinea imediată

1. Terminarea CI/deploy pentru corecția beta și verificarea opțiunilor în browser, fără trimitere de evaluări fictive.
2. Activarea gratuită DataForSEO prin suport; verificarea drepturilor și pilotul privat în limita creditului.
3. Date reale aprobate pentru primul lot → shortlist real → telefon → cinci sesiuni.
4. Extinderea la două surse independente / nișă, 50 liste recente / 1.250 poziții și 625 oportunități MPR revizuite.
5. Acceptarea funcțiilor Discover/Radar/Launch pe aceleași dovezi și pe deploy-ul ales; revizuire umană finală.

Stare de lansare: **NO-GO**. Nicio plată, abonament sau publicare nu a fost activată.
