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
  ]
permisiuni: [leave:read, leave:create, leave:update, leave:approve]
feature: leave
capcane: [11, 17, 33]
citeste_daca:
  - "cerere care rămâne în aceeași stare → [[date/pontaj]]"
  - "buton de aprobare absent → [[rol/manager]]"
  - "concediu aprobat care nu apare în foaia de prezență → [[modul/pontaj]]"
scris_pe: 711e5225e1df2ceab9324037466c87fda8abd8a0
scris_la: 2026-09-04
tags: [modul, hr]
---

# Concedii

Cereri de concediu cu lanț de aprobare, solduri anuale calculate din reguli de drept, și
un calendar de echipă. E **motorul generic de aprobare** al proiectului: `approval_tasks`
apare și în alte module, iar tiparul de tranziție de aici se copiază.

## Paginile modulului

Pagina asta e trunchiul: ce e modulul, cine ajunge unde și **ce refuză baza fără să
spună** — secțiunea pentru care se deschide pagina dintr-un bug. Restul s-a spart pe
subarborele de rute și pe secțiunea de acțiuni, fiindcă trunchiul trecuse de plafonul dur
de 12 KB al convenției (`.claude/docs/meta/conventii.md`).

| Pagină                     | Ce ține                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| [[modul/concedii/actiuni]] | cele șase scrieri ale cererii, cele unsprezece citiri, ce se mișcă la o schimbare de formă       |
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
canonic. Sunt două citiri independente, pe tabele diferite, iar costul înlănțuirii era
integral rețea. Refuzul rămâne identic: o poartă căzută respinge tot `Promise.all`-ul,
înainte de orice `can()`. Tiparul e la fel pe toate paginile modulului.

**Cererea nouă NU mai are rută.** `/concedii/noua` a dispărut în favoarea unei casete
deschise din listă (`dialog-cerere-noua.tsx`); datele formularului se citesc în
`date-cerere-noua.ts`, într-un singur `Promise.all`, ODATĂ cu lista — deci deschiderea
casetei nu atinge rețeaua. `/concedii?cerere=noua` o deschide direct (butonul din panou,
starea goală a listei); pagina remontează componenta prin `key`, fiindcă o navigare pe
aceeași rută ar păstra altfel starea clientului. `soldAnual` e memoizată cu `cache()`,
ca `zileNelucratoare`: lista o cere de două ori, o dată pentru rezumat și o dată pentru
soldul din casetă.

**Concediul se cere doar pe ZILE ÎNTREGI.** Jumătățile de zi au ieșit în
`0112_concediu_doar_zi_intreaga.sql`: coloanele `portiune_inceput`/`portiune_sfarsit` și
`leave_request_days.portiune` mai există, dar o constrângere le ține pe `zi_intreaga`,
`app.numara_zile_lucratoare` a pierdut cei doi parametri, iar `numaraZileCerere` întoarce
de acum întotdeauna un întreg. Enum-urile `leave_day_portion` și cele două etichete
`jumatate_in_*` din `leave_rounding_mode` rămân în bază — Postgres nu știe să scoată o
valoare dintr-un enum — dar nicio coloană nu le mai poate primi.

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
  `src/lib/queries/employees.ts` — o virgulă sau o ghilimea dintr-un nume sparge altfel
  filtrul PostgREST `or=(…)`. Separatorul se scrie ca secvență de evadare, niciodată ca
  octet brut. — capcana #11
- **Sincronizarea în pontaj sare tăcut peste ziua pe care angajatul și-a pontat-o
  singur.** `sincronizeazaZileleDeConcediu` nu atinge nicio linie cu
  `sursa <> "sincronizare_concedii"`: o numără în `pastrate` și merge mai departe, fără
  eroare. Ziua rămâne lucrată **și** se scade o zi din soldul de concediu, iar
  salarizarea agregă `ore_lucrate` fără să se plângă — se plătește de două ori. Numărul
  nu se mai aruncă: iese din `decideCerere` ca `zilePastrate` și ajunge la aprobator.
  Suprascrierea rămâne **interzisă** — dacă omul chiar a muncit atunci, ștergerea
  declarației lui distruge singura dovadă; decizia e a oamenilor.
  — `src/app/(app)/pontaj/sincronizare-concediu.ts:97`
