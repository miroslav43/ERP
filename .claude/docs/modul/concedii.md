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
scris_pe: 3c9747a4f30ad317e7ea4e01fe0a4e778381411e
scris_la: 2026-08-30
tags: [modul, hr]
---

# Concedii

Cereri de concediu cu lanț de aprobare, solduri anuale calculate din reguli de drept, și
un calendar de echipă. E **motorul generic de aprobare** al proiectului: `approval_tasks`
apare și în alte module, iar tiparul de tranziție de aici se copiază.

## Rute și cine ajunge

| Rută                                     | Poartă                                                          |
| ---------------------------------------- | --------------------------------------------------------------- |
| `/concedii`                              | `leave:read` own/team/all după scope; creare own; aprobare team |
| `/concedii/noua`                         | `leave:create` own (all pentru altcineva)                       |
| `/concedii/[id]`                         | `leave:read` own/team; `leave:update` own                       |
| `/concedii/aprobari`                     | `leave:approve` team                                            |
| `/concedii/echipa`, `/concedii/calendar` | `leave:read` team                                               |
| `/concedii/sold`                         | `leave:read` own/team/all                                       |
| `/concedii/setari`                       | `leave:update` all                                              |

Toate trec prin `requireFeature(tenant.organizationId, "leave")`.

## Server Actions

`src/app/(app)/concedii/actions.ts` (cererea) și `setari/actions.ts` (configurarea).

| Funcție                                                                                 | Permisiune / minScope  |
| --------------------------------------------------------------------------------------- | ---------------------- |
| `creeazaCerereConcediu`                                                                 | `leave:create` / own   |
| `trimiteCerere`, `anuleazaCerere`                                                       | `leave:update` / own   |
| `decideCerere`                                                                          | `leave:approve` / team |
| `actualizeazaTipConcediu`, `comutaActivTipConcediu`                                     | `leave:update` / all   |
| `creeazaRegulaConcediu`                                                                 | `leave:create` / all   |
| `dezactiveazaRegulaConcediu`, `seteazaZileConcediuImplicit`, `aplicaDrepturileConcediu` | `leave:update` / all   |
| `pregatesteIncarcareDocumentConcediu`                                                   | `leave:create` / own   |
| `linkDocumentConcediu`                                                                  | `leave:read` / own     |

`decideCerere` întoarce `{ id, zilePastrate }`, nu doar identificatorul cererii, iar
`revalidate` își declară tipul explicit pe forma asta. `zilePastrate` e numărul de zile
de concediu peste care exista deja o linie de pontaj scrisă de om — v. „Ce refuză baza
tăcut". Cine adaugă un apelant nou trebuie să-l **afișeze**: e singurul loc în care
cineva care poate repara se uită la ecran. Azi îl consumă `DecizieAprobare`
(`src/app/(app)/concedii/aprobari/decizie-aprobare.tsx`, folosită și de `/concedii/[id]`),
ca `role="alert"` care supraviețuiește închiderii panoului; în plus, acțiunea îi scrie
angajatului o notificare în `notifications`, cu clientul admin, filtrat pe organizație.
Notificarea e un plus, nu poarta: dacă INSERT-ul cade, eșecul se loghează și aprobarea
rămâne dată.

**Octeții documentului justificativ nu trec prin nicio acțiune.**
`pregatesteIncarcareDocumentConcediu` întoarce `{ cale, token }`, fișierul urcă din
browser direct în `org-documents` (`uploadToSignedUrl`), iar calea ajunge în
`creeazaCerereConcediu` printr-un câmp ascuns numit `atasament_path` — exact cheia din
`creeazaCerereSchema`, ca `fieldErrors` s-o găsească. Fișierul e sus **înainte** ca
cererea să existe: un abandon lasă un obiect orfan, preferabil unei cereri care trimite
spre un fișier inexistent. `linkDocumentConcediu` face drumul invers — citește RÂNDUL cu
clientul utilizatorului, ca RLS să decidă cine vede cererea, și abia calea din rândul
întors se semnează, pentru un minut. Componentele `incarcare-document.tsx` și
`link-document.tsx` stau în `src/app/(app)/concedii/`; prima e folosită și de formularul
din portal, deci se schimbă pentru amândouă ecranele deodată.

## Citiri

`src/lib/queries/leave.ts`: `listeazaCereri`, `citesteCerere`, `zileleCererii`,
`lantulAprobarii`, `soldAnual`, `istoricSold`, `numarDeAprobat`, `deAprobat`,
`calendarLunii`, `zileNelucratoare`, `configurareConcedii`, `previzualizeazaDrepturi`,
`coduriIndemnizatieMedicala`, `varianteConcediu`.

`zileNelucratoare` e memoizată pe cerere cu `cache()` din React, ca `resolveTenant` și
`getPermissionMap` — o pagină care o cheamă din corpul ei și din secțiunea streamată
plătește un singur val. Memoizarea ține doar fiindcă argumentele sunt primitive
(`organizationId`, doi ani): `cache()` compară prin identitate, deci un argument-obiect
n-ar nimeri niciodată în cache. E consumată și din afara modulului — `[[modul/pontaj]]`,
`[[modul/salarizare]]` și portal — deci semnătura ei nu se schimbă local.

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
- **Contorul de aprobat urmează lista, nu starea cererii.** `numarDeAprobat` și
  `deAprobat` se citesc din aceeași sursă; un `count()` naiv pe `approval_tasks` rămâne
  blocat pe un număr care nu scade.

## Ce se mișcă împreună

Migrarea → `src/types/database.ts` → `src/schemas/leave.ts` →
`src/lib/queries/leave.ts` → `src/app/(app)/concedii/actions.ts` → paginile. Calculul
zilelor lucrătoare și al drepturilor stă în `src/domain/leave/`, cu teste.

Lista tipurilor al căror act se predă pe hârtie trăiește în două limbaje —
`TIPURI_CU_ORIGINAL_FIZIC` din `src/domain/leave/documente-fizice.ts` și condiția din
`internal.leave_requests_pregateste` — fiindcă regula vine din lege, nu din politica unei
firme, deci nu e o coloană reglabilă pe `leave_types`. `documente-fizice.test.ts` citește
migrarea și pică dacă se despart: altfel ecranul ar declara fișierul opțional exact acolo
unde baza îl cere la trimitere.

Forma returnată de o acțiune se mișcă în trei locuri deodată: tipul din `handler`, tipul
scris explicit în `revalidate` (declarat înaintea handlerului, deci TypeScript n-are de
unde-l infera) și componenta client care citește `rezultat.data`. `decideCerere` le are
pe toate trei.

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
