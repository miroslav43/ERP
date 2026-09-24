# Materiale comerciale (LaTeX)

Trei documente, aceeași temă:

| Sursă                       | PDF                         | Ce e                                                                                        |
| --------------------------- | --------------------------- | ------------------------------------------------------------------------------------------- |
| `prezentare-comerciala.tex` | `prezentare-comerciala.pdf` | prezentarea de vânzare, 36 de pagini, 16:9 — module, abonament, prețuri                     |
| `prezentare-module.tex`     | `prezentare-module.pdf`     | catalogul de module, 24 de pagini, 16:9 — câte un slide per modul, cu captura din aplicație |
| `one-pager.tex`             | `one-pager.pdf`             | ce facem și ce module avem, **o singură pagină** A4 portret                                 |

Tema e comună, în `tema/`:

- `tema/baza.tex` — pachetele, paleta de brand, fonturile. Toate trei o încarcă.
  **Ordinea contează:** pachetele se încarcă înaintea fonturilor, fiindcă
  `booktabs` își fixează distanțele din fontul curent (vezi capcana 4).
- `tema/beamer.tex` — șabloanele Beamer și componentele (`\modul`,
  `\modulcaptura`, `card`, `cardm`, `\celula`, `\cifra` ...). Doar cele două
  prezentări.

## De unde vine textul

Deck-ul comercial a fost scris pe 31 aug 2026. Catalogul de module și
one-pager-ul (24 sept) sunt scrise din fișele de modul ale site-ului,
[`src/content/landing/fise-module.ts`](../../src/content/landing/fise-module.ts),
**verificate în cod**. Unde fișa și codul se contrazic, câștigă codul. Două
exemple: fișa de salarizare spunea că nu se generează ordin de plată, dar
`src/domain/payroll/bancar/sepa.ts` există. Fișa de mentenanță spunea că nu se
ține costul, dar intervenția are `cost_piese` și `cost_manopera`.

### Ce s-a scos față de deck-ul comercial — și încă stă acolo

Afirmațiile de mai jos din `prezentare-comerciala.tex` **nu au acoperire în
cod**. Din catalog și din one-pager au fost scoase; în deck-ul comercial au
rămas, până la o rescriere a lui:

| Slide (deck comercial) | Afirmația                                            | Ce spune codul                                                                                           |
| ---------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Pontaj                 | „Geolocalizare la venire și la plecare”              | niciun `geolocation`/`getCurrentPosition` în `src/`; fișa: „nu urmărește poziția telefonului”            |
| Pontaj                 | „Cartelă de acces, citită la poartă”                 | niciun cititor de cartelă; fișa: „nu citește pontaje de la cititoare de cartelă”                         |
| Anunțuri               | „către un departament sau un punct de lucru”         | `0028_announcements.sql`: `announcement_targets` n-a fost construit — anunțul merge mereu la toată firma |
| Anunțuri               | „Atașamente: regulament, procedură, decizie”         | `0028_announcements.sql`: `announcement_attachments` n-a fost construit                                  |
| REGES-Online           | „Transmiterea se reia singură până primește răspuns” | fișa: mesajele stau în coadă până le trimite cineva cu drept de transmitere                              |
| KPI-uri                | pastila „în dezvoltare”                              | modulul e livrat: `0119_kpi_lunar.sql`, `src/app/(app)/evaluari/kpi/`                                    |

## Capturile

`capturi/*.jpg` vin din capturile site-ului, `public/capturi/*.webp`, făcute pe
firma de demonstrație. XeLaTeX nu citește WebP, deci se convertesc:

```bash
python3 docs/comercial/capturi/converteste.py   # din rădăcina repo-ului
```

Numele fișierului e cheia de modul din `src/config/features.ts`
(`attendance.jpg`, `per_diem.jpg`). REGES-Online și Asistentul AI n-au captură.
Slide-ul lor folosește `\modul`, nu `\modulcaptura`. Când apare o captură nouă
în `public/capturi/`, se rulează scriptul și slide-ul trece pe `\modulcaptura`.

