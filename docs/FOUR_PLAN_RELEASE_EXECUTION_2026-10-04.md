# Execuția lansării Mega Product Radar: Free, Discover, Radar, Launch

Actualizat la 4 octombrie 2026. Acest registru descrie probele necesare, nu promite că serviciile sau datele externe sunt deja disponibile. Lucrăm în ordinea de mai jos; un pas se închide numai cu dovezi pentru commitul și deploy-ul testate. Nu activăm plăți, abonamente, API-uri cu cost sau publicarea fără decizia explicită a proprietarului. Un rezultat automat poate propune numai revizuirea umană.

## Situația verificată

| Plan | Implementat și verificat local | Ce lipsește pentru funcționare reală |
| --- | --- | --- |
| Free | 25 nișe configurate, UI Top25, porți de prospețime/drepturi și teste | Două surse autorizate pentru fiecare nișă, 25 poziții recente per sursă și nișă, 625 oportunități MPR revizuite, probe de utilizare și lansare |
| Discover | Entitlement și funcții de trend, filtre, istoric/alerte configurate; teste de plan trecute | Semnale globale reale, recente și licențiate, istoric/alerte validate în producție, parcurs de abonament în Stripe Sandbox |
| Radar | Entitlement și reguli pentru Romania Gap, Opportunity Engine, decizie/watchlist; teste locale | Comparabile RO și cerere la nivel de produs, cel puțin un produs validat cap-coadă, scan real controlat, parcurs de abonament în Sandbox |
| Launch | Entitlement și module de furnizori, economie, plan de lansare; teste locale | Oferte scrise și cost complet, verificare cu utilizatori, contracte/termeni comerciali, parcurs de abonament în Sandbox și control operațional |

Pagina de pricing din preview indică explicit că Discover, Radar și Launch sunt acum doar teste de interes: checkout-ul și abonamentele reale sunt oprite. Pe pagina Top25 din același preview sunt afișate 25 nișe, zero oportunități generice aprobate și zero poziții brute de sursă. Nu echivalăm prezența unei funcții în cod sau un test cu un serviciu de producție disponibil.

## Pașii, în ordine

