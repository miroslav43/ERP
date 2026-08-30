---
tip: modul
titlu: Salarizare
aliases: [payroll, state de plată, fluturași]
cai:
  - "src/app/(app)/salarizare/**"
  - "src/lib/queries/payroll.ts"
  - "src/schemas/payroll.ts"
  - "src/domain/payroll/**"
tabele:
  [
    payroll_periods,
    payroll_entries,
    payroll_bonuses,
    payroll_deductions,
    payroll_garnishments,
    payroll_settings,
    payroll_prior_income,
    payroll_personal_deduction_brackets,
    salary_component_types,
  ]
permisiuni: [payroll:read, payroll:create, payroll:update, payroll:approve, payroll:export]
feature: payroll
capcane: [2, 17]
citeste_daca:
  - "perioadă care nu se recalculează → [[date/pontaj]]"
  - "sumă greșită → src/domain/payroll/, nu pagina asta"
scris_pe: 3c9747a4f30ad317e7ea4e01fe0a4e778381411e
scris_la: 2026-08-30
tags: [modul, finance]
---

# Salarizare

Perioade lunare de salarizare: se creează, se calculează din pontaj, se aprobă, se
închid. Produce fluturași PDF și gestionează popriri. **Singurul modul cuplat de valori
legale** — plafoane, deduceri personale, cote — care sunt marcate în `NOTES.md` ca
neconfirmate de contabil.

## Rute și cine ajunge

| Rută                                            | Poartă                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| `/salarizare`                                   | `payroll:read`/`create`/`update`, toate **all**                           |
| `/salarizare/[id]`                              | `payroll:read` all; butoanele cer `create`, `update`, `approve`, `export` |
| `/salarizare/[id]/[entryId]`                    | `payroll:read` all                                                        |
| `/salarizare/componente`, `/salarizare/popriri` | `payroll:create`/`update` all                                             |
| `/salarizare/istoric-venituri`                  | `payroll:create` all                                                      |
| `/salarizare/setari`                            | `payroll:update` all                                                      |

**Niciun scope sub `all`.** Modulul nu are noțiune de „echipă": cine îl vede, îl vede
întreg.

## Server Actions

`src/app/(app)/salarizare/actions.ts`, plus `popriri/`, `componente/`, `setari/`.

| Funcție                                                                                     | Permisiune / minScope                    |
| ------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `creeazaPerioada`, `calculeazaPerioada`                                                     | `payroll:create` / all                   |
| `aprobaPerioada`, `inchidePerioada`                                                         | `payroll:approve` / all                  |
| `redeschidePerioada`                                                                        | `payroll:update` / all                   |
| `adaugaPrima`, `adaugaRetinere`, `salveazaIstoricVenit`                                     | `payroll:create` / all                   |
| `stergePrima`, `stergeRetinere`                                                             | `payroll:update` / all                   |
| `trimiteFluturasii`                                                                         | `payroll:export` / all                   |
| `creeazaPoprire` / `inchidePoprire`                                                         | `payroll:create` / `payroll:update`, all |
| `creeazaSablonComponenta` / `actualizeazaSablonComponenta` / `dezactiveazaSablonComponenta` | `payroll:create` / `payroll:update`, all |
| `salveazaSetari`                                                                            | `payroll:update` / all                   |

Cele trei formulare de adăugare — `FormularSablonComponentaNou`, `FormularPoprireNoua`,
`FormularIstoricVenit` — se cer dintr-un buton și se deschid în casetă, prin
`FormularDialog` (`src/components/ui/formular-dialog.tsx`), nu desfăcute sub antet: în
spatele lor rămâne vizibilă exact lista de citit înainte de a scrie — ce cod intern e
liber, ce dosare de poprire are deja angajatul, ce luni de venit sunt introduse.
Închiderea și `router.refresh()` le face componenta, deci ecranele astea nu-și mai țin
starea `deschis` și nu-și mai memorează `laReusita`. `FormularIstoricVenit` își
dezactivează butonul când nu are niciun angajat de ales. `setari/formular-setari.tsx`
rămâne în pagină — e ecranul însuși, nu o adăugare.

## Citiri

`src/lib/queries/payroll.ts` — cel mai mare fișier de citiri din proiect:
`listeazaPerioade`, `citestePerioada`, `listeazaInregistrari`, `citesteInregistrare`,
`citesteFluturasulPropriu`, `pontajAgregatPerioada`, `zileLucratoareLuna`,
`angajatiActiviCuContract`, `scutiriActivePerioada`, `componenteSalarialeActivePerioada`,
`primeSiRetineriPerioada`, `istoricVenitPerAngajat`, `certificateMedicaleLuna`,
`compensariLuna`, `diurnaLunaPerAngajat`, `plafoaneDiurnaLuna`, `popririActive`,
`dosarePopriri`, plus setările valabile la o dată.

## Livrabilele perioadei

Panoul „Livrabile" de pe `/salarizare/[id]` apare doar când perioada e `aprobat` sau
`inchis`. Cele patru descărcări — `bancar`, `nota`, `stat`, `d112`, sub
`src/app/api/export/salarizare/` — se cer prin `ButonDescarcare`
(`src/components/incarcare/buton-descarcare.tsx`), **nu** prin `<a href>`: rutele refuză
în `text/plain`, nu în JSON (`d112/route.ts:41`, `bancar/route.ts:30`), iar printr-o
navigare refuzul înlocuia ecranul de salarizare cu pagina aia de text. Prin `fetch`,
refuzul ajunge într-o notificare și omul rămâne pe perioadă.

