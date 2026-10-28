---
tip: modul
titlu: Concedii
aliases: [leave, CO, CM]
cai:
  - "src/app/(app)/concedii/**"
  - "src/lib/queries/leave.ts"
  - "src/schemas/leave.ts"
  - "src/domain/leave/**"
tabele:
  [
    leave_requests,
    leave_request_days,
    leave_types,
    leave_type_variants,
    leave_balances,
    leave_entitlement_rules,
    approval_tasks,
    notifications,
    employees,
  ]
permisiuni: [leave:read, leave:create, leave:update, leave:approve]
feature: leave
capcane: [11, 17, 33]
citeste_daca:
  - "cerere care rămâne în aceeași stare → [[date/pontaj]]"
  - "buton de aprobare absent → [[rol/manager]]"
  - "concediu aprobat care nu apare în foaia de prezență → [[modul/pontaj]]"
scris_pe: f437506578f23173e26c942102cdd3ddd2d109c8
scris_la: 2026-10-28
tags: [modul, hr]
---

# Concedii

Cereri de concediu cu lanț de aprobare, solduri anuale calculate din reguli de drept, și
un calendar de echipă. E **motorul generic de aprobare** al proiectului: `approval_tasks`
apare și în alte module, iar tiparul de tranziție de aici se copiază.

## Paginile modulului

Trunchiul ține ce e modulul, cine ajunge unde și **ce refuză baza fără să spună pe drumul
cererii** — secțiunea pentru care se deschide pagina dintr-un bug. Restul s-a spart pe
subpagini (`.claude/docs/meta/conventii.md`).

| Pagină                        | Ce ține                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| [[modul/concedii/actiuni]]    | cele șase scrieri ale cererii, citirile ei, ce se mișcă la o schimbare de formă                  |
| [[modul/concedii/setari]]     | tipurile reglementate legal, grilele de zile suplimentare, zilele de bază, aplicarea drepturilor |
| [[modul/concedii/documente]]  | atașamentul: calea, conținutul, cerința de document, eroarea tradusă                             |
| [[modul/concedii/vederi]]     | calendarul, planificatorul, coada de aprobări, marcajul zilelor ocupate                          |
| [[modul/concedii/suspendare]] | concediul care suspendă contractul de muncă și evenimentele REGES                                |

## Rute și cine ajunge

| Rută                                     | Poartă                                                          |
| ---------------------------------------- | --------------------------------------------------------------- |
| `/concedii`                              | `leave:read` own/team/all după scope; creare own; aprobare team |
| `/concedii/[id]`                         | `leave:read` own/team; `leave:update` own                       |
| `/concedii/aprobari`                     | `leave:approve` team                                            |
| `/concedii/echipa`, `/concedii/calendar` | `leave:read` team                                               |
| `/concedii/sold`                         | `leave:read` own/team/all; `?an=`, `?toate=1`                   |
| `/concedii/setari`                       | `leave:update` all — v. [[modul/concedii/setari]]               |

Toate trec prin `requireFeature(tenant.organizationId, "leave")`, dar **în paralel cu
`getPermissionMap`**, într-un `Promise.all` — nu înlănțuite, cum arată preambulul
canonic. Refuzul rămâne identic: o poartă căzută respinge tot `Promise.all`-ul, înainte de
orice `can()`. Tiparul e la fel pe toate paginile modulului.

**Cererea nouă NU are rută.** `/concedii/noua` a dispărut în favoarea unei casete deschise
din listă (`dialog-cerere-noua.tsx`); datele ei se citesc în `date-cerere-noua.ts`, ODATĂ
cu lista, într-un singur `Promise.all` — deci deschiderea casetei nu atinge rețeaua. În
același val intră fișa proprie și cererile care ocupă deja zile, de aceea citirea cere și
`user.id`. `/concedii?cerere=noua` o deschide direct (butonul din panou, starea goală a
listei, antetul calendarului și al echipei), iar `&pentru=<id>` precompletează angajatul —
parametru DISTINCT de filtrele listei, validat pe server contra celor pe care privitorul
chiar îi poate alege, altfel ignorat tăcut. Pagina remontează componenta prin `key` (care
include `pentru`), fiindcă o navigare pe aceeași rută ar păstra altfel starea clientului.
`soldAnual` e memoizată cu `cache()`, ca `zileNelucratoare`: lista o cere de două ori.

**Concediul se cere doar pe ZILE ÎNTREGI.** Jumătățile de zi au ieșit în
`0112_concediu_doar_zi_intreaga.sql`: coloanele `portiune_inceput`/`portiune_sfarsit` și
`leave_request_days.portiune` mai există, dar o constrângere le ține pe `zi_intreaga`,
`app.numara_zile_lucratoare` a pierdut cei doi parametri, iar `numaraZileCerere` întoarce
de acum întotdeauna un întreg. Enum-urile `leave_day_portion` și etichetele `jumatate_in_*`
din `leave_rounding_mode` rămân în bază, dar nicio coloană nu le mai poate primi.

## Server Actions și citiri

`src/app/(app)/concedii/actions.ts` și `src/lib/queries/leave.ts`, cu tot ce se
mișcă împreună când se schimbă forma returnată de o acțiune: [[modul/concedii/actiuni]].
Cele șase scrieri de configurare și citirile lor: [[modul/concedii/setari]].

## Ce refuză baza tăcut

- **Un UPDATE respins de `USING` afectează zero rânduri, fără eroare.** Cazul canonic e
  chiar aici: un angajat care încearcă `in_aprobare`→`aprobata` pe propria cerere.
  `decideCerere` și `trimiteCerere` fac `.select()` după `.update()` și tratează
  rezultatul gol drept conflict — altfel omul vede „succes" fără ca nimic să se fi
  schimbat. — capcana #17
