---
tip: meta
titlu: Convențiile vault-ului
cai:
  - "scripts/docs/**"
  - ".claude/docs/**"
tabele: []
permisiuni: []
capcane: []
neverificat:
  - "[[concedii]] — exemplu negativ: pagina asta DEFINEȘTE regula wikilink-urilor scurte"
  - "[[modul/concedii]] — exemplu de formă corectă, pagina modulului vine în lotul 1"
  - "[[capcana 12]] — exemplu negativ: pagina asta DEFINEȘTE de ce capcanele nu-s wikilink"
  - "lipsește politica X — text care ENUMERĂ formulările interzise de clasa P"
scris_pe: MANUAL
scris_la: 2026-08-28
tags: [meta]
---

# Convențiile vault-ului

## Tipuri de pagină și plafoane

| Tip     | Cale                                                      | Țintă | Plafon dur              |
| ------- | --------------------------------------------------------- | ----- | ----------------------- |
| modul   | `modul/<slug>.md`, slug = directorul din `src/app/(app)/` | 8 KB  | 12 KB                   |
| date    | `date/<familie>.md`                                       | 8 KB  | 12 KB                   |
| strat   | `strat/<strat>.md`                                        | 8 KB  | 12 KB                   |
| rol     | `rol/<rol>.md`                                            | 4 KB  | 6 KB                    |
| decizie | `decizie/NNNN-<slug>.md`                                  | 2 KB  | 3 KB                    |
| meta    | `meta/*.md`, `_index.md`                                  | —     | 3 KB pentru `_index.md` |

Plafoanele se măsoară pe **corp**, fără frontmatter. Depășirea nu e o avertizare, e o
condiție de spargere: un modul se sparge pe subarborele de rute
(`modul/<slug>/<sub>.md`), iar dacă secțiunea „Server Actions" singură trece de 40 de
rânduri se extrage în `modul/<slug>/actiuni.md`, indiferent de rute.

## Frontmatter

Obligatoriu pe orice pagină: `tip`, `titlu`, `cai`, `tabele`, `permisiuni`, `capcane`,
`scris_pe`, `scris_la`.

`cai:` e baza prospețimii **și** a rutării din hook-uri — fără el pagina e nemuritoare
(nu devine niciodată învechită, nu intră niciodată în coadă). Pe o pagină `rol/*`,
`cai:` conține migrările care ating `role_permissions`, nu fișiere TS.

`scris_pe` e SHA **complet**, 40 de caractere — `%h` are lungime variabilă
(`core.abbrev` crește cu repo-ul), deci comparația de șiruri se strică singură. Valoarea
`MANUAL` marchează o pagină scrisă de om, exclusă din coada de sincronizare.

Nu se scriu: `stare:` (se derivă din git) și `migrari:` (se derivă din `tabele:`). Două
surse de adevăr despre același lucru înseamnă una care minte.

`citeste_daca:` are **maximum 3** intrări, fiecare cu clauza care o declanșează. O listă
de 14 wikilink-uri e o invitație la 42 KB de navigație, adică mai mult decât bugetul
sarcinii.

## Scheletul unei pagini `modul/`

`Ce e` · `Rute și cine ajunge` · `Server Actions` · `Citiri` ·
**`Ce refuză baza tăcut`** · `Erori traduse` · `Capcane aplicabile` ·
`Ce se mișcă împreună` · `Ce NU e aici` · `Când NU e suficientă pagina asta`.

Secțiunea care justifică tot vault-ul e „Ce refuză baza tăcut". Restul e navigație.

Interzis în corp: corpuri de funcții, liste de coloane, DDL copiat, JSX, istoric
narativ, și **orice cardinalitate în proză**.

## Legături

Wikilink-urile se scriu **pe cale completă**: `[[modul/concedii]]`, niciodată
`[[concedii]]`. Motivul e mecanic: `modul/` și `date/` au perechi cu același basename,
iar un link scurt poate rezolva la propria pagină și trece drept legătură validă.
`.obsidian/app.json` fixează `newLinkFormat: absolute` ca Obsidian să le scrie așa
singur.

Capcanele **nu** sunt wikilink-uri — `docs/design/ecrane/capcane.md` e o listă plată,
fără pagini per capcană, deci `[[capcana 12]]` ar fi link mort peste tot. Forma
canonică: `capcana #12` în text, plus `capcane: [12]` în frontmatter.

## Cifrele volatile

Nu se scriu. Deloc. Motivul e scris în `src/config/docs.test.ts`: prima versiune a
testului de documentație compara numărul de migrări din `CLAUDE.md` cu discul și era
greșit proiectată — pica pentru munca **corectă** și taxa pe cel care adăuga migrarea,
pentru o linie scrisă de altcineva.

Dacă o cifră globală chiar trebuie citată, se scrie cu ancoră, iar lintul o renumără la
acel commit:

```
97 de migrări (`#migrări@ae3c329`)
```

Formulările cu determinant sunt permise, fiindcă sunt locale și verificabile la citire:
„cele 6 capcane ale pontajului".

## Repo public

`miroslav43/ERP` e public. Nicio pagină nu conține parole, `project_ref`, chei anon sau
service, corpuri de politică RLS, sau formulări care indică un gol de autorizare („aici
lipsește politica X", „nimeni nu verifică Y"). Clasa P a lintului respinge vocabularul;
restul e responsabilitatea celui care scrie.

## Când se șterge o pagină

O pagină care în 30 de zile n-a fost citită niciodată înaintea unei editări în zona ei
**se șterge, nu se resincronizează**. Datele sunt în `.cache/lectura.jsonl`.
