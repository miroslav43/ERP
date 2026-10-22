---
tip: modul
titlu: Flotă — ieșirea din parc (vânzare, casare, radiere)
aliases:
  [
    vehicle_exits,
    vehicle_exit_obligations,
    scoate din parc,
    vânzare vehicul,
    casare,
    radiere,
    daună totală,
    restituire leasing,
    termene de ieșire,
  ]
cai:
  - "supabase/migrations/0218_flota_iesire_din_parc.sql"
  - "src/app/(app)/flota/[id]/iesire/**"
  - "src/lib/queries/flota-iesire.ts"
  - "src/schemas/flota-iesire.ts"
  - "tests/rls/proba-flota-iesire.sql"
tabele:
  [
    vehicle_exits,
    vehicle_exit_obligations,
    vehicles,
    vehicle_assignments,
    expirables,
    compliance_alerts,
  ]
permisiuni: [vehicles:read, vehicles:update]
feature: fleet
capcane: [18, 19, 23, 26, 59]
scris_pe: 0e303a1085113be87dbcbe9a9e7c0afd49aca517
scris_la: 2026-10-22
tags: [modul, operations]
---

# Flotă — ieșirea din parc

Extrasă din `[[modul/flota]]` (extensia F12h). Migrarea: `0218_flota_iesire_din_parc.sql`
(specificația o numea `0215`; traseele F12 s-au mutat după integrarea mentenanței). Regula
de fond: **un singur INSERT în `vehicle_exits` face tot**, iar faptele ieșirii (fel, dată,
kilometraj, motiv) nu se editează: o greșeală se ANULEAZĂ și se reface.

## Rute și cine ajunge

Nicio rută proprie: asistentul „Scoate din parc” și secțiunea „Ieșirea din parc” stau pe
`/flota/[id]` (directorul `iesire/` n-are `page.tsx`). Citirea cere `vehicles:read` all,
scrierea `vehicles:update` all. Fără chei noi; `super_admin` citește (platformă), nu scrie.

## Ce face INSERT-ul (triggerele din 0218)

1. Închide alocarea deschisă la **sfârșitul zilei ieșirii** (ora României), nu acum, cu
   `km_restituire = km_iesire`: ieșirea se înregistrează des retroactiv.
2. Trece vehiculul în `vandut` (vânzare, restituire la locator, epavă vândută) sau `casat`
   (restul). Statusuri noi nu există: pastila arată felul ieșirii („Radiat — furt”).
   Documentele, planurile de service și cardurile ies singure din semafor; rezervările
   viitoare se anulează.
3. Creează termenele din catalogul `internal.iesire_catalog()`, cu denumirea și temeiul
   COPIATE pe rând, și le proiectează în `expirables` (`entity_type = 'vehicle_exit'`,
   `entity_id` = vehiculul). Natura „Recomandat” pe interpretări (I-T3): declarația la
   vânzare și plata pe anul dobândirii, ⚠ contabil.

Anularea: vehiculul revine `activ`, termenele ies din alerte (rămân în tabelă ca istoric).
Alocarea și rezervările NU revin. Vehiculele ieșite înainte de 0218 au o ieșire
`preluata_din_istoric`, fără termene.

## Server Actions

`src/app/(app)/flota/[id]/iesire/actions.ts`, toate `vehicles:update` / all.

| Funcție                | Ce face                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| `scoateDinParc`        | INSERT; `cumparator` și `pret` în afara auditului (și a `audit_logs`)         |
| `anuleazaIesirea`      | UPDATE `anulat_la` pe ieșirea vie, `.select()`; zero rânduri = CONFLICT       |
| `finalizeazaObligatia` | „Făcut la …” sau „Nu se aplică” pe un termen deschis; zero rânduri = CONFLICT |
| `redeschideObligatia`  | înapoi la deschis; baza refuză dacă un termen dependent e făcut               |

`FormData` → încărcătură doar prin `iesire/valori-iesire.ts` (bifa lipsă = `false`; câmpurile
pe care felul ieșirii nu le cere pleacă `null`). Erorile: `iesire/erori-iesire.ts` (P0001 pe
`data_iesire`, `km_iesire`, `finalizat_la`; „Vehiculul …” NU merge pe `vehicle_id`, câmp
ascuns în casetă).

