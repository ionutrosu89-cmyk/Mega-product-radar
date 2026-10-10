# Fluxul Free pentru semnale gratuite

Stare la 27 septembrie 2026: 25 de nișe configurate și **o observație Google Trends aprobată** pentru `BIROU_ORGANIZARE` în `data/free-signal-observations-v1.json`. Celelalte 24 de nișe nu au încă observații aprobate. Panoul din `top25.html` oferă acces la Google Trends, TikTok Creative Center și Meta Ad Library pentru fiecare nișă. Semnalul nu publică automat produse și nu alimentează clasamentul Top 25.

## Ce colectăm

- Google Trends: interes relativ pentru o expresie și o geografie explicită. Fereastra de prospețime a observației editoriale este de 35 de zile. Nu îl numim volum absolut sau vânzări.
- TikTok Creative Center: prezența unui produs sau concept în materiale publicitare ori tendințe. Fereastra editorială este de 7 zile. Nu deducem comenzi, venit sau bestseller.
- Meta Ad Library: existența unei reclame active pentru un concept, cu piața și data reviziei. Fereastra editorială este de 7 zile. Facebook și Instagram sunt aceeași sursă Meta, nu două confirmări independente.

Accesul la paginile gratuite nu acordă drept de import automat, copiere de fotografii, descrieri sau redistribuire a catalogului. Verificarea umană produce numai un rezumat original, URL-ul sursei și momentul observației. Pentru Google Trends respectăm atribuirea și condițiile Google; pentru TikTok și Meta tratăm materialul ca indiciu editorial, nu ca feed licențiat pentru SaaS. Un API sau o licență nouă necesită revizie separată.

## Cum intră o observație

Adăugăm în `data/free-signal-observations-v1.json` un rând cu `nicheId`, `sourceKey`, `claim`, `sourceUrl`, `observedAt` ISO, `summary` original, `reviewer`, `publicStatus: "APPROVED_ORIGINAL_SUMMARY"` și opțional `concept`. Cheile permise sunt `GOOGLE_TRENDS` cu `SEARCH_INTEREST`, respectiv `TIKTOK_CREATIVE_CENTER` și `META_AD_LIBRARY` cu `AD_ACTIVITY`. URL-ul trebuie să fie HTTPS pe domeniul oficial. Rezumatul are maximum 240 de caractere și nu poate pretinde vânzări confirmate.

Build-ul validează toate observațiile, respinge rândurile vechi/neaprobate și publică doar câmpurile normalizate. Pentru Google Trends, cere `geo=RO`, aceeași expresie în URL și în `concept`, plus începutul și sfârșitul perioadei; ultimul interval nu poate fi mai vechi de 35 de zile față de observație. Dacă aceeași sursă este revizuită din nou, rămâne revizia cea mai recentă. Browserul citește feedul public, îi reverifică prospețimea și retrage semnalul la expirare. Păstrăm observațiile în fișierul sursă numai după revizie; nu punem în el date private, chei, capturi sau material terț. Fiecare nișă arată acoperirea reală. Chiar dacă are semnale gratuite, un Top 25 necesită în continuare 25 produse distincte aprobate și drept de afișare pentru clasamentul respectiv.

## Cost și extindere

Fluxul actual nu face apeluri plătite și nu cere card. Cererea pentru Google Trends API alpha și TikTok Commercial Content API poate fi pregătită separat; aprobarea și drepturile de afișare nu sunt presupuse. Meta Content Library pentru cercetători nu este utilizată ca sursă comercială. O ofertă plătită de maximum 10 USD se evaluează doar după ce furnizorul confirmă costul total și licența pentru afișare publică.

## Primul control editorial: `BIROU_ORGANIZARE`

La 27 septembrie 2026 am descărcat din [Google Trends pentru „organizator birou”, România, ultimele 12 luni](https://trends.google.com/trends/explore?date=today%2012-m&geo=RO&q=organizator%20birou&hl=ro) un CSV oficial cu 54 de intervale săptămânale (21 septembrie 2025–27 septembrie 2026). După verificarea exportului și a sursei, am aprobat un **rezumat original, atribuit**, pentru panoul Free. Valori peste zero apar în **12 din 54 de săptămâni**, iar ultimul indice este 43, în scara relativă 0–100 a acestui export; săptămâna finală poate fi incompletă. Zero nu dovedește absența căutărilor. Semnalul privește expresia generală, nu unul dintre produsele pilot, și nu confirmă volum absolut, comenzi sau vânzări. Controlul anterior pe 30 de zile rămâne o explorare separată, nepublicată.

Un al doilea export pentru expresia [„suport documente birou”, România](https://trends.google.com/trends/explore?date=today%2012-m&geo=RO&q=suport%20documente%20birou&hl=ro) are valori peste zero în **1 din 54 de săptămâni**. Îl păstrăm `PENDING_REVIEW` în `artifacts/trends-imports/`; nu îl publicăm și nu îl folosim drept confirmare a cererii BO-06. Importatorul include acum numărul intervalelor cu indice peste zero în rezumat, pentru a arăta cât de rar apare semnalul chiar când maximul este 100.
