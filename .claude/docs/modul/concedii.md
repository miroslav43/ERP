---
tip: modul
titlu: Concedii
aliases: [leave, CO, CM]
cai:
  - "src/app/(app)/concedii/**"
  - "src/lib/queries/leave.ts"
  - "src/schemas/leave.ts"
  - "src/domain/leave/**"
  - "src/lib/documents/cale.ts"
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
    employment_contracts,
    contract_suspendari,
    reges_evenimente,
  ]
permisiuni: [leave:read, leave:create, leave:update, leave:approve]
feature: leave
capcane: [2, 3, 11, 17, 33]
citeste_daca:
  - "cerere care rămâne în aceeași stare → [[date/pontaj]]"
  - "buton de aprobare absent → [[rol/manager]]"
  - "concediu aprobat care nu apare în foaia de prezență → [[modul/pontaj]]"
scris_pe: 07a81ec335333f513aeef4d6358cf32025557e01
scris_la: 2026-10-04
tags: [modul, hr]
---

# Concedii

Cereri de concediu cu lanț de aprobare, solduri anuale calculate din reguli de drept, și
un calendar de echipă. E **motorul generic de aprobare** al proiectului: `approval_tasks`
apare și în alte module, iar tiparul de tranziție de aici se copiază.

## Paginile modulului

Trunchiul ține ce e modulul, cine ajunge unde și **ce refuză baza fără să spună** —
secțiunea pentru care se deschide pagina dintr-un bug. Restul s-a spart pe subpagini
(`.claude/docs/meta/conventii.md`).

| Pagină                     | Ce ține                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| [[modul/concedii/actiuni]] | cele șase scrieri ale cererii, citirile ei, ce se mișcă la o schimbare de formă                  |
| [[modul/concedii/setari]]  | tipurile reglementate legal, grilele de zile suplimentare, zilele de bază, aplicarea drepturilor |

## Rute și cine ajunge

| Rută                                     | Poartă                                                          |
| ---------------------------------------- | --------------------------------------------------------------- |
| `/concedii`                              | `leave:read` own/team/all după scope; creare own; aprobare team |
| `/concedii/[id]`                         | `leave:read` own/team; `leave:update` own                       |
| `/concedii/aprobari`                     | `leave:approve` team                                            |
| `/concedii/echipa`, `/concedii/calendar` | `leave:read` team                                               |
| `/concedii/sold`                         | `leave:read` own/team/all                                       |
| `/concedii/setari`                       | `leave:update` all — v. [[modul/concedii/setari]]               |

Toate trec prin `requireFeature(tenant.organizationId, "leave")`, dar **în paralel cu
`getPermissionMap`**, într-un `Promise.all` — nu înlănțuite, cum arată preambulul
canonic. Refuzul rămâne identic: o poartă căzută respinge tot `Promise.all`-ul, înainte de
orice `can()`. Tiparul e la fel pe toate paginile modulului.

**Cererea nouă NU mai are rută.** `/concedii/noua` a dispărut în favoarea unei casete
deschise din listă (`dialog-cerere-noua.tsx`); datele formularului se citesc în
`date-cerere-noua.ts`, într-un singur `Promise.all`, ODATĂ cu lista — deci deschiderea
casetei nu atinge rețeaua. În același val intră fișa proprie și cererile care ocupă deja
zile, de aceea citirea cere și `user.id`. `/concedii?cerere=noua` o deschide direct
(butonul din panou, starea goală a listei); pagina remontează componenta prin `key`,
fiindcă o navigare pe aceeași rută ar păstra altfel starea clientului; același `key` ține
controalele din `src/app/(app)/concedii/calendar/navigare-luna.tsx` pe valorile din adresă.
`soldAnual` e memoizată cu `cache()`, ca `zileNelucratoare`: lista o cere de două ori, o
dată pentru rezumat și o dată pentru soldul din casetă.

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
  loghează, iar `zilePastrate` întoarce `0` — deci absența avertismentului **nu**
  înseamnă că nu există zile suprapuse. Recuperarea se face din pontaj, cu
  `sincronizeazaConcediile`. — `decideCerere`, în `src/app/(app)/concedii/actions.ts`
- **Declararea suspendării nu aruncă niciodată.** Un concediu cu
  `leave_types.suspenda_contract` produce, la aprobare, un rând în `contract_suspendari` și
  două evenimente REGES: `suspendare` pe `data_inceput` și `reluare_activitate` în ziua de
  DUPĂ `data_sfarsit`. Orice eșec — fișă fără contract activ, suprapunere respinsă cu
  `23P01`, termen REGES negăsit — iese ca `motiv`, nu ca eroare: aprobarea rămâne dată, iar
  declarația rămâne de făcut de mână. Termenul e ziua anterioară începerii și
  netransmiterea în termen e contravenție **per salariat**, deci `motiv` se AFIȘEAZĂ, ca
  `zilePastrate`. `revalidate` nu conține nicio cale de REGES.
  — `src/app/(app)/concedii/suspendare-contract.ts`