- **Sincronizarea e best-effort, aprobarea nu.** Apelul stă într-un `try` din
  `decideCerere`: dacă pică (tipic, luna n-are perioadă de pontaj deschisă —
  `internal.pontaj_intrare_pregateste` refuză INSERT-ul), decizia rămâne dată, eșecul se
  loghează, iar `zilePastrate` întoarce `0` — deci absența avertismentului **nu**
  înseamnă că nu există zile suprapuse. Recuperarea se face din pontaj, cu
  `sincronizeazaConcediile`. — `decideCerere`, în `src/app/(app)/concedii/actions.ts`
- **Cerința de atașament nu lovește toate tipurile la fel.**
  `internal.leave_requests_pregateste` ridică P0001 la trimiterea unui tip cu
  `necesita_document` doar dacă `atasament_path` e gol **și** `medical_code_id` e null —
  un ecran fără încărcare de fișier lasă deci să treacă tipurile cu cod de indemnizație și
  blochează restul, fără ca diferența să apară nicăieri. Scutite explicit: cheile din
  `TIPURI_CU_ORIGINAL_FIZIC`. — `supabase/migrations/0106_concediu_document_original.sql`
- **Segmentul 2 al căii de Storage e un nume de resursă REAL, nu un cuvânt liber.**
  `app.can_path` îl dă direct lui `app.has_permission`, iar un cuvânt absent din
  `role_permissions.resource` întoarce `none` — refuz TĂCUT la fiecare încărcare. Calea
  concediilor e `{org}/leave/{employee_id}/…`, construită exclusiv prin
  `construiesteCaleDocument`. — `src/lib/documents/cale.ts`,
  `supabase/migrations/0073_cale_storage_resurse.sql`
- **Calea primită de la client nu se crede pe cuvânt.** Poarta de Storage păzește
  scrierea fișierului, nu referința scrisă în rând, deci `creeazaCerereConcediu` verifică
  separat că `atasament_path` începe cu prefixul fișei pentru care se face cererea. La
  citire, zero rânduri sub politica de SELECT nu se deosebesc de „nu există": ambele ies
  ca același `notFound`. — `verificaCaleaDocumentului` și `linkDocumentConcediu`, în
  `src/app/(app)/concedii/actions.ts`
- **Angajatul și tipul din calendar pot veni NULL, fără eroare.** `calendarLunii` îi
  aduce prin embed imbricat PostgREST (`angajat:employees!employee_id`,
  `tip:leave_types!leave_requests_leave_type_id_fkey`), deliberat fără `!inner`: un embed
  to-one filtrat de RLS întoarce NULL, nu elimină rândul. Ziua rămâne pe calendar, cu
  „Angajat" și „Concediu" în locul numelui și al tipului — nu o citi ca pe date lipsă din
  bază. `.returns<RandZiCalendar[]>()` e obligatoriu, fiindcă amândouă cheile străine au
  `isOneToOne: false` și inferența supabase-js dă tablou, nu obiect.
  — `calendarLunii`, în `src/lib/queries/leave.ts`
- **Contorul de aprobat urmează lista, nu starea cererii.** `numarDeAprobat` și
  `deAprobat` se citesc din aceeași sursă; un `count()` naiv pe `approval_tasks` rămâne
  blocat pe un număr care nu scade.

## Ce se mișcă împreună

Tipul preselectat în formular e `odihna`, prin `src/domain/leave/tip-implicit.ts` — nu
primul din listă, fiindcă ordinea alfabetică începe cu „Concediu creștere copil".

Migrarea → `src/types/database.ts` → `src/schemas/leave.ts` →
`src/lib/queries/leave.ts` → `src/app/(app)/concedii/actions.ts` → paginile. Calculul
zilelor lucrătoare și al drepturilor stă în `src/domain/leave/`, cu teste.

## Ce NU e aici

Nucleul upsert-ului concediu → foaie de prezență stă la pontaj, nu aici:
`sincronizeazaZileleDeConcediu` din `src/app/(app)/pontaj/sincronizare-concediu.ts`,
plus acțiunea în bloc `sincronizeazaConcediile` — `[[modul/pontaj]]`. Concediile îl
cheamă doar punctual, pe zilele unei singure cereri, în `decideCerere`. Indemnizațiile
intră în state de plată prin `[[modul/salarizare]]`.

Contractul de cale în Storage — bucketul, entitățile permise, limita și tipurile MIME —
stă în `src/lib/documents/cale.ts`, comun cu `[[modul/angajati]]`. Concediile îl folosesc,
nu îl definesc: o entitate nouă acolo se adaugă o singură dată, pentru toate modulele.

## Când NU e suficientă pagina asta

- Regulile de drept și calculul soldului: `src/domain/leave/`.
- Forma lanțului de aprobare: migrarea care creează `approval_tasks`, plus
  `lantulAprobarii` din queries.
