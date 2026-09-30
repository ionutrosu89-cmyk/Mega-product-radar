# Mega Product Radar — primul lot de testare Free

Protocol pentru minimum cinci utilizatori reali din România. Formularul este `beta-study.html` din deploy-ul testat. Acest document nu autorizează publicarea produselor, accesul public la preview sau plățile.

## Înainte de invitații

1. Verifică faptul că fiecare participant poate deschide preview-ul fără să i se acorde acces la administrarea Netlify. Preview-ul este în prezent marcat `Private`; nu îl prezenta ca lansare publică.
2. Folosește câte un cont și workspace propriu pentru fiecare participant. Nu cere parole și nu reutiliza conturile de test interne ca participanți reali.
3. Notează data, commitul, dispozitivul, browserul și eventualele erori. Înregistrează identitatea participantului numai în fluxul intern autorizat, fără a o publica în raport.
4. Confirmă acoperirea Top25. Când sunt zero produse live, testează doar onboardingul, navigarea și înțelegerea stării fără date. Nu număra aceste sesiuni drept fluxuri complete cu produs.

## Invitație propusă

„Testăm versiunea gratuită Mega Product Radar cu un grup mic de selleri din România. Testul durează aproximativ 20 de minute și nu implică plată. Vrem să vedem dacă interfața și explicațiile dovezilor sunt clare, inclusiv când încă nu avem produse live pentru o nișă. Unele funcții și liste sunt în pregătire. Dacă vrei să participi, îți trimitem linkul și pașii de test.”

Trimiterea invitațiilor și obținerea acordului participanților sunt acțiuni ale coordonatorului beta; nu inventa sesiuni sau răspunsuri.

## Traseul moderat

1. Participantul se autentifică și parcurge onboardingul. Observă dacă profilul rămâne după reîncărcare.
2. Deschide Top25 Free, alege o nișă și descrie ce înțelege din sursă, dată, prospețime, estimare și lipsa datelor.
3. Dacă există produse live cu drepturi confirmate, deschide unul, explică dovezile și salvează-l în shortlist; reîncarcă pagina și verifică persistența pe același dispozitiv. Dacă nu există, marchează `Nu există produse live de salvat` în formular.
4. Participantul completează `beta-study.html` singur. Moderatorul nu sugerează răspunsul „Da”. Problemele critice se înregistrează separat.
5. Repetă traseul pe un telefon fizic și notează modelul, sistemul, browserul și rezultatul. Testul în emulare nu înlocuiește telefonul.

## Decizia pe dovezi

- Minimum cinci participanți reali și cinci sesiuni cu produs efectiv testat sunt necesare pentru pragul de studiu. Sesiunile fără produs rămân utile pentru UX, dar nu satisfac acest prag.
- Cel puțin 80% trebuie să înțeleagă diferența dintre dovada confirmată și estimare, 60% să găsească recomandarea utilă, iar 80% să confirme păstrarea produsului în shortlist după reîncărcare.
- Zero probleme critice deschise și minimum un flux de produs confirmat independent. O bifă din formular, singură, nu este confirmare independentă.
- Dacă lipsesc produse live sau drepturi de afișare, verdictul rămâne `CONTINUE_FREE_BETA`. Depășirea pragurilor trimite proiectul la revizuire umană; nu activează automat extinderea sau plățile.

Datele, sursele și blocajele curente sunt în `docs/free-go-live-evidence-2026-09-24.md`.
