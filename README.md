# Mega Product Radar

Mega Product Radar este o platformă SaaS de product intelligence pentru selleri și importatori. Arhitectura de producție actuală este **Netlify + Supabase**; documentația canonică este `PRODUCTION_ARCHITECTURE.md`.

## Public Free Beta

Ținta curentă de lansare este Public Free Beta, în regim fail-closed:

- 25 de nișe × Top 25 produse = 625 poziții publice eligibile;
- Top25 Free folosește dovezi istorice licențiate și este etichetat explicit ca istoric, nu „best sellers 2026”;
- datele live/dinamice nu devin publice doar pentru că sunt accesibile tehnic;
- apelurile către furnizori de date plătiți sunt dezactivate implicit;
- colectarea programată cu cost și Stripe Live sunt dezactivate implicit;
- lipsa dovezii rămâne `INSUFFICIENT DATA` / HOLD, nu este completată cu cifre inventate.

Endpoint public canonic pentru Top25 istoric: `/api/free/top25`.

## Arhitectura curentă

- frontend static construit și publicat pe Netlify;
- Netlify Functions pentru API și operații server-side;
- Supabase PostgreSQL + Auth pentru date, workspaces și autentificare;
- RLS pentru date tenant expuse browserului;
- `service_role` exclusiv server-side;
- migration chain în `supabase/migrations`;
- CI pentru teste, dependency audit, production safety, migration verification, bundle hardening, secret scan și QA mobil.

## Integritate și surse

MPR separă explicit:

- **VERIFIED** — dovadă directă adecvată afirmației;
- **DERIVED** — calcul determinist din dovezi;
- **ESTIMATED** — estimare etichetată cu ipoteze;
- **INSUFFICIENT DATA** — date insuficiente, fără precizie inventată.

Rank-ul, review count-ul, search interest-ul sau viralitatea nu sunt transformate automat în „vânzări verificate”. Prețul public al furnizorului nu este automat landed cost, iar un scor de oportunitate nu autorizează achiziția.

## Documente de control

- `PRODUCTION_ARCHITECTURE.md` — arhitectura canonică;
- `PUBLIC_FREE_LAUNCH_AUDIT.md` — auditul și GO/NO-GO gate-ul pentru Public Free Beta;
- `sources.html` — politica publică de surse și drepturi;
- `privacy.html`, `cookies.html`, `subprocessors.html`, `terms.html` — documente publice de conformitate.

## Regula de release

Build verde nu înseamnă automat lansare. Public Free Beta rămâne **NO-GO** până când fiecare control P0 din `PUBLIC_FREE_LAUNCH_AUDIT.md` este marcat `VERIFIED` cu dovadă.

Referințele vechi la GitHub Pages și la scanarea zilnică automată reprezintă arhitectură legacy și nu trebuie folosite ca model pentru producția curentă.
