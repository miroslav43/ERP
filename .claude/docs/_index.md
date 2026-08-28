---
tip: meta
titlu: Vault Administrativo
cai:
  - "CLAUDE.md"
  - "src/config/**"
tabele: []
permisiuni: []
capcane: []
neverificat:
  - "cauta-vault.mjs — se livrează în etapa 2; referința e deliberat înainte de fișier"
  - "lipsește politica — text care ENUMERĂ formulările interzise de clasa P, nu le folosește"
scris_pe: MANUAL
scris_la: 2026-08-28
tags: [meta, index]
---

# Vault Administrativo

Documentația vie a proiectului. Se citește **în locul** unui sweep prin cod, nu pe
lângă el. Dacă ajungi aici după ce ai citit deja 20 de fișiere, mecanismul a eșuat.

## Cum se intră — rețete, nu cuprins

Aici nu există listă de pagini. Lista se învechește exact ca „43 de migrări"; numele
paginilor se deduc din convenție:

| Ai de-a face cu                                 | Citește                                 | Și atât |
| ----------------------------------------------- | --------------------------------------- | ------- |
| un bug într-un modul                            | `modul/<directorul din src/app/(app)/>` | da      |
| un defect de acces / buton dispărut             | `rol/<rolul>` + `modul/<X>`             | da      |
| o tranziție de stare care nu se aplică          | `date/<familia>` + `modul/<X>`          | da      |
| „cum se scrie o acțiune / o citire / o migrare" | `strat/<stratul>`                       | da      |
| de ce e ceva făcut așa                          | `decizie/`                              | da      |

**Plafon: 12 KB de vault per sarcină.** Două pagini, nu cinci. Dacă simți nevoia de a
treia, întrebarea e prost pusă — sau pagina e incompletă și asta e un defect de
raportat, nu de compensat prin citit mai mult.

Nu știi ce pagină deține o tabelă:

```bash
node .claude/skills/administrativo/scripts/cauta-vault.mjs --tabela leave_requests
```

## Ce NU e aici

- **Capcanele** rămân în `docs/design/ecrane/capcane.md`, listă numerotată plată.
  Paginile le citează ca `capcana #12`, niciodată ca wikilink. Textul integral al uneia
  se scoate cu `capcana.mjs --nr 12` — nu se deschide documentul întreg.
- **Convențiile generale** (cele opt straturi, verificarea, rolurile) rămân în
  `CLAUDE.md`. Vault-ul nu le repetă.
- **Arhiva de fază** rămâne în `docs/design/`. E intenție trecută, nu stare curentă.

## Reguli pentru cine scrie o pagină

1. **Nicio cifră volatilă.** Nu „15 acțiuni", nu „12 migrări ating tabela". Se numesc
   artefactele, nu se numără. O valoare calculată nu poate rugini; una scrisă, da.
2. **Ce există în repo se scrie în backticks** — așa poate lintul să verifice.
3. **Fiecare afirmație din „Ce refuză baza tăcut" are un artefact**: un SHA sau un
   număr de capcană. Un rând fără artefact e opinie și se taie.
4. **Repo-ul e public.** Nicio parolă, niciun `project_ref`, niciun corp de politică
   RLS, nicio formulare de tip „aici lipsește politica X".

Detaliile: `meta/conventii.md`. Ce verifică poarta: `meta/lint.md`.
