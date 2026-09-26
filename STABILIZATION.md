# Stabilizare și acceptanță — 19 septembrie 2026

## Etape comune

`evidence-stage-policy.js` decide din fapte explicite. Scorul și clasamentul nu pot înlocui dovezile.

| Etapă | Cerință minimă |
|---|---|
| DISCOVERED | Candidat cu dovezi insuficiente |
| PROMISING | Semnal de prioritizare, fără cerere sau profit confirmat |
| VALIDATE | Trend longitudinal confirmat, comparație RO exactă, date curente, confidence ≥50 |
| FINALIST | VALIDATE + furnizor verificat, landed cost confirmat, marjă ≥20%, ROI ≥45%, profit pozitiv, importabilitate PASS, confidence ≥60 |
| TEST_READY | FINALIST + porți operaționale și de conformitate pentru test |
| BUY_READY | TEST_READY + rezultat măsurat acceptabil al unui test real |

`purchaseAuthorized=false`. O etichetă veche FINALIST/BUY nu înlocuiește faptele. `recalculatedAt` este separat de data observației. Interfața V5 reevaluează prospețimea pachetului.

## Date

Inventarul `source-inventory-live.json`: 542 produse cu observații Amazon live; **229** aveau observații în ultimele 72h la interogare. Observațiile publice nu sunt vânzări verificate. Seturile 2021/2024 sunt istorice. Existența unei programări nu garantează succesul colectării.

Ferestre inițiale: marketplace/trend 72h, România 7 zile, furnizor 30 zile, transport 7 zile. Reconfirmă oferta și transportul înainte de comandă și la schimbarea cantității, ambalajului sau rutei. Datele expirate se păstrează pentru cercetare, marcate explicit. Amazon are un job existent la două ore; nu s-au activat joburi sau cheltuieli noi.

## Intervention Watch și scanări

Migrările din 19 septembrie reproduc obiectele Intervention Watch găsite live. View-ul este security_invoker, tabelele au RLS, iar RPC-urile verifică membership înainte de scriere. Sync global este rezervat serviciului. Acțiunile au istoric; aceeași observație cu o dată nouă nu produce un duplicat.

Testele SQL din `supabase/tests/` verifică două workspace-uri, acces anonim, modificări directe și acțiuni, apoi baseline → preț schimbat → reverificare identică. Se termină cu rollback. Testele Blobs verifică 20 revendicări simultane, worker expirat, livrare duplicată și rezultate separate.

Scanările au o rezervare atomică per workspace, de 20 minute. Schedulerul cere `RADAR_SCHEDULE_WORKSPACE_ID`. După timeout la dispatch, rezervarea se păstrează până la expirare pentru a evita scanări plătite duplicate. Datele globale vechi nu sunt copiate automat într-un workspace.

## Lot pilot

5 accesorii de birou, cu surse și nepotriviri în `data/stabilization-pilot-review.json`. Raportul generat compară aplicația cu verificarea documentară. HOLD_FOR_EVIDENCE respinge avansarea, nu demonstrează lipsa profitabilității. Rezultatele de căutare nu confirmă prețul/stocul actual.

Pentru completare: SKU și specificație exactă; observații comparabile în timp pentru cerere; listări RO exacte cu limitele acoperirii; ofertă scrisă pentru cantitate, MOQ, valabilitate și Incoterm; greutate/dimensiuni ambalaj și transport; costuri fiscale, locale, comisioane și retururi, cu sursa fiecărei valori. Apoi se recalculează și se compară cu evaluarea manuală.

La inventar: 0 supplier_quotes, 0 test_execution_records, 0 beta_participants. Nu există încă dovadă pentru un produs validat comercial cap-coadă.

## Beta și extindere

Minimum 5 utilizatori reali: login, onboarding, produs, explicarea dovezilor, watchlist cu reîncărcare, detaliile unei intervenții reale. Repetați pe telefon, inclusiv tastatura, filtrele și dialogurile. Invitațiile nu au fost trimise automat.

`beta-study.html` salvează răspunsuri autentificate în journey_events, ca BETA_VALIDATION_SESSION. Operatorul verifică participanții reali și elimină conturile de test/duplicatele înainte de `evaluateBetaEvidence`. Un eveniment autodeclarat nu demonstrează efectuarea sesiunii. Feedback detaliat: `beta-feedback.html`.

Criterii propuse: ≥5 participanți reali, ≥80% înțeleg estimare/confirmare, ≥60% consideră recomandarea utilă, ≥80% finalizează watchlist, 0 probleme critice, acceptanță tehnică și minimum un flux de produs confirmat. Acestea sunt praguri, nu rezultate. Chiar dacă trec, verdictul este READY_FOR_HUMAN_LAUNCH_REVIEW; plățile rămân neactivate automat.

Rămân: replay SQL complet pe bază curată; integrare pe Netlify preview; login și mobil cu sesiuni reale; cotații/transport confirmate; beta observat. Verificarea structurală de mobil nu înlocuiește un telefon real.
