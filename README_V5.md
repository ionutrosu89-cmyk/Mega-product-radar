# Mega Product Radar RO V5 LIVE

## Ce face
- foloseste Netlify Functions + Background Function
- ruleaza automat un scan zilnic
- foloseste OpenAI web search pentru semnale actuale
- compara cererea externa cu Romania
- cauta sourcing China
- calculeaza scorul final in cod
- salveaza rezultatele in Netlify Blobs
- aplicatia citeste intai LIVE data, apoi cade pe products.json daca nu exista inca un scan

## Fisiere noi
- package.json
- radar-data.mjs
- radar-scan-background.mjs
- radar-schedule.mjs

## Setare obligatorie in Netlify
Environment variable:
RADAR_INTERNAL_SECRET = un sir lung aleator (minim 32 caractere)

Optional:
RADAR_MODEL = gpt-5

## Test
Dupa deploy:
Netlify -> Functions -> radar-schedule -> Run now
Asteapta 1-5 minute, apoi deschide aplicatia si apasa Sync.

IMPORTANT
Datele live sunt semnale de research si estimari, nu garantii de vanzari.
Sourcing price, MOQ, dimensiuni si conformitatea trebuie reconfirmate inainte de comanda.
