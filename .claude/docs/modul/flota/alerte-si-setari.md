---
tip: modul
titlu: Flotă — setările, alertele de scadență și notificările foii
aliases: [fleet_settings, conformitate zilnica, responsabil de flota, alerte flota, setari flota]
cai:
  - "supabase/migrations/0198_flota_conformitate_zilnica.sql"
  - "src/app/(app)/flota/actions-setari.ts"
  - "src/app/(app)/flota/setari/**"
  - "src/domain/fleet/setari.ts"
  - "src/app/(portal)/portal/notificarile-mele/legaturi.ts"
  - "src/app/(portal)/portal/notificarile-mele/context.ts"
  - "tests/rls/proba-flota-conformitate-zilnica.sql"
tabele: [fleet_settings, alert_rules, compliance_alerts, alert_notifications, notifications]
permisiuni: [vehicles:read, vehicles:update, trip_sheets:approve]
feature: fleet
capcane: [17, 19]
scris_pe: 00f07559fedbd72745fe0e6be3d631a2c6a2b6f4
scris_la: 2026-10-12
tags: [modul, operations]
---

# Flotă — setările, alertele de scadență și notificările foii

Extrasă din `[[modul/flota]]`. Migrarea: `0198_flota_conformitate_zilnica.sql` (planul o
numea 0175; numerele intermediare s-au ocupat).

## Setările flotei — `/flota/setari`

`fleet_settings`, un rând per firmă (unic PARȚIAL pe `organization_id`, ca
`maintenance_settings`). **Lipsa rândului nu e o eroare**: `setariFlota` întoarce
implicitele coloanelor (1.500 km, 30/14/7), aceleași pe care le aplică baza —
`src/domain/fleet/setari.test.ts` le lipește de migrare.

| Coloană               | Ce face                                                                      |
| --------------------- | ---------------------------------------------------------------------------- |
| `responsabili`        | fișe de angajat; gol = toți `org_admin` activi                               |
| `prag_salt_km`        | înlocuiește rezerva fixă din 0012; `vehicles.prag_salt_km` o bate pe vehicul |
| `praguri_alerta_zile` | oglindite de trigger în `alert_rules` (`vehicle_document`, o versiune pe zi) |

Poarta: citire `vehicles:read` ≠ none (managerul și angajatul citesc — pragul explică
anomaliile), scriere `vehicles:update = all`, deci doar `org_admin`. `super_admin` citește,
nu scrie (politicile cer membru, ca la `vehicles`). `hr` nu vede nimic. Acțiunea
`salveazaSetariFlota` (`actions-setari.ts`): select → INSERT la prima salvare, altfel UPDATE
cu `.select()`; zero rânduri = CONFLICT, iar două prime salvări simultane cad pe
`fleet_settings_org_uq` → CONFLICT (`traduEroareSetari`).

**`alert_rules` nu se scrie din aplicație.** Politica de acolo cere `compliance:*`; triggerul
definer `flota_setari_praguri` e singurul punct de scriere. Un responsabil din altă firmă
dă P0001 „Responsabilul de flotă ales…”, tradus pe câmpul `responsabili`. Pragurile se scriu
ca text („30, 14, 7”); `pragurileDinText` le ordonează descrescător, fără dubluri, ca triggerul.

## Jobul zilnic — `internal.conformitate_zilnica()`

`pg_cron` „conformitate-zilnica”, `0 5 * * *` UTC (08:00 vara, 07:00 iarna). Doar firmele
`pending`/`active`, neanulate, cu `fleet` pornit; fiecare în subtranzacția ei. Pe fiecare:

1. `internal.genereaza_alerte(org)` — semnătura din 0008 NESCHIMBATĂ: o cheamă și jobul
   mentenanței (05:10, alt traseu); `on conflict do nothing` face două joburi idempotente.
2. `internal.flota_rezumat(org)` — lista albă `entity_type = 'vehicle_document'`. **O
   notificare per destinatar și rulare**, cu toate documentele netrimise lui (la prima
   rulare, un rezumat, nu treizeci). Un singur vehicul → `/flota/<id>`; mai multe →
   `/flota?conformitate=expira`, dar `/flota` dacă vreun document e peste 30 de zile
   (filtrul arată doar `PRAG_FLOTA_AVERTIZARE_ZILE`, iar un prag de firmă de 60 le-ar
   ascunde); șoferul fără `team`/`all` → `/portal/masina-mea`.

Destinatari: responsabilii (sau `org_admin`) + șoferul alocat, filtrați pe membru ACTIV și
pe `internal.scope_membru(...,'vehicles','read') <> 'none'`. **Fiecare primește doar
vehiculele pe care le vede** (`internal.flota_vede_vehicul`, geamăna lui
`app.poate_vedea_vehicul` pentru un utilizator dat): un responsabil `manager` (team) nu află
din rezumat numerele și documentele restului parcului, unul `employee` (own) doar pool-ul și
mașina lui. Documentul pe care nu-l vede NICIUN responsabil merge la `org_admin`. (Prima
versiune făcea `elemente × responsabili` și dădea tot parcul oricui era bifat — prins de
santinelă, reparat în revizuire.) Dedup: `alert_notifications`
pe `canal = 'in_app'`. **Un prag nou trecut e o alertă nouă**: schimbarea pragurilor în
60/20/7 retrimite documentele care trec acum pragul nou — e ritmul memento-urilor, nu o
dublură. `curata_alerte` NU se cheamă (e pe toată firma); rezumatul ia doar alertele
scadenței curente (`due_date = expires_at`). Push-ul pleacă singur (trigger 0122).

## Notificările pe fluxul foii — `foi_parcurs_notifica`

AFTER UPDATE OF `status` pe `trip_sheets`; cine face schimbarea nu-și scrie notificare.

- `trimis` → aprobatorii efectivi (`internal.flota_aprobatori_foaie`): responsabilii și
  managerii din `manager_path`, cu `trip_sheets:approve` `all` sau `team` pe lanț. Fără
  niciunul, oricine are `all`. Cu responsabili setați, `org_admin` care nu e printre ei NU
  primește foaia, deși o poate aproba.
- `aprobat`/`respins` → șoferul, cu motivul respingerii. Link `/flota/foi/<id>`.

În portal, `/flota/foi/<id>` se traduce în `/portal/masina-mea/foi/<id>` **doar pentru
șofer** (`foiProprii` din `contexteDestinatar`, citit din `trip_sheets.employee_id`):
aceeași legătură pleacă și la manager, iar foaia altcuiva dă 404 în portal. Fără context,
rândul rămâne text — implicitul sigur al lui `caleaDePortal`.

## Probe

`tests/rls/proba-flota-conformitate-zilnica.sql` (18 verificări: rezumat unic, idempotență,
firma fără flotă, vizibilitate per destinatar, responsabilul cu team/own (12, 17, 18), scriere/refuz pe setări, pragul de salt,
fluxul foii) și `izolare.sql` (l) „setările flotei”. Fixture-ul inserează fișele ÎNAINTEA
membrilor: altfel 0083 îi creează administratorului o fișă și a doua lovește
`employees_org_user_primary_uniq`.
