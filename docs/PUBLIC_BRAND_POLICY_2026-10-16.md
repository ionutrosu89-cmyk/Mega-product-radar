# Catalog public fără branduri consacrate

Cerința proprietarului: produsele cu brand consacrat nu apar în catalogul Mega Product Radar. Regula se aplică tuturor listelor publice Top25, inclusiv listelor unei platforme și consensului dintre platforme.

## Regula de selecție

- ESTABLISHED_EXCLUDE / STOP_BRAND_GATE: exclus, chiar dacă alt câmp îl declară generic sau are o revizie pozitivă. Se verifică brandul, numele și titlul; o listă limitată de branduri nu este o dovadă suficientă pentru aprobarea celorlalte.
- UNKNOWN_REVIEW / BRAND_REVIEW_REQUIRED: numai în coada privată de cercetare; nu apare public și nu poate completa acoperirea unei liste.
- GENERIC_PRIVATE_LABEL: eligibil din perspectiva brandului numai cu revizor identificat, dovadă HTTPS și revizie datată în ultimele 30 de zile. O etichetă primită de la furnizor fără aceste dovezi nu este suficientă. Rămân obligatorii drepturile sursei, prospețimea, relevanța nișei și identitatea produsului.

O marcă mică sau necunoscută nu este automat generică și nu dovedește disponibilitatea produsului pentru private label. Revizia trebuie să documenteze pagina produsului/producătorului, marca și însemnele de pe produs/ambalaj și motivele clasificării. Dacă dovezile nu permit o decizie, produsul rămâne UNKNOWN_REVIEW. Nu se ascunde numele unui brand consacrat pentru a prezenta același produs ca generic.

## Comportamentul aplicației

API-ul public respinge întregul snapshot care nu mai are toate cele 25 de poziții eligibile; nu îl reumple cu alte rezultate și nu redenumește rangurile originale. Un snapshot stocat anterior fără reviziile necesare nu mai este publicabil. Colectorii/cozile private pot păstra candidați necunoscuți pentru verificare, fără a-i considera aprobați sau a-i raporta ca branduri consacrate.

Interfața Top25 filtrează suplimentar produsele înainte de afișarea cardurilor și folosește doar produsele eligibile la comparație. Produsele excluse nu mai apar doar cu acțiunile comerciale dezactivate. Revizia brandului este păstrată în răspunsul normalizat și în consens.

## Lotul DataForSEO din 16 octombrie 2026

Cele 41 de ASIN-uri din coada locală privată sunt candidați cu brand nerevizuit, nu 41 de produse aprobate fără brand consacrat. Rezultatele brute au fost filtrate de reclame și de potrivirile din lista actuală de branduri, dar aceasta nu înlocuiește revizia. Nu se publică titlurile sau exporturile private prin acest document și nu se execută cereri API noi.

## Verificare

Teste controlate pentru blocarea brandurilor consacrate/necunoscute, etichete contradictorii, revizii lipsă/expirate/viitoare și lipsa produselor respinse din JSON-ul API. Testele sunt dovezi de cod, nu aprobări reale de brand, licențiere sau lansare.

Publicarea, colectarea plătită recurentă și checkout-ul Live rămân blocate. Lista umană de branduri consacrate necesită întreținere; clasificarea tuturor brandurilor nu poate fi garantată doar prin potrivirea numelor.