## Citiri

`src/lib/queries/flota-iesire.ts`: `iesireaVehiculului` (ieșirea vie + termenele) și
`iesirileAnulate`. Termenele se citesc din tabela proprie, nu din `expirables`.

## Ce refuză baza tăcut

- **`manager`, `hr`, `employee` văd ZERO ieșiri și ZERO termene, fără eroare** (implicita
  I-h6). Pagina cheamă citirile doar sub `vehicles:read` all. Rezumatul zilnic trimite
  termenele de ieșire doar destinatarilor cu `all`; ale unui pool nu ajung la un
  responsabil cu `team`, ci la administratori. — capcanele #18, #19 și #26
- **Termenele care curg de la radiere n-au rând în `expirables`** până se bifează radierea
  (`termen = null`): nu se alertează și un `count()` acolo le ratează. — capcana #59
- **Un UPDATE pe un termen al unei ieșiri anulate, sau al altei firme, atinge zero rânduri.**
  Acțiunile filtrează pe stare și pe firmă și tratează rezultatul gol drept CONFLICT.

## Ce refuză baza cu P0001

- `status` scris direct în/din `vandut`/`casat` (`vehicles_iesire_garda`): ieșirea trece prin
  asistent, revenirea prin anulare. Caseta „Modifică” nu mai oferă stările de ieșire.
- Data în viitor, înaintea achiziției sau înaintea unei foi a vehiculului; km sub ultimul
  kilometraj sau sub predarea către șoferul actual; a doua ieșire vie.
- Orice schimbare a faptelor ieșirii, inclusiv ștergerea ei logică; orice UPDATE pe o ieșire
  anulată; anularea pe un vehicul șters.
- Pe termene: altceva decât bifa, data, nota; data bifării în viitor sau înaintea ieșirii
  (la păstrarea numărului, înaintea achiziției); „Nu se aplică” pe un pas cu dependenți
  deschiși (radierea din oficiu se marchează „Făcut” cu data ei). INSERT direct: 42501.

Înaintea tuturor: INSERT-ul fără `vehicles:update` all în firma din rând dă **42501 din
trigger, înaintea oricărei gărzi**. `WITH CHECK` se judecă DUPĂ triggerele BEFORE, iar
gărzile citesc vehiculul fără RLS: fără poartă, mesajele lor dădeau oricui km-ul, data
achiziției și starea vehiculului altei firme (proba 10b). Autorii (`finalizat_de`,
`anulat_de`, `created_by`) au ON DELETE SET NULL: triggerele îi repun din OLD doar în afara
contextului de serviciu, altfel ștergerea contului cade cu 23503 (proba 23).

## Ce se mișcă împreună

Migrarea → `src/types/database.ts` → `src/schemas/flota-iesire.ts` → citiri → acțiuni →
`iesire/sectiune-iesire.tsx` și pastila din `src/app/(app)/flota/[id]/page.tsx`. Catalogul
termenelor există o singură dată, în SQL; caseta arată doar descrierea statică din
`iesire/etichete-iesire.ts`. Rescrierile comune din 0218, de la forma 0214:
`app.poate_vedea_expirabil` (cu garda pe toate ramurile), `internal.flota_rezumat` (lista
albă), `internal.flota_setari_praguri`; de la 0122: `internal.audit_campuri_excluse`.

Numărul eliberat (I-h2) poate sta pe două vehicule neșterse, cel ieșit și cel nou: potrivirea
tranzacțiilor de card (`src/domain/fleet/carduri/potrivire.ts`) alege vehiculul care purta
numărul în ziua tranzacției, după `data_iesire` (`[[modul/flota/carduri]]`).

## Ce NU e aici

Contabilitatea ieșirii (casare, amortizare, TVA), contractul de vânzare, depunerea la
primărie sau la înmatriculări și verificarea automată a transcrierii. PV-ul de restituire
al alocării încheiate rămâne opțional (`[[modul/flota/proces-verbal]]`): secțiunea îl
semnalează, nu-l cere.