1. **Contractul și porțile de lansare Free — ÎNCHEIAT.** [`FREE_GO_LIVE_STEPS_2026-10-04.md`](FREE_GO_LIVE_STEPS_2026-10-04.md) și commitul [`0dd1b44`](https://github.com/ionutrosu89-cmyk/Mega-product-radar/commit/0dd1b44a39cc4fbed1011079af2f05ee71d13986) fixează acoperirea 25 × 25 și două marketplace-uri independente per nișă. 1.872 teste locale, build și 21 verificări CI au trecut; CI a trecut și pe commitul ulterior de documentație `b41ad3a`.
2. **Drepturi și acces la date — ÎN LUCRU.** Cererile către eBay Partner Network și AliExpress Open Platform au fost trimise la 4 octombrie 2026 de pe `office.redcommerce@gmail.com`, fără chei ori date de plată. eBay trebuie să clarifice SMS-ul care blochează EPN, eligibilitatea SaaS, accesul Buy Marketing Production, câmpurile/retenția/atribuirea și eventualele costuri. AliExpress trebuie să confirme endpointul actual pentru un clasament real, grupul API, dreptul de afișare și costul. Niciun email trimis sau confirmare de primire nu este o licență. Keepa, la 49 EUR/lună, este în afara bugetului și rămâne oprit. Dacă acestea nu sunt două surse fezabile, se caută alte surse licențiate; scopul produsului se schimbă doar prin decizia explicită a proprietarului.
3. **Pilotul de date Free.** Trei nișe, două surse aprobate, câte 25 poziții complete și datate per listă. Se testează două cicluri de reîmprospătare și retragerea la 30 zile. Niciun clasament de căutare sau dataset istoric nu este prezentat ca bestseller actual.
4. **Un produs comercial confirmat.** Se finalizează specificația, cererea, comparabilele românești, oferta scrisă, transportul, taxele și costurile locale. Estimările rămân etichetate ca atare.
5. **Acoperirea completă Free.** Toate cele 25 nișe primesc două clasamente aprobate, adică minimum 50 liste și 1.250 poziții observate; separat sunt revizuite 625 oportunități generice. Programarea la 14 zile și expirarea la 30 sunt verificate pe date reale.
6. **Parcursurile de produs și operare.** Login, onboarding, watchlist, persistență și izolare în două workspace-uri, telefon fizic, domeniu public, recuperare acces, suport și restaurare.
7. **Beta Free cu utilizatori reali.** Minimum cinci sesiuni după `beta-study.html`: cel puțin 80% înțeleg dovezile, 60% găsesc recomandarea utilă, 80% finalizează watchlist; zero probleme critice.
8. **Discover.** Pentru funcțiile afișate se verifică sursa și dreptul de afișare pentru trend/rising, istoricul, filtrele și alertele. Se execută în Stripe Sandbox, fără bani reali, traseul Free → Discover, entitlementul, webhookul și anularea. Prețul și activarea reală rămân decizia proprietarului.
9. **Radar.** Se verifică Romania Gap și recomandarea pe dovezi reale, criteriile de excludere, watchlistul și scanul controlat. Se execută în Sandbox Discover → Radar și revenirea corectă la entitlement la anulare.
10. **Launch.** Se verifică furnizorii, landed cost/profit/ROI și planul de execuție pe documente reale, inclusiv riscurile de import. Se execută în Sandbox Radar → Launch → anulare → Free; nu se folosesc carduri reale.
11. **Revizuire comercială finală.** Pentru cele patru planuri se repetă testele și probele pe același commit/deploy, se verifică drepturile, securitatea, costurile și suportul. Nici checkout-ul Live, nici plata, nici publicarea nu sunt activate automat.

### Dovezi și blocaje imediate

- [PR #596](https://github.com/ionutrosu89-cmyk/Mega-product-radar/pull/596) este draft, cu deploy preview privat.
- Testele țintite pentru planuri, billing, acces la workspace și poarta E2E au trecut 34/34 la 4 octombrie 2026. Acestea sunt teste locale cu date controlate, nu o tranzacție Stripe Sandbox și nici o probă de producție.
- [eBay Buy API requirements](https://developer.ebay.com/api-docs/buy/buy-requirements.html) cer aprobări EPN și Production; [Application Growth Check](https://developer.ebay.com/grow/application-growth-check) este gratuit, dar aprobarea nu este garantată.
- [AliExpress API permissions](https://developer.alibaba.com/docs/doc.htm?articleId=120676&docType=1&treeId=727) trebuie aprobate per aplicație. Endpointul și dreptul exact pentru clasamente publice rămân neconfirmate.
- Documentația actuală [Amazon Creators API](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction) cere participare Associates și vânzări eligibile pentru acces și descrie căutare/catalog, nu un Top 25 bestseller licențiat pentru SaaS. Amazon nu este marcat drept a doua sursă până la o permisiune aplicabilă.

### Verificare read-only în Supabase conectat, 4 octombrie 2026

- Proiectul era `ACTIVE_HEALTHY`. În schema `public`, toate tabelele returnate de inventar aveau RLS activ. Lanțul din baza conectată avea 135 de migrări istorice; acesta nu este același număr ca fișierele de migrare consolidate din repository și nu dovedește singur paritatea schemei.
- Număr agregat: 3 workspace-uri, 1 element în `commercial_watchlist`, **0** rânduri în `current_top25_snapshots_v1` și 3 înregistrări de abonament. Abonamentele curente erau numai `FREE`: 2 `canceled`, 1 `FOUNDATION`. Aceasta descrie starea finală, nu istoricul testului de planuri.
- `billing_e2e_acceptance_runs` conține un parcurs complet `SANDBOX`, cu șase checkpointuri, `realMoney=false` și verdict `GO`, terminat la 5 septembrie 2026 pentru deploy-ul `c305792e968cee125001809a4e2785ba5973db12`. Mai există două runde `IN_PROGRESS` din 31 august. `GO` este dovadă istorică pentru acel deploy; verificarea trebuie repetată pe deploy-ul ales pentru lansare, fără a transforma testul Sandbox în permisiune pentru checkout Live.
- `source_rights_registry_v2` avea 4 profiluri: două seturi istorice Amazon 2023/2021, o verificare manuală pentru analiză și YouTube Data API pentru analiză. Niciun profil eBay sau AliExpress aprobat pentru afișare nu era prezent. Licența unui set istoric nu îl transformă în Top 25 curent.
- [Consilierul de securitate](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) semnalează două RPC-uri `SECURITY DEFINER` accesibile rolului `authenticated`. Codul lor verifică `auth.uid()` și apartenența la workspace, iar UI le apelează direct; avertismentul cere revizuirea rolurilor permise, nu dovedește singur o încălcare între workspace-uri. Consilierul semnalează și [protecția pentru parole compromise](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) ca neactivată. Nu s-au schimbat schema, datele sau setările Auth prin această verificare.
