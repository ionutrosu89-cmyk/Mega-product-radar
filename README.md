# Mega Product Radar

Mega Product Radar V7 folosește Netlify pentru frontend și funcții server, Supabase pentru autentificare și workspace-uri și Netlify Blobs pentru scanări. GitHub Pages nu este configurația SaaS de producție.

## Instalare și verificare

Node.js 22+ (CI: Node 24), npm și package-lock.json.

```sh
npm ci --ignore-scripts --no-fund
npm test
npm run check
npm run verify:migrations
npm run build
```

Build-ul generează `_site/`, publicat de Netlify. Nu publica rădăcina: conține artefacte private. Pornește configurația serverului de la `.env.example`; cheile de serviciu și secretul radar nu se pun în browser. `saas-config.js` conține doar URL-ul și cheia publică Supabase. Un server static local nu execută `/api/*`; pentru integrare folosește un site Netlify de dezvoltare configurat. Păstrează furnizorii plătiți opriți în testele unitare.

Aplică migrările conform `supabase/README.md`. `verify:migrations` validează fișierele, nu rulează SQL pe o bază goală. Testele SQL tranzacționale din `supabase/tests/` necesită un rol administrativ și se termină cu rollback.

Reguli, surse, lot pilot și acceptanță beta: [STABILIZATION.md](STABILIZATION.md). Recalculare locală, fără colectare plătită:

```sh
node scripts/commercial-final-decision.mjs
node scripts/golden-product-pipeline.mjs
node scripts/run-validation-pilot.mjs
```

Consultă `validation-pilot.html` și `beta-study.html`. Lotul pilot este o verificare documentară; ofertele și testele comerciale reale trebuie obținute separat.

## Pipeline istoric de cercetare

- interfața SaaS se publică pe Netlify din `_site/`;
- `products.json` este baza de date fallback;
- `radar-live.json` conține rezultatele scanării automate;
- `scan-status.json` păstrează starea ultimei rulări;
- `scripts/web-radar-scan.mjs` verifică semnale web pentru piețe externe, România și sourcing China;
- `.github/workflows/radar-scan.yml` rulează scanarea zilnic și redeployează automat aplicația.

## Ce verifică radarul

Radarul folosește semnale de prezență în rezultate web pentru piețe precum Amazon DE, Allegro PL, Trendyol TR, eMAG RO și Alibaba. Aceste semnale sunt folosite pentru recalcularea scorului de oportunitate și pentru prioritizarea produselor.

Important: semnalele web indică prezență și diferențe de piață, nu garantează volum de vânzări. Costul China, MOQ, conformitatea și prețul final trebuie reconfirmate înainte de comandă.

## Automatizare

Workflow-ul `Mega Product Radar Scan` rulează:

- manual, prin `workflow_dispatch`;
- automat zilnic la 04:30 UTC;
- la modificări ale motorului radar.

Artefactele de cercetare salvate în repository sunt separate de scanările SaaS pe workspace. Configurația efectivă de producție este `netlify.toml`; nu interpreta un fișier regenerat drept dovadă proaspăt colectată.
