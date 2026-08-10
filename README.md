# Mega Product Radar

MVP mobile-first pentru afișarea oportunităților ecommerce. Interfața citește mai întâi
datele live din Netlify Blobs prin `radar-data` și folosește `products.json` numai ca
fallback.

## Configurare Netlify

Setați exclusiv în mediul server-side Netlify:

- `OPENAI_API_KEY` – folosit doar de background function;
- `RADAR_INTERNAL_SECRET` – protejează apelul intern către scanare;
- opțional `RADAR_MODEL` – modelul folosit de scanare.

Butonul **Run Scan** apelează endpoint-ul public `/api/radar/trigger`. Acesta transmite
secretul către `/api/radar/scan` doar server-to-server; răspunsul către browser nu îl
include. Scanarea programată existentă continuă să ruleze zilnic.

## Verificare locală

```sh
npm test
npm run check
```

Netlify publish directory: repository root (`.`).