- **Cerința de atașament nu lovește toate tipurile la fel.**
  `internal.leave_requests_pregateste` ridică P0001 la trimiterea unui tip cu
  `necesita_document` doar dacă `atasament_path` e gol **și** `medical_code_id` e null —
  un ecran fără încărcare de fișier lasă deci să treacă tipurile cu cod de indemnizație și
  blochează restul, fără ca diferența să apară nicăieri. Scutite explicit: cheile din
  `TIPURI_CU_ORIGINAL_FIZIC`. — `supabase/migrations/0106_concediu_document_original.sql`
- **Segmentul 2 al căii de Storage e un nume de resursă REAL, nu un cuvânt liber.**
  `app.can_path` îl dă direct lui `app.has_permission`, iar un cuvânt absent din
  `role_permissions.resource` întoarce `none` — refuz TĂCUT la fiecare încărcare. Calea
  concediilor e `{org}/leave/{employee_id}/…`, exclusiv prin `construiesteCaleDocument`.
  — `src/lib/documents/cale.ts`, `supabase/migrations/0073_cale_storage_resurse.sql`
- **Calea primită de la client nu se crede pe cuvânt.** Poarta de Storage păzește
  scrierea fișierului, nu referința scrisă în rând, deci `creeazaCerereConcediu` trece
  `atasament_path` prin `caleInPrefix`, nu prin `startsWith`: pe lângă prefixul fișei se
  cer segmente curate — cad segmentul gol, `.`, `..` și formele lor procent-codificate. La
  citire, zero rânduri sub politica de SELECT nu se deosebesc de „nu există": ambele ies
  ca același `notFound`. — `verificaCaleaDocumentului` și `linkDocumentConcediu`, în
  `src/app/(app)/concedii/actions.ts`
- **`traduEroare` ÎNTOARCE eroarea, nu o aruncă** (invers față de rudele din alte module):
  fiecare apel se scrie `throw traduEroare(e)`. Fără `throw`, o eroare de citire a cererii
  ieșea pe ecran ca document lipsă, prin `notFound`-ul de mai sus.
  — `src/app/(app)/concedii/erori.ts`, capcana #3
- **Marcajul zilelor deja ocupate e semnalizare, nu poartă.** Caseta de cerere nouă
  colorează zilele prinse de o cerere `trimisa`/`in_aprobare`/`aprobata`, dar le blochează
  doar pentru tipurile fără `intrerupe_alte_concedii` — celelalte au voie să se suprapună.
  Lipsa marcajului nu e garanție: fără persoană aleasă harta e goală, iar citirea n-are
  cursor pe o fereastră de trei ani, deci peste `max_rows` PostgREST o taie tăcut
  (capcana #2). Judecătorul rămâne verificarea de la trimitere.
  — `src/domain/leave/zile-ocupate.ts`
- **Angajatul și tipul din calendar pot veni NULL, fără eroare.** `calendarLunii` îi
  aduce prin embed imbricat PostgREST (`angajat:employees!employee_id`,
  `tip:leave_types!leave_requests_leave_type_id_fkey`), deliberat fără `!inner`: un embed
  to-one filtrat de RLS întoarce NULL, nu elimină rândul. Ziua rămâne pe calendar, cu
  „Angajat" și „Concediu" în locul numelui și al tipului — nu o citi ca pe date lipsă din
  bază. — `calendarLunii`, în `src/lib/queries/leave.ts`
- **Soldul lipsă din coada de aprobări nu înseamnă sold zero.** `/concedii/aprobari` arată
  zilele rămase ale celui care cere, din `soldAnual` pe anul PRIMEI cereri din coadă: un
  angajat fără rând de sold pe tipul cerut, un angajat sau tip golit de RLS, ori o coadă
  întinsă peste doi ani calendaristici ascund cifra, în loc s-o inventeze. Tipurile care
  nu scad din sold n-o arată deloc. — `src/app/(app)/concedii/aprobari/page.tsx`
- **Contorul de aprobat urmează lista, nu starea cererii.** `numarDeAprobat` și
  `deAprobat` se citesc din aceeași sursă; un `count()` naiv pe `approval_tasks` rămâne
  blocat pe un număr care nu scade. — `src/lib/queries/leave.ts`

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
`decideCerere`. Indemnizațiile intră în state de plată prin `[[modul/salarizare]]`.

Termenele și evenimentele REGES nu se calculează aici: `genereazaEvenimenteReges`
(`src/lib/reges/genereaza-evenimente.ts`) le scrie în `reges_evenimente`, pe termenele din
`reges_termene`, iar transmiterea e a lui `[[modul/reges]]`. Concediile doar cer generarea,
prin `declaraSuspendareaContractului`.

Contractul de cale în Storage (bucket, entități, limită, MIME) stă în
`src/lib/documents/cale.ts`, comun cu `[[modul/angajati]]`.

## Când NU e suficientă pagina asta

- Regulile de drept și calculul soldului: `src/domain/leave/`.
- Forma lanțului de aprobare: migrarea care creează `approval_tasks`, plus
  `lantulAprobarii` din queries.
- Legăturile dintre ecrane (lotul 7i: fișa cererii, sold adresabil, „Cerere nouă” din calendar): [[strat/navigare]].