`d112` cere `payroll:export` all **și** `employees:read` all (`d112/route.ts:65-73`) —
declarația conține CNP-ul fiecărui asigurat, deci `payroll:export` singur nu ajunge.

Cifrele de control ale exportului nu sunt în corpul răspunsului, ci în antete:
`bancar/route.ts:164-166` trimite `x-plati-incluse`, `x-suma-control` și `x-fara-iban` —
ce NU a intrat în fișier. `ButonDescarcare` le citește și le pune în notificarea de
reușită. `d112/route.ts:276` trimite `x-atentionari` (atenționări ANAF neblocante), care
**nu** e în lista citită de buton (`buton-descarcare.tsx:33-39`) — deci numărul lor nu
apare azi nicăieri pe ecran.

## Ce refuză baza tăcut

- **Tranzițiile de perioadă se verifică prin `.select()` după `.update()`.** O tranziție
  respinsă de `USING` nu dă eroare — afectează zero rânduri. `aprobaPerioada`,
  `inchidePerioada` și `redeschidePerioada` tratează rezultatul gol drept conflict. — capcana #17
- **Agregarea din pontaj se paginează după angajat.** PostgREST trunchiază tăcut peste
  `max_rows`; `pontajAgregatPerioada` citește pe angajați, nu pe rânduri de pontaj. — capcana #2
- **Traducerea erorilor acoperă șase coduri**, mai multe decât oriunde altundeva:
  `23505`, `42P10`, `23514`, `22003`, `22012`, `P0001` (`erori.ts`). `22003` și
  `22012` sunt depășire numerică și împărțire la zero — apar din calcul, nu din
  autorizare, și un mesaj generic ar trimite investigația în direcția greșită.
- **Valorile legale nu sunt adevăr.** Plafoanele și cotele din `payroll_settings` și
  `payroll_personal_deduction_brackets` sunt marcate în `NOTES.md` ca ⚠ de confirmat de
  contabil înainte de orice calcul real.
- **Perioadele NU mai sunt complet închise pentru angajat** — de la
  `0113_luna_fluturasului_propriu.sql`. `payroll_periods_select` cerea `payroll:read = all`,
  deci `an` și `luna` îi erau refuzate tăcut, iar portalul își scria fluturașul fără lună
  (`perioada={null}` stătea literal în cod). Ramura nouă îi dă EXACT perioadele
  `aprobat`/`inchis` în care are propriul fluturaș, prin `app.are_fluturas_in_perioada`
  (definer, ca verificarea să nu treacă prin RLS-ul lui `payroll_entries` — vezi 0027).
  Poarta pozitivă e `tests/rls/proba-fluturas-luna.sql`, care cade pe verificarea (1) dacă
  cineva restrânge politica la loc.

## Ce vede angajatul din portal

`citesteFluturasulPropriu` (cel mai recent, dintr-o perioadă aprobată) plus
`perioadaInregistrarii` pentru luna lui — un al doilea drum, fiindcă `period_id` se află
abia după primul. NU se face embed PostgREST pe `payroll_periods`: un embed refuzat de RLS
întoarce `null` în loc de rând, fără eroare, adică exact bug-ul închis în 0027.

Cele două ecrane care le folosesc: `/portal/salariul-meu` (fluturașul întreg, prin
`Fluturas`) și cardul de pe ecranul de start, `portal/card-salariu.tsx` — net de plată,
luna, și un inel cu două felii (net vs. CAS+CASS+impozit, care însumează brutul). Cardul
NU e pe fundal plin: `Inel` își desenează separatoarele în `var(--color-background)`.

## Ce se mișcă împreună

Migrarea → `src/types/database.ts` → `src/schemas/payroll.ts` →
`src/lib/queries/payroll.ts` → acțiuni → pagini. **Calculul propriu-zis nu e aici**: stă
în `src/domain/payroll/`, care e cel mai mare director de domeniu din proiect și e
acoperit cu teste. O sumă greșită se repară acolo, nu în pagină.

Avertismentele calculului își scriu **orele pe ceas**: `calc.ts` trece fiecare durată
prin `formatOre` (`src/lib/format/ore.ts`) și lipește unitatea `h` — `6:00 h de noapte`,
nu `6.00 ore`. Sumele în lei rămân zecimale (`toFixed(2)`), iar coloanele de ore din bază
rămân `numeric`, fiindcă tariful orar se înmulțește cu ele; ceasul e doar reprezentarea
de citire, convertită într-un singur loc. `calc.test.ts` fixează șirurile verbatim pentru
`SAL_ORE_IN_MOD_NEDECLARAT`, deci un avertisment nou care formatează orele altfel iese
inconsecvent pe ecran, nu la teste.

## Ce NU e aici

Pontajul care alimentează calculul (`[[modul/pontaj]]`), diurna, și fișa angajatului
(`[[modul/angajati]]`). Fluturașul propriu al angajatului trăiește în portal.

## Când NU e suficientă pagina asta

- Orice întrebare despre o cifră: `src/domain/payroll/` plus `NOTES.md` §valorile legale.
- Exportul: route handlers sub `src/app/api/export/salarizare/` — pagina spune doar cum
  se cer și ce antete întorc, nu ce e în fișier.
