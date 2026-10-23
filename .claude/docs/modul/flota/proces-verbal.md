---
tip: modul
titlu: Flotă — procesul-verbal de predare-primire
aliases: [proces-verbal, pv vehicul, predare-primire, PVA]
cai:
  - "supabase/migrations/0215_flota_proces_verbal.sql"
  - "src/domain/fleet/proces-verbal.ts"
  - "src/schemas/fleet-pv.ts"
  - "src/lib/queries/fleet-pv.ts"
  - "src/lib/pdf/proces-verbal-vehicul.ts"
  - "src/app/(app)/flota/[id]/pv/**"
  - "src/app/(app)/flota/[id]/capete-pv.ts"
  - "src/app/(app)/flota/[id]/celula-pv.tsx"
  - "src/app/(app)/flota/[id]/dialog-pv.tsx"
  - "src/app/(app)/flota/[id]/dialog-pv-nou.tsx"
  - "src/app/(app)/flota/[id]/valori-pv.ts"
  - "src/app/api/export/flota/pv/**"
  - "src/app/(portal)/portal/masina-mea/confirma-pv.tsx"
  - "tests/rls/proba-flota-pv.sql"
tabele: [vehicle_handovers, vehicle_assignments, vehicles, registru_documente, document_sequences]
permisiuni: [vehicles:read, vehicles:update, employees:read]
feature: fleet
capcane: [17, 18, 22, 23, 29, 30, 31]
scris_pe: ba781f3ae6b4f86b485459dac636d2e5a5cc728d
scris_la: 2026-10-23
tags: [modul, operations]
---

# Flotă — procesul-verbal de predare-primire

Extensia F12c a planului „Flotă completă”, din `0215_flota_proces_verbal.sql`. Fiecare
predare, restituire sau transfer direct între doi șoferi poate produce un proces-verbal
(PV) numerotat `PVA-AAAA-NNNN`, înregistrat în registrul general și descărcabil în PDF.
Alocările sunt în `[[modul/flota]]`; drepturile pe roluri, în `[[modul/flota/roluri-si-portal]]`.

## Rute și cine ajunge

| Rută                        | Poartă                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| `/flota/[id]` (coloana PV)  | `vehicles:read` own; „Întocmește PV” doar cu `vehicles:update` all     |
| `/flota/[id]?pv=nou&…`      | caseta PV-ului nou, deschisă prin parametru (`deschisInitial` + `key`) |
| `/flota/[id]/pv/[pv]`       | `vehicles:read` own + RLS; tranzițiile cer `vehicles:update` all       |
| `/api/export/flota/pv/[id]` | modulul `fleet` + RLS, FĂRĂ poartă pe `vehicles:read` (decizia 3)      |
| `/portal/masina-mea`        | modulul `fleet` și fișa principală; foile doar cu `trip_sheets:read`   |

## Server Actions

`src/app/(app)/flota/[id]/pv/actions.ts` (calea `actions.ts`, nu `actions-pv.ts`: auditul,
ESLint și garda demo recunosc doar numele ăsta).

| Funcție                                                                  | Permisiune / minScope   |
| ------------------------------------------------------------------------ | ----------------------- |
| `creeazaPv`, `actualizeazaPv`, `finalizeazaPv`, `anuleazaPv`, `stergePv` | `vehicles:update` / all |
| `confirmaPv`                                                             | `employees:read` / own  |
| `pregatesteScanPv`, `confirmaScanPv` (scanul semnat)                     | `vehicles:update` / all |

`confirmaPv` nu e pe `vehicles:read`: omul fără drept pe parc care e parte la PV (decizia 3)
trebuie să-l poată confirma. Cine e parte decide baza; acțiunea doar alege coloana, după
fișa PRINCIPALĂ (`fisaMea`).

## Citiri

`src/lib/queries/fleet-pv.ts`: `pvurileVehiculului`, `citestePv` (cu părțile încorporate),
`pvurileMele` (un singur `.or()` pe fișa proprie), `pvuriDeConfirmat` (cardul „De făcut” din
portal), `documenteleCurenteLaBord`. Gruparea pe capetele alocărilor și propunerea de
transfer: `capete-pv.ts`, din alocările deja citite.

## Ce refuză baza tăcut sau cu P0001

- **Scanul semnat e fișierul PV-ului** (X2): `scan_path` = `{org}/vehicles/{vehicul}/pv-{id PV}-{uuid}-{fișier}`,
  forma pe care o semnează doar `pregatesteScanPv` (`construiesteCaleScanPv`); altă cale din
  folderul vehiculului (RCA, talon) dă P0001. Poarta bucketului dă fișierul egal cu
  `scan_path` și celor care văd doar PV-ul (fostul șofer), deci fără prefix adminul putea
  expune orice document de bord. Proba: `proba-flota-pv.sql` (31).

- **Politica SELECT nu filtrează `deleted_at`** (0164): cu filtrul, ștergerea logică a ciornei
  ar da 42501. Fiecare citire pune explicit `.is("deleted_at", null)`. — capcana #31
- **Părțile, tipul, momentul, numărul, instantaneul și înregistrarea le scrie baza** din
  alocări. `sofer_employee_id` e GENERATED (trimis dă 428C9), iar în triggerul BEFORE e încă
  NULL. — capcanele #22 și #30
