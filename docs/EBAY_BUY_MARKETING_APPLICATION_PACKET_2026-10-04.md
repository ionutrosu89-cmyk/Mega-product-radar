# eBay Buy Marketing: dosar pentru revizuirea modelului de utilizare

Pregătit la 4 octombrie 2026 pentru RED COMMERCE S.R.L. Acest document este un material de aplicație, **nu** dovadă de acces Production, contract, licență de redistribuire sau aprobare a unei categorii. Nu conține chei, tokenuri, date de card ori identificatori de utilizatori.

## Rezumat pentru eBay

Mega Product Radar este o aplicație web B2B pentru cercetarea produselor de către selleri din România. Propunem să afișăm liste eBay `BEST_SELLING` pe categorii aprobate, cu piața, sursa, rangul original și data observației. Utilizatorul poate compara separat cu alte marketplace-uri și poate deschide produsul pe eBay. Aplicația oferă o analiză proprie a oportunității comerciale; **nu** permite cumpărarea sau checkout-ul eBay în interiorul MPR. Cerem eBay să confirme explicit dacă această experiență de cercetare și trimitere către eBay este eligibilă pentru Buy Marketing API și ce modificări ar fi necesare. Nu o prezentăm drept aplicație de cumpărare aprobată.

## Ecran și flux propus

1. Utilizatorul deschide `/top25.html`, selectează una dintre cele 25 de nișe și tabul „eBay”. Dacă nu există aprobare, 25 de poziții și prospețime, tabul spune „Acces necesar” și nu afișează produse.
2. Dacă sursa este aprobată, vede „eBay US” sau „eBay DE”, categoria eBay verificată, data și ora observației, eticheta `BEST_SELLING`, maximum 25 de produse cu rangul sursei, un link către pagina eBay și explicația că rangul nu reprezintă numărul de unități vândute.
3. Utilizatorul poate selecta separat o altă platformă. Selecția MPR pentru produse fără brand consacrat este distinctă de lista eBay și nu rescrie rangul eBay. Nu combinăm rangurile într-un „top Amazon/eBay” pretins a fi publicat de platforme.
4. La 14 zile lista devine scadentă pentru reîmprospătare; la 30 de zile de la cea mai veche observație este retrasă. Revocarea drepturilor retrage lista. Nu există fallback la arhive vechi sau la rezultate inventate.

## Flux tehnic propus

```text
Revizie umană categorie eBay + drepturi scrise
    → target aprobat pentru nișă și piață
    → funcție server-side internă, autentificată cu secret propriu
    → OAuth application token cu scope Buy Marketing
    → GET /buy/marketing/v1/merchandised_product
       ?category_id=<categoria aprobată>&metric_name=BEST_SELLING&limit=25
    → validare EPID, rang 1–25, URL HTTPS, piață și dată
    → stocare snapshot intern în Supabase
    → API Free public verifică din nou drepturi, completitudine și expirare
    → interfață etichetată eBay, link către eBay
```

Cheile și tokenurile sunt server-side. Browserul nu primește credentiale eBay. Pentru revizie internă poate fi cerută o listă de până la 100 de candidați numai dacă API-ul și termenii permit limita respectivă; publicăm cel mult 25 după verificare. Nu există apeluri Production active acum. Sandboxul eBay poate returna date demonstrative și nu poate demonstra acoperirea celor 25 de nișe.

## Date și volum propuse spre aprobare

| Element | Comportament cerut | Confirmare necesară de la eBay |
| --- | --- | --- |
| Identificator EPID, titlu minimal, rang și categorie | Afișare Free și ulterior SaaS plătit; păstrare maximum 30 zile | Câmpuri și scopuri permise, eventuale restricții pentru titlu/rang |
| Link produs | Trimitere către eBay din fiecare card | Formatul și parametrii obligatorii; afiliere sau disclosure dacă se aplică |
| Preț, valută, rating, număr de recenzii | Numai dacă sunt returnate și permise; fiecare cu data sursei | Drepturi, prospețime, atribuirea și TTL distincte |
| Imagine/descriere | Nu sunt necesare în pilot | Dacă se folosesc ulterior, drepturi și termen de cache separat |
| Snapshot și istoric | Stocare pentru maximum 30 zile, apoi retragere/ștergere conform acordului | Retenție, export, ștergere după încetare și audit |
| Analiză derivată | Filtrare de brand pentru selecția MPR, semnale și comparație între surse fără schimbarea rangului eBay | Dreptul de a calcula/afișa derivate și de a combina cu alte surse |

Pilotul ar cere trei nișe și câte o categorie oficială revizuită pentru `EBAY_US`; extinderea la 25 nișe și eventual `EBAY_DE` depinde de relevanța categoriilor și de aprobarea eBay. La o reîmprospătare la 14 zile, 25 ținte înseamnă aproximativ 50–60 cereri Marketing pe lună pentru o singură piață, înainte de retry sau schimbări de taxonomie. Solicităm eBay să confirme cota și condițiile; această estimare nu autorizează consumul API.

## Întrebări de trimis în procesul oficial

1. Este eligibil un SaaS B2B de market research, cu link extern către eBay și fără checkout propriu, pentru EPN și Buy Marketing Production? Dacă nu, care ar fi programul sau API-ul corect?
2. Permite contractul afișarea către utilizatorii Free și, separat, către clienți plătitori? Ce câmpuri, atribuire, linkuri și disclosure sunt obligatorii?
3. Permite păstrarea snapshoturilor timp de 30 zile, comparația cu alte platforme și scoruri derivate? Care sunt regulile de ștergere și export?
4. `BEST_SELLING` este un rang ordonat, stabil, per categorie și piață pentru `EBAY_US`/`EBAY_DE`? Care este numărul maxim de produse returnate și ce înseamnă rangul în cazul unui EPID cu mai multe oferte?
5. Există cost obligatoriu, angajament comercial sau prag de volum pentru acest acces? Noi nu vom accepta costuri fără aprobare separată.
6. Care este ruta oficială pentru verificarea contului EPN când SMS-ul către un număr din România nu ajunge? Ce date trebuie transmise prin canal securizat?

## Dovada ce trebuie adăugată înainte de activare

- Răspunsul de eligibilitate EPN și aprobarea aplicației, cu versiunea termenilor/contractului.
- Acces Buy Marketing Production confirmat pentru keysetul firmei, fără publicarea cheilor în repository.
- Confirmare scrisă pentru afișare, retenție, derivate, atribuire, cota și cost.
- Răspuns real pentru o categorie pilot, revizie umană a relevanței și 25 poziții valide.
- Verificare de expirare/revocare și test pe deploy-ul exact, înainte de schimbarea flagurilor fail-closed.

Referințe oficiale: [Buy API requirements](https://developer.ebay.com/api-docs/buy/buy-requirements.html), [Marketing API](https://developer.ebay.com/api-docs/buy/api-marketing.html), [Marketing and Discounts Guide](https://developer.ebay.com/develop/guides/buy/marketing-and-discounts-guide), [marketplace support](https://www.developer.ebay.com/api-docs/buy/static/ref-marketplace-supported.html).