- **`leave_requests` e excepția de la regula `set_actor`:** aici politica de INSERT cere
  `created_by = auth.uid()` și acțiunea îl trimite **explicit**. În modulele acoperite de
  `internal.set_actor`, `created_by` nu se trimite niciodată din client. Nu copia
  tiparul în ambele direcții fără să verifici. — capcana #33
- **Cursorul keyset pe text** (`full_name`, `denumire`) cere funcția `ghilimeleaza()` din
  `src/lib/queries/employees.ts`: o virgulă sau o ghilimea dintr-un nume sparge altfel
  filtrul PostgREST `or=(…)`. — capcana #11
- **O perioadă fără zile lucrătoare, sau dinaintea angajării, se refuză la TRIMITERE.**
  `refuzulPerioadei` rulează în `verificaInainteDeTrimitere`, **înaintea soldului**: zero
  zile ar fi trecut trivial de el (0 ≤ orice) și ar fi ajuns la aprobator fără rost. Data
  angajării e `employees.hired_on` de pe fișa CERERII — cu scope `all` nu e a celui care
  apasă — citită cu clientul admin, fiindcă rolul `employee` nu-și vede fișa prin RLS; un
  `hired_on` gol SARE verificarea, nu refuză. Trecutul nu se refuză deloc: concediul
  medical e retroactiv prin natura lui. Ciorna rămâne nevalidată, deliberat — `recalc_sold`
  numără doar `trimisa` și `in_aprobare`. Caseta blochează butonul la zero zile, dar data
  angajării nu ajunge în client. — `src/domain/leave/verificari.ts`
- **Concediul aprobat înlocuiește ziua pontată.** Din 6 oct 2026,
  `sincronizeazaZileleDeConcediu` rescrie pe ACELAȘI rând ziua cu
  `sursa <> "sincronizare_concedii"` (manuală, ceas, plan, import): zero ore, fără
  interval, sediu sau decizie de pontaj (`ZI_LUCRATA_GOLITA`). Cazul real e concediul
  de urgență cerut pentru o zi deja pontată; înainte ziua rămânea lucrată ȘI scădea din
  sold. Dovada rămâne în `audit_logs`. Numărul iese din `decideCerere` ca
  `zileInlocuite`, iar angajatul primește o notificare `info`. La anulare, 0079 §3
  șterge rândul: ziua rămâne goală, nu revine singură ca lucrată. `pastrate` numără
  acum doar UPDATE-ul refuzat tăcut (zero rânduri). —
  `src/app/(app)/pontaj/sincronizare-concediu.ts`
- **Sincronizarea e best-effort, aprobarea nu.** Apelul stă într-un `try` din
  `decideCerere`: dacă pică (tipic, luna n-are perioadă de pontaj deschisă —
  `internal.pontaj_intrare_pregateste` refuză INSERT-ul), decizia rămâne dată, eșecul se
  loghează, iar `zileInlocuite` întoarce `0` — deci absența avertismentului **nu**
  înseamnă că nu există zile suprapuse. Recuperarea se face din pontaj, cu
  `sincronizeazaConcediile`. — `decideCerere`, în `src/app/(app)/concedii/actions.ts`
- **Lipsa unei cifre în `/concedii/sold` nu e un zero.** Din `0193` dreptul de odihnă vine
  din contract și din lunile lucrate, deci `dreptDinRand` întoarce `null` pentru un tip
  care scade din sold, fără rând în `leave_balances` și fără drept calculat: ecranul scrie
  „—", fiindcă implicitul tipului ar fi o cifră falsă pentru cineva intrat în octombrie.
  Dreptul calculat îl are numai fișa privitorului (`drepturileMele`). Tabelul arată
  implicit doar tipurile cu `scade_din_sold`; `?toate=1` le aduce pe toate, iar restul
  lipsesc fără niciun mesaj. — `ramaseDinRand`, în `src/lib/queries/leave.ts`

## Ce se mișcă împreună

Tipul preselectat în formular e `odihna`, prin `src/domain/leave/tip-implicit.ts` — nu
primul din listă, fiindcă ordinea alfabetică începe cu „Concediu creștere copil".

Migrarea → `src/types/database.ts` → `src/schemas/leave.ts` →
`src/lib/queries/leave.ts` → `src/app/(app)/concedii/actions.ts` → paginile. Calculul
zilelor lucrătoare și al drepturilor stă în `src/domain/leave/`, cu teste.

## Ce NU e aici

Nucleul upsert-ului concediu → foaie de prezență stă la pontaj, nu aici:
`sincronizeazaZileleDeConcediu` plus acțiunea în bloc `sincronizeazaConcediile` —
`[[modul/pontaj]]`. Concediile îl cheamă punctual, pe zilele unei cereri, în
`decideCerere`. Indemnizațiile intră în state de plată prin `[[modul/salarizare]]`, iar
`numarCereriInAsteptareLuna` (`src/lib/queries/leave.ts`) e pre-verificarea de acolo, cu
predicatul copiat din triggerul de pe `payroll_periods`.

## Când NU e suficientă pagina asta

- Regulile de drept și calculul soldului: `src/domain/leave/`.
- Forma lanțului de aprobare: migrarea care creează `approval_tasks`, plus
  `lantulAprobarii` din queries.
- Legăturile dintre ecrane (lotul 7i: fișa cererii, sold adresabil, „Cerere nouă” din calendar): [[strat/navigare]].
