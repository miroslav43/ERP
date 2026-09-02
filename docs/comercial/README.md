# Prezentare comercială (sales deck)

`prezentare-comerciala.tex` → `prezentare-comerciala.pdf`, 35 de pagini, 16:9.

## Structura

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

## Ce se completează înainte de trimitere către un client

| Unde                | Ce                                                          |
| ------------------- | ----------------------------------------------------------- |
| Ultima pagină       | e-mailul și adresa de web (restul datelor firmei sunt puse) |
| Preambul, §1        | paleta de brand, dacă firma are alte culori                 |
| Paginile de prețuri | modulele și pachetele, dacă oferta se schimbă               |

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

## Trei capcane care au costat timp — nu le reintroduce

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

## Verificare

Livrarea curentă compilează cu **0 erori, 0 `Overfull`, 0 `Underfull`, 0 glife
lipsă**. La orice modificare de text, recompilează și verifică:

```bash
tectonic -X compile prezentare-comerciala.tex --keep-logs
grep -E "Overfull|Underfull|Missing character" prezentare-comerciala.log
```

Un `Overfull \vbox` înseamnă că textul iese peste subsol — se taie conținut, nu
se ignoră avertismentul.