## Structura prezentării comerciale

1. **Copertă**
2. **Două slide-uri generale** — „Ce este Administrativo” (ce e, pentru cine,
   pe ce lege stă) și „Harta modulelor” (toate modulele pe o pagină, în exact
   grupele din meniul aplicației).
3. **Douăzeci de slide-uri de modul**, unul câte unul, în ordinea din hartă.
4. **Secțiunea comercială** — de ce abonament și nu licență, harta de parcurs,
   pachete și prețuri, cum se începe.

Ordinea modulelor și denumirile lor sunt luate din
[`src/config/features.ts`](../../src/config/features.ts) și
[`src/config/navigation.ts`](../../src/config/navigation.ts). **Când apare un
modul nou acolo, apare și aici** — altfel prezentarea începe să vândă mai puțin
decât există.

## Compilare

Documentul cere **XeLaTeX sau LuaLaTeX** (folosește `fontspec`). Cu `pdflatex`
nu compilează.

```bash
tectonic -X compile prezentare-comerciala.tex   # descarcă singur pachetele
tectonic -X compile prezentare-module.tex
tectonic -X compile one-pager.tex
xelatex prezentare-comerciala.tex               # de două ori, pentru TikZ overlay
```

Fonturile TeX Gyre (Heros pentru text, Adventor pentru titluri) sunt încărcate pe
**nume de fișier**, nu pe nume de familie — așa merg identic pe TeX Live, MiKTeX
și tectonic, care nu vede fontconfig-ul sistemului. Acoperă ș/ț cu virgulă
dedesubt (U+0219/U+021B).

## Cum se adaugă un modul

Un slide de modul **nu se scrie de mână** și nu se copiază de la vecin: se
apelează macro-ul `\modul`, definit în preambul, cu cinci argumente —

```latex
\modul{Titlul slide-ului}{grupul din meniu}{%
  Paragraful de deschidere, două-trei rânduri.}{%
  \pct{iconiță}{funcționalitate}\par\vspace{2pt}
  ...}{%
  \pctv{check}{\textbf{beneficiu}, formulat ca rezultat}\par\vspace{4pt}
  ...}
```

Cinci funcționalități și patru beneficii încap. Șase funcționalități încap doar
dacă rândurile stau pe o singură linie fiecare — recompilează și verifică.

În catalogul de module, un modul cu captură folosește `\modulcaptura`: același
început, dar al cincilea argument are **exact trei** beneficii, ca `\benef{...}`
fără `\par` între ele (stau pe un rând, în banda de jos), iar al șaselea e
captura:

```latex
\modulcaptura{Titlul slide-ului}{grupul}{%
  Paragraful de deschidere, cel mult trei rânduri (~135 de caractere).}{%
  \pct{iconiță}{funcționalitate, pe un rând (~45 de caractere)}\par\vspace{2pt}
  ...}{%
  \benef{\textbf{beneficiu} scurt}
  \benef{...}
  \benef{...}}{%
  \captura{cheia-modulului}}
```

Limitele de mai sus nu sunt de stil: cu un intro de patru rânduri și șase
funcționalități, banda de beneficii iese peste subsol.

## Ce se completează înainte de trimitere către un client

| Unde                | Ce                                                                               |
| ------------------- | -------------------------------------------------------------------------------- |
| Ultima pagină       | e-mailul și adresa de web în deck-ul comercial (catalogul și one-pager-ul le au) |
| Preambul, §1        | paleta de brand, dacă firma are alte culori                                      |
| Paginile de prețuri | modulele și pachetele, dacă oferta se schimbă                                    |

## Sigla

`sigla/` conține sigla-cuvânt, în trei formate:

| Fișier                                 | Pentru ce                               |
| -------------------------------------- | --------------------------------------- |
| `sigla-administrativo.pdf`             | vectorial — tipar, alte documente LaTeX |
| `sigla-administrativo-transparent.png` | 2400 px lățime, fundal transparent      |
| `sigla-administrativo-alb.png`         | 2400 px lățime, fundal alb              |

