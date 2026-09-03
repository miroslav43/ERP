---
tip: meta
titlu: Ce verifică poarta vault-ului
cai:
  - "scripts/docs/lint-vault.mjs"
  - ".github/workflows/vault.yml"
tabele: []
permisiuni: []
capcane: []
scris_pe: MANUAL
scris_la: 2026-09-03
tags: [meta]
---

# Ce verifică poarta vault-ului

`node scripts/docs/lint-vault.mjs`. Ieșire 1 dacă există erori, 0 altfel. Nu rescrie
niciodată nimic.

Principiul: **verifică EXISTENȚĂ, niciodată CANTITATE.** O cale care nu se rezolvă e o
eroare; „modulul are 15 acțiuni" nu se verifică — se interzice, fiindcă e o afirmație care
putrezește garantat. Motivul e scris în `src/config/docs.test.ts`: prima versiune a
testului de documentație compara numărul de migrări din `CLAUDE.md` cu discul și pica
pentru munca CORECTĂ, taxând pe cine adăuga migrarea pentru o linie scrisă de altcineva.

Domeniul e **declarat**, nu dedus: doar `.claude/docs/`. O parcurgere „orice `.md` cu
frontmatter" ar înghiți fișierele plugin-ului, iar prima rulare pe un vault gol ar da
zeci de erori false — adică prima impresie ar fi „poarta e stricată".

## Clasele

| Clasă | Ce verifică                                                                                                                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FM`  | frontmatter: câmpurile obligatorii, `scris_pe` = SHA de 40 sau `MANUAL`, `citeste_daca` ≤ 3, `cai:` nevid, absența lui `stare:` și `migrari:`                                                   |
| `R`   | plafoanele de dimensiune, măsurate pe corp                                                                                                                                                      |
| `S`   | octet NUL literal în fișier                                                                                                                                                                     |
| `N`   | diacritic cu sedilă (U+015F, U+0163) în loc de virgulă dedesubt (`ș`, `ț` — U+0219/U+021B). Pagina asta nu poate da exemplul: clasa `N` e singura care NU respectă scutirile din `neverificat:` |
| `P`   | repo public: secrete, chei, parole, corp de politică RLS, formulări care descriu un gol de autorizare                                                                                           |
| `A`   | căile de repo citate în backticks sau în blocuri de cod se rezolvă pe disc                                                                                                                      |
| `B`   | migrarea citată există în `supabase/migrations/`                                                                                                                                                |
| `J`   | ruta citată se rezolvă la un `page.tsx` sau `route.ts`                                                                                                                                          |
| `G`   | `capcana #N` există în `docs/design/ecrane/capcane.md`, iar `capcane:` din frontmatter la fel                                                                                                   |
| `H`   | wikilink-urile duc undeva; capcanele NU se scriu ca wikilink; nicio pagină nu se leagă de ea însăși                                                                                             |

Clasa `R` e singura care produce și avertismente: peste **țintă** avertizează, peste
**plafonul dur** e eroare și pagina se sparge.

| Tip                      | Țintă | Plafon dur |
| ------------------------ | ----- | ---------- |
| `modul`, `date`, `strat` | 8192  | 12288      |
| `rol`                    | 4096  | 6144       |
| `decizie`                | 2048  | 3072       |
| `meta`                   | 6144  | 12288      |

## Scutiri

`neverificat:` din frontmatter, cu forma `"token — motiv de cel puțin 20 de caractere"`.
Motivul obligatoriu e ce le ține oneste: o scutire fără justificare **nu se aplică**, iar
toate sunt vizibile în frontmatter, la revizuire.

Mecanismul există fiindcă paginile care DESCRIU regulile — `_index`, `meta/conventii` —
pică altfel pe propriile exemple negative. Un lint cu fals-pozitive e dezactivat în trei
zile.

`meta/log.md` e tratat separat: e jurnal append-only scris de CI, nu pagină. I se verifică
doar ce contează acolo — fără octeți NUL, fără sedile, fără secrete.

## De ce e un workflow separat

`.github/workflows/vault.yml` se declanșează **numai** când se schimbă vault-ul.
Deliberat: dacă lintul de documentație ar rula în jobul `quality` din `ci.yml`, un commit
legitim de cod care șterge un fișier citat într-o pagină ar înroși `main` pentru toate
sesiunile paralele — pentru o linie scrisă de un bot.

**Nicio afirmație din vault nu are voie să oprească un commit de cod.**

Workflow-ul face checkout cu `fetch-depth: 0`, fiindcă clasele care ating git-ul eșuează
tăcut într-o clonă trunchiată, și rulează în plus `scripts/docs/verifica-workflow.mjs`.

## Uneltele vecine

| Comandă                                                                 | Ce răspunde                          |
| ----------------------------------------------------------------------- | ------------------------------------ |
| `node scripts/docs/acoperire.mjs`                                       | ce module de rută n-au pagină        |
| `node .claude/skills/administrativo/scripts/cauta-vault.mjs --tabela X` | ce pagină deține o tabelă            |
| `node .claude/skills/administrativo/scripts/capcana.mjs --nr 17`        | textul integral al unei capcane      |
| `node scripts/docs/triaj.mjs`                                           | ce merită rescris, calculat fără LLM |
