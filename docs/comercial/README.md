# Prezentare comercială (sales deck)

`prezentare-comerciala.tex` → `prezentare-comerciala.pdf`, 26 de pagini, 16:9.

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

## Ce se completează înainte de trimitere către un client

| Unde                  | Ce                                                        |
| --------------------- | --------------------------------------------------------- |
| Pagina 1 și 26        | `\logoPlaceholder` → `\includegraphics{sigla.pdf}`        |
| Pagina 13             | slide-ul „MODUL SUPLIMENTAR EXISTENT — DE COMPLETAT”      |
| Pagina 26             | telefonul, e-mailul și adresa de web, azi între paranteze |
| Preambul, secțiunea 1 | paleta de brand, dacă firma are alte culori               |

Pentru fiecare modul existent în plus, se duplică un slide de modul și se
completează după același tipar: pastile de status, descriere scurtă, cinci
funcționalități, patru beneficii.

## Două capcane care au costat timp — nu le reintroduce

1. **Un `{...}` imediat după titlul cadrului este înghițit de beamer ca
   SUBTITLU**, iar șablonul de `frametitle` nu-l afișează: paragraful dispare
   fără nicio eroare. De aceea cadrele al căror corp începe cu un grup au un
   `\vspace{0pt}` înaintea lui. Nu-l șterge.
2. **`\vspace` în mod orizontal nu rupe paragraful.** De aceea `\pct` / `\pctv`
   își deschid și își închid singure paragraful (`\par` la ambele capete);
   altfel primul rând de listă se lipea de textul introductiv.

## Verificare

Livrarea curentă compilează cu **0 erori, 0 `Overfull`, 0 `Underfull`, 0 glife
lipsă**. La orice modificare de text, recompilează și verifică:

```bash
tectonic -X compile prezentare-comerciala.tex --keep-logs
grep -E "Overfull|Underfull|Missing character" prezentare-comerciala.log
```

Un `Overfull \vbox` înseamnă că textul iese peste subsol — se taie conținut, nu
se ignoră avertismentul.