Sigla NU e o imagine în prezentare: pe copertă e scrisă ca text, cu același font
ca subsolul (TeX Gyre Adventor, regular, fără bold). Așa rămâne vectorială, se
scalează fără pierdere și nu depinde de un fișier care poate lipsi. Fișierele din
`sigla/` sunt pentru materialele DIN AFARA prezentării.

Regenerarea PNG-urilor, după orice modificare a `sigla-administrativo.tex`:

```bash
cd sigla && tectonic -X compile sigla-administrativo.tex
```

apoi exportă PDF-ul la 2400 px lățime, o dată cu fundal transparent și o dată pe
alb (orice unealtă de conversie merge; culoarea literei e `#475569`).

## Capcane care au costat timp — nu le reintroduce

1. **Un `{...}` imediat după titlul cadrului este înghițit de beamer ca
   SUBTITLU**, iar șablonul de `frametitle` nu-l afișează: paragraful dispare
   fără nicio eroare. De aceea cadrele al căror corp începe cu un grup au un
   `\vspace{0pt}` înaintea lui. Nu-l șterge.
2. **`\vspace` în mod orizontal nu rupe paragraful.** De aceea `\pct` / `\pctv`
   își deschid și își închid singure paragraful (`\par` la ambele capete);
   altfel primul rând de listă se lipea de textul introductiv.
3. **Mărimea fontului trebuie deschisă ÎNAINTE de paragraf, nu doar pe text.**
   TeX fixează `\baselineskip` la `\par`, din mărimea curentă în acel moment:
   `{\tiny textul}\par` dă litere mici pe rânduri de 11pt. `\celula` deschide
   `\tiny` înaintea paragrafului și îl închide DUPĂ `\par` — cu varianta greșită,
   harta modulelor depășea pagina cu 3 cm.
4. **`booktabs` se încarcă ÎNAINTEA fonturilor.** `\aboverulesep = 0,4ex` se
   calculează la încărcare, din fontul curent. Încărcat după TeX Gyre Heros,
   liniile tabelelor coborau 0,35 pt. De aceea `tema/baza.tex` are pachetele sus
   și fonturile jos.
5. **Un `tcolorbox` la începutul unui `minipage[t]` aliniază coloanele pe
   JOS.** Baza unei cutii e marginea ei de jos, iar `[t]` aliniază pe primul
   rând de bază. Pe one-pager, coloana cu cutia mai scurtă cobora. Leacul e un
   `\vspace{0pt}` ca prim element al fiecărui `minipage`.
6. **`opacity` nu merge din fundalul paginii (`eso-pic`).** Cu xdvipdfmx,
   resursele de transparență nu mai ajung pe pagină: PDF-ul iese cu „cannot
   find ExtGState resource”, iar vizualizatoarele stricte îl randează greșit.
   Pe fond bleumarin se folosesc culori amestecate (`brandBlue!22!brandNavy`).
7. **`minipage` reface alinierea justificată.** `\RaggedRight` din
   `\AtBeginDocument` nu trece de `\@parboxrestore`, deci textul din coloane
   înguste ieșea justificat, cu `Underfull \hbox`. `\benef` repune
   `\RaggedRight` înăuntru.

## Verificare

Livrarea curentă compilează cu **0 erori, 0 `Overfull`, 0 `Underfull`, 0 glife
lipsă**, pe toate trei. La orice modificare de text, recompilează și verifică:

```bash
for f in prezentare-comerciala prezentare-module one-pager; do
  tectonic -X compile $f.tex --keep-logs
done
grep -E "Overfull|Underfull|Missing character" *.log   # trebuie să nu afișeze nimic
```

One-pager-ul trebuie să rămână **o pagină**: un rând în plus trimite banda de
jos pe pagina a doua fără niciun avertisment. Se verifică numărul de pagini, nu
doar jurnalul.

Un `Overfull \vbox` înseamnă că textul iese peste subsol — se taie conținut, nu
se ignoră avertismentul.
