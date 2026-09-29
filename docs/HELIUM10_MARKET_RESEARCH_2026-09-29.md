# MPR versus Helium 10 — cercetare de piață și traseu de date

Verificat la 29 septembrie 2026. Acesta este un plan de produs și de acces la date, nu o dovadă că MPR deține datele sau drepturile descrise. Costurile sunt prețuri publice la data verificării; pot varia. Nu autorizează cumpărarea, colectarea sau lansarea.

## Rezultatul cercetării

Helium 10 nu este un simplu top de bestselleruri. Produsul combină descoperire de produse (Black Box), inspecția unei pagini Amazon/Walmart (Xray), cercetarea cuvintelor cheie (Cerebro și Magnet), urmărirea pieței și calculul profitabilității. [Black Box](https://kb.helium10.com/hc/en-us/articles/6710274045339-Black-Box-Product-Tab-Overview) filtrează după marketplace, categorie, preț, concurență și venit lunar *estimat*; [Xray](https://kb.helium10.com/hc/en-us/articles/360048281774-How-Do-I-Set-Up-and-Navigate-Xray) adaugă BSR, recenzii, preț, istoric și estimări pe o listare. [Cerebro](https://kb.helium10.com/hc/en-us/articles/360046326894-How-Do-I-Use-Cerebro) face reverse-ASIN, iar [Magnet](https://kb.helium10.com/hc/en-us/articles/360046314694-Magnet-Video-Introduction-and-Overview) caută termeni și volume estimate. [Market Tracker 360](https://kb.helium10.com/hc/en-us/articles/5472121601563-How-to-Create-a-Market-Using-Market-Tracker-360) grupează ASIN-uri, mărci și cuvinte cheie într-o piață monitorizată.

Helium 10 explică [proveniența datelor](https://kb.helium10.com/hc/en-us/articles/360007907533-How-Does-Helium-10-Get-Its-Data): funcțiile pentru propriul cont de vânzător primesc date prin API Amazon, iar mare parte din cercetarea pieței provine din observații ample transformate prin modele proprietare. [Xray estimează vânzările pe ultimele 30 de zile din BSR](https://kb.helium10.com/hc/en-us/articles/1260805907550-How-Do-I-Use-the-Sales-Estimator-in-the-Chrome-Extension); acestea nu sunt comenzile reale ale unui concurent. Pentru variații, [Helium 10 însuși avertizează](https://kb.helium10.com/hc/en-us/articles/1260805502930-How-Do-I-Access-and-Interpret-Xray-Data-for-Listings-with-Variations) că BSR este la nivelul întregii listări și nu poate determina exact vânzările fiecărei culori/mărimi.

### Ce înseamnă pentru MPR

| Capacitate | Helium 10 | MPR acum | Etapa MPR realizabilă |
| --- | --- | --- | --- |
| Descoperire/filtre | Black Box cu estimări Amazon | 25 de nișe, 10 concepte editoriale DRAFT; 0/625 Top25 aprobate | Filtre după nișă, piață, risc, prospețime și calitatea dovezii; rang numai din sursă autorizată |
| Inspectarea produsului | Xray: BSR, istoric, recenzii, estimări | Observații punctuale și reguli de prospețime; fără istoric amplu pentru catalog | Fișă cu sursa, data, prețul observat, variația și limitele afirmației |
| Cerere/keyword | Cerebro/Magnet, volume Amazon estimate | Google Trends RO pentru o nișă; fără volume Amazon | Interes Google cu atribuire + semnale permise de reclame/video; etichetate separat de vânzări |
| Monitorizare | Tracker și alerte | Infrastructură de observații, snapshot și watchlist; catalogul este gol | Reîmprospătare după expirare, diferențe și notificări pentru date cu acces aprobat |
| Profitabilitate | Calculator cu comisioane și costuri introduse | Formule și verificator de oferte | Scenarii explicite; marja devine confirmată doar cu ofertă și logistică reale |
| Avantajul MPR | Amazon/Walmart/TikTok pentru comercianți | Potențial RO: concurență locală, sursă, cost complet, decizie explicată | Radar de oportunități pentru România; motivul includerii și al respingerii |

## Costuri și drepturi verificate

| Opțiune | Preț/acces observat | Ce poate aduce | Limită pentru MPR |
| --- | --- | --- | --- |
| [Helium 10 Free](https://kb.helium10.com/hc/en-us/articles/1260803831790-Which-Helium-10-Plan-Is-the-Right-One-for-Me) | 5 utilizări Black Box pe viață, Xray limitat; [Platinum $129/lună, Diamond $359/lună](https://www.helium10.com/pricing/) la plată lunară | Cercetare manuală de reper | [Termenii Helium 10](https://www.helium10.com/terms-and-conditions/) permit uz intern și interzic extragerea în masă pentru redistribuire sau construirea unui concurent. Nu este un feed public pentru MPR. |
| [Jungle Scout](https://support.junglescout.com/hc/en-us/articles/26264588139799-Information-about-our-Membership-Plans) | Starter $49/lună conform paginii de suport; fără API sau export CSV pe acest nivel | Reper concurențial pentru produs, keyword și furnizori | Peste buget și nu rezolvă dreptul de redistribuire. |
| [Amazon Creators API](https://affiliate-program.amazon.com/creatorsapi/docs/) | Associates este gratuit; API-ul cere cont acceptat și **10 vânzări calificate în ultimele 30 zile** | Identitate, ofertă și catalog Amazon.com prin API oficial | Nu furnizează estimări de vânzări ale concurenților; [câmpurile de conținut au limite de cache și afișare](https://affiliate-program.amazon.com/help/operating/policies). Eligibilitatea și modelul MPR trebuie validate. |
| [Amazon Product Opportunity Explorer](https://sell.amazon.com/tools/product-opportunity-explorer) | Cont Professional Seller **$39,99/lună** + comisioane | Cerere, căutări, comportament de cumpărare în Seller Central | Instrument pentru deciziile vânzătorului, nu licență de publicare a datelor într-un SaaS. |
| [eBay Buy Marketing](https://developer.ebay.com/api-docs/buy/api-marketing.html) | API documentat pentru `BEST_SELLING` pe categorie și `most_watched_items`; nu am confirmat o taxă de abonament | Un Top eBay cu rang real al sursei, distinct de Amazon | [Sandbox este disponibil cu cont Developer; producția cere EPN, cerere, revizie și contract](https://developer.ebay.com/api-docs/buy/buy-requirements.html). Cheile Developer singure nu constituie aprobare. |
| [Google Trends](https://support.google.com/trends/answer/4365538?hl=en) | Export CSV din interfață, cu atribuire; [API-ul este alpha cu acces limitat](https://developers.google.com/search/apis/trends) | Interes relativ și sezonalitate RO/SUA | Indicele nu reprezintă volum absolut sau vânzări. Un termen generic nu probează cererea unui produs exact. |
| [TikTok Creative Center](https://ads.tiktok.com/help/article/creative-center?lang=en-GB) | Public și gratuit pentru cercetare de tendințe/reclame | Indiciu de atenție și produse promovate | Nu este API de vânzări TikTok Shop și nu presupunem drept de redistribuire automată. |
| [Meta Ad Library API](https://www.facebook.com/ads/library/api/) | API pentru reclame UE/UK din ultimul an și reclame politice mai vechi; autorizare de cont/aplicație | Observație despre publicitate Facebook/Instagram | Reclama nu probează vânzări. Accesul și reutilizarea trebuie validate înaintea ingestiei. |
| Keepa | Răspunsul scris din dosarul local indică aproximativ **€49/lună** pentru planul relevant și afișare permisă doar cât abonamentul este activ | Istoric Amazon/BSR autorizat în condițiile confirmate | Peste plafonul actual; colectarea rămâne oprită. |

Nu am identificat un feed de **$0–10/lună** care să ofere simultan 625 produse Amazon recente, vânzări fiabile și drepturi de redistribuire publică. Un abonament personal la un instrument de cercetare nu transferă aceste drepturi.

## Decizia propusă: două piste, fără promisiuni false

**Pista 1 — MPR Free Research, lansabilă gradual.** Arătăm 25 de nișe cu numărul *real* de concepte revizuite în fiecare (0–25). Fiecare fișă are produsul/configurația, dovezi datate, RO comparable, interes și limitele sale. Nu are poziție Amazon și nu este numită „bestseller” dacă nu provine dintr-un clasament autorizat. Datele de furnizor și cost pot rămâne necunoscute la stadiul „în cercetare”; niciun produs nu devine FINALIST/TEST_READY fără probele comerciale. Această pistă folosește surse proprii sau permise și o revizie editorială reproductibilă.

**Pista 2 — Topuri de sursă autorizate.** Prioritatea este eBay Buy Marketing, deoarece oferă `BEST_SELLING` pe categorie în documentația oficială. Facem maparea celor 25 de nișe la categorii eBay și testăm răspunsul în sandbox, apoi solicităm producție și condițiile exacte de afișare. Orice rezultat eBay va fi etichetat „eBay US/DE, categorie, dată”; nu devine top Amazon sau top al întregii piețe. Amazon/Keepa rămân în așteptarea accesului și bugetului compatibil. O categorie care returnează mai puțin de 25 produse eligibile rămâne incompletă.

## Plan de 30 de zile, cu puncte de control

1. **Zilele 1–5:** înghețăm lista celor 25 de nișe și câte 5–10 termeni preciși per nișă; definim ce este „produs generic” și cum deduplicăm seturi, variații, comercianți și mărci. Alegem o singură nișă de probă, `BIROU_ORGANIZARE`. Livrabil: registru de mapare și 50 de *leaduri*, fără aprobare automată.
2. **Zilele 6–10:** testăm eBay Buy Marketing în sandbox cu cheile existente, folosind numai datele de test; pregătim cererea EPN și machetele fluxului cerute de eBay. Separat, înregistrăm exporturi Google Trends atribuite și comparabile RO verificate punctual. Livrabil: raport de acoperire pe categorie, cu numărul de produse unice și raportul de respingeri.
3. **Zilele 11–20:** revizuim până la 25 de concepte din nișa pilot. Fiecare rezultat primește `APPROVED_RESEARCH` numai după identitate, brand, drepturi și surse curente; interesul de produs și comparabilul RO rămân condiții pentru a fi numărat în beta. Livrabil: 10–25 fișe *dacă* probele există, altfel numărul real și motivele de respingere.
4. **Zilele 21–30:** verificăm două workspace-uri, login/onboarding/watchlist, telefon fizic, recuperarea accesului, suportul și cinci sesiuni reale. Decizie explicită: beta Free restrânsă sau NO-GO. Nu publicăm și nu activăm plăți automat.

Acestea sunt termene de execuție și criterii de oprire, nu o garanție că furnizorii sau eBay vor aproba accesul. Dacă nu obținem drepturi pentru topuri, putem lansa doar pista editorială cu acoperirea ei reală, după probele beta și decizia umană. Promisiunea completă 25 × 25 rămâne separată.

## Starea măsurată a proiectului la cercetare

`npm run editorial:report`: **25 nișe configurate, 10 candidați, 10 DRAFT, 0 aprobați public**. `npm run editorial:beta-gate`: **0 fișe revizuite eligibile, NO_GO**. PR #596 este draft. Pilotul local [Open Products Facts](FREE_OPEN_DATA_PILOT.md) a procesat 46.233 de înregistrări și a găsit zero candidați eligibili pentru `BIROU_ORGANIZARE`; deci nu este o scurtătură pentru catalog.
