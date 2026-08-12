# Mega Product Radar

Mega Product Radar este o aplicație statică publicată pe GitHub Pages, cu scanare automată zilnică prin GitHub Actions.

## Arhitectura curentă

- interfața rulează pe GitHub Pages;
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

După fiecare scan reușit, rezultatele sunt salvate în repository și aceeași rulare redeployează GitHub Pages, astfel încât aplicația publică să primească datele actualizate fără intervenție manuală.