- **Finalizatul e imuabil.** Orice altă schimbare decât anularea, confirmarea părții sau scanul
  dă P0001; corectura e anulare + PV nou. A doua finalizare are zero rânduri: CONFLICT. Garda
  compară RÂNDUL ÎNTREG minus coloanele permise, deci o coloană nouă e imuabilă din oficiu.
- **`id` și `created_at` nu se schimbă pe nicio stare** (P0001). Partea la PV are UPDATE pe
  rând; un `id` rescris ar fi rupt legătura cu registrul, notificarea și auditul.
- **Ștergerea ciornei nu poartă nicio altă schimbare** (P0001): ramura de ștergere sare peste
  derivare, deci un număr, o parte sau `stare = 'finalizat'` trimise odată cu `deleted_at`
  ar fi rămas pe rândul șters (numărul ar fi blocat `pvv_numar_uq` pentru totdeauna).
- **Confirmarea e o singură dată, pe coloana PĂRȚII**, cu ora și autorul scrise de bază.
  Alt om: zero rânduri (USING). Pe un PV anulat: refuz.
- **Kilometrajul**: dacă alocarea îl are, PV-ul trebuie să-l repete; dacă nu, alocarea îl
  primește din PV la finalizare. Verificările vin înaintea lui `va_km_ck`, deci omul vede
  P0001 cu cifrele, nu 23514 brut.
- **Transferul A → A e refuzat**: EXCLUDE-ul din 0173 oprește suprapunerea, nu două alocări
  lipite ale aceluiași om. Ecranul nu propune PV pe asemenea capete.
- **Un singur PV viu pe fiecare capăt de alocare** (23505 pe `pvv_primita_uq` /
  `pvv_predata_uq`); anularea eliberează locul.
- **Un an de registru închis oprește finalizarea** (P0001 din registru); numărul PVA nu se
  arde, fiindcă secvența e în aceeași tranzacție.
- **Decizia 3 (B3)**: `hr` sau orice rol fără `vehicles:read` vede PV-urile la care e parte și
  vehiculul alocat LUI (ramura din `vehicule_select`), fără documentele lui, alocări, foi sau
  restul parcului. „Mașina mea” îi arată mașina fără semafor. ATENȚIE: o politică nouă care
  judecă după `exists (… from public.vehicles …)` SUB RLS moștenește ramura, la fel o funcție
  SECURITY INVOKER care citește `vehicles`; tabelele copil folosesc
  `app.poate_vedea_vehicul_dupa_id` (0199), care n-o are, iar `flota_fiscal_luna` filtrează pe
  `app.poate_vedea_vehicul` (0205). Valoarea de achiziție NU mai vine cu rândul
  vehiculului: din 0225 stă în `vehicle_costuri`, sub citirea costurilor, iar hr-ul cu
  mașină primește embed-ul `null` (`[[modul/flota/service-si-costuri]]`).
- **Cine întocmește**: doar `vehicles:update = all` și membru. `super_admin` vede, nu scrie.
- **Scanul hârtiei semnate** (`pregatesteScanPv` → urcare → `confirmaScanPv`) stă în
  `org-flota`, în folderul VEHICULULUI (0202): doar pe PV-ul finalizat, doar cine
  administrează parcul; altă cale dă P0001. Îl citește cine vede vehiculul ȘI cine vede PV-ul
  (fostul șofer, managerul lui, partea fără `vehicles:read`), doar pe calea exactă
  `scan_path`: 0215 rescrie `app.flota_poate_fisier` (0202), deci o rescriere ulterioară
  pornește de la forma din 0215.

Proba: `tests/rls/proba-flota-pv.sql`, plus blocul `(l) F12c` din `tests/rls/izolare.sql`,
cu rânduri numărate pe toate cele cinci roluri.

## Erori traduse

`src/app/(app)/flota/[id]/pv/erori.ts` (`traduEroarePv`): P0001 de kilometraj și de câmpuri
lipsă pe câmp, daunele pe `daune`, 23505 pe alocare cu instrucțiunea de anulare, CHECK-urile
`pvv_*` pe câmp. Restul cade pe traducerea generică a flotei.

## Ce se mișcă împreună

Migrarea → `src/types/database.ts` → `domain/fleet/proces-verbal.ts` (listele, testate pe
textul migrării: un cod care diverge dă 23514) → `schemas/fleet-pv.ts` → citiri → acțiuni →
`modelPv` → ecranul PV-ului ȘI PDF-ul. `valori-pv.ts` e singura traducere din `FormData`:
radioul „s-au constatat daune?” neales e `null`, nu `false`.

Registrul deschide PDF-ul inline (`registru/legaturi.ts`, `vehicle_handovers`).

## Ce NU e aici

Fotografiile daunelor, crearea automată a PV-ului din alocare, recuperarea pagubei de la
șofer.

## Când NU e suficientă pagina asta

- Forma exactă a gărzii și a instantaneului: `internal.pv_vehicul_inainte` și
  `internal.pv_vehicul_instantaneu` din migrare.
- Valoarea juridică a confirmării din portal și formula de semnare: ⚠ de validat de jurist;
  aplicabilitatea OMFP 2634/2015 la un PV intern: ⚠ de contabil.
