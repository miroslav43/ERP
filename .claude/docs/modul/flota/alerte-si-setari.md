---
tip: modul
titlu: Flotă — setările, alertele de scadență și notificările foii
aliases: [fleet_settings, conformitate zilnica, responsabil de flota, alerte flota, setari flota]
cai:
  - "supabase/migrations/0201_flota_conformitate_zilnica.sql"
  - "supabase/migrations/0203_flota_service_costuri.sql"
  - "supabase/migrations/0206_flota_amenzi_daune.sql"
  - "src/app/(app)/flota/actions-setari.ts"
  - "src/app/(app)/flota/setari/**"
  - "src/domain/fleet/setari.ts"
  - "src/app/(portal)/portal/notificarile-mele/legaturi.ts"
  - "src/app/(portal)/portal/notificarile-mele/context.ts"
  - "tests/rls/proba-flota-conformitate-zilnica.sql"
tabele:
  [
    fleet_settings,
    alert_rules,
    compliance_alerts,
    alert_notifications,
    notifications,
    vehicle_reservations,
  ]
permisiuni: [vehicles:read, vehicles:update, trip_sheets:approve, vehicle_reservations:read]
feature: fleet
capcane: [17, 19]
scris_pe: c1ad3b039681d8b4d5f1f466c0c2a4e7f3ab67f8
scris_la: 2026-10-24
tags: [modul, operations]
---

# Flotă — setările, alertele de scadență și notificările foii

Extrasă din `[[modul/flota]]`. Migrarea: `0201_flota_conformitate_zilnica.sql` (planul o
numea 0175; numerele intermediare s-au ocupat).

## Setările flotei — `/flota/setari`

`fleet_settings`, un rând per firmă (unic PARȚIAL pe `organization_id`, ca
`maintenance_settings`). **Lipsa rândului nu e o eroare**: `setariFlota` întoarce
implicitele coloanelor (1.500 km, 30/14/7), aceleași pe care le aplică baza —
`src/domain/fleet/setari.test.ts` le lipește de migrare.

| Coloană               | Ce face                                                                            |
| --------------------- | ---------------------------------------------------------------------------------- |
| `responsabili`        | fișe de angajat; gol = toți `org_admin` activi                                     |
| `prag_salt_km`        | înlocuiește rezerva fixă din 0012; `vehicles.prag_salt_km` o bate pe vehicul       |
| `praguri_alerta_zile` | oglindite de trigger în `alert_rules`, o versiune pe zi (lista tipurilor, mai jos) |

Poarta: citirea ȘI scrierea cer `vehicles:update = all`, deci doar `org_admin`;
`super_admin` citește, nu scrie (politicile cer membru, ca la `vehicles`). Managerul și
angajatul citesc ZERO rânduri, fără eroare: citirea nu stă pe `vehicles:read`, pe care
din F3 îl are orice angajat (`own`). Cititorii neadministrativi sunt doi, amândoi prin
RPC-uri înguste, niciodată prin tabelă: fișa vehiculului, care afișează pragul de salt —
un singur număr, prin `public.flota_prag_salt_km(vehicul)`, gardată pe vizibilitatea
vehiculului (`pragSaltVehicul` în `fleet.ts`) — și, din 0216, ecranele rezervărilor, prin
`public.setarile_rezervarilor(organizatie)`: cele trei setări ale rezervărilor pentru orice
membru al firmei, niciodată responsabilii sau pragurile (`setarileRezervarilor` în
`fleet-rezervari.ts`). `setariFlota` întoarce implicitele cui nu citește tabela, nu valoarea
firmei. `hr` nu vede nimic. Acțiunea
`salveazaSetariFlota` (`actions-setari.ts`): select → INSERT la prima salvare, altfel UPDATE
cu `.select()`; zero rânduri = CONFLICT, iar două prime salvări simultane cad pe
`fleet_settings_org_uq` → CONFLICT (`traduEroareSetari`).

**`alert_rules` nu se scrie din aplicație.** Politica de acolo cere `compliance:*`; triggerul
definer `flota_setari_praguri` e singurul punct de scriere. Oglindește aceleași praguri pe
`kind = '*'` și pe `vehicle_document`, `vehicle_service` (0203), `fuel_card` (0214) și
`vehicle_exit` (0218) — forma ULTIMĂ a funcției stă în 0218, de acolo pornește orice
adăugare. `vehicle_fine` nu are regulă oglindită: alertele amenzii cad pe regula `'*'` a
firmei sau pe `internal.praguri_implicite()`. Un responsabil din altă firmă
dă P0001 „Responsabilul de flotă ales…”, tradus pe câmpul `responsabili`. Pragurile se scriu
ca text („30, 14, 7”); `pragurileDinText` le ordonează descrescător, fără dubluri, ca triggerul.

Din 0216 §2 aceeași tabelă ține și cele trei setări ale rezervărilor de pool
(`rezervari_cu_aprobare`, `rezervare_obligatorie`, `rezervari_max_zile`), sub ACEEAȘI poartă
și în același formular: `salveazaSetariFlota` își extinde schema cu `campuriSetariRezervari`
(`src/schemas/fleet-rezervari.ts`), iar auditul și `revalidate` le urmează. OBLIGATORII, nu
cu implicit: o salvare care le-ar omite le-ar readuce tăcut la valorile de plecare. O bifă
nebifată LIPSEȘTE din `FormData`, deci formularul trimite `false`, nu câmpul absent.
Cererile `ceruta` neexpirate le numără `numarRezervariDeAprobat(org, null, azi)` — fișa pe
`null`, deci intră și cererile administratorului — iar formularul spune pe față că rămân de
decis: oprirea aprobării nu le confirmă. Regulile lor: [[modul/flota/rezervari]].

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

Din 0203 lista albă a rezumatului are și `vehicle_service` (planurile de service cu dată; formulare
„scadent”, titlu cu „lucrări de service”, legătură spre `?fila=service` când tot rezumatul e de service), iar
jobul cheamă și `internal.flota_memento_service` (alerta pe kilometri, anvelopele din
noiembrie): `[[modul/flota/service-si-costuri]]`. Destinatarii vin dintr-un singur loc,
`internal.flota_destinatari`.

Din 0206 §G lista albă are și
`vehicle_fine`, termenul de răspuns al amenzii: merge DOAR la cine citește amenzile la `all`
(`internal.flota_destinatari_cheie`), niciodată la șofer —
`[[modul/flota/declaratia-soferului]]`. 0214 adaugă `fuel_card`
(`[[modul/flota/carduri]]`), iar 0218 `vehicle_exit`, doar pentru `vehicles:read = all`
(`[[modul/flota/iesire]]`). Forma ULTIMĂ a lui `internal.flota_rezumat` stă azi în 0218: de
acolo pornește orice rescriere (grep pe toate migrările), nu din 0206.

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

Din 0216, `/flota/rezervari` (de la `rezervari_notifica`) stă în `FIXE`: se traduce în
`/portal/masina-mea/rezervari` fără context — notificarea aceea pleacă oricum numai la
angajatul rezervării. Coada aprobatorilor, `/flota/rezervari?stare=ceruta`, rămâne text:
`FIXE` se potrivește pe linkul ÎNTREG.

## Probe

`tests/rls/proba-flota-conformitate-zilnica.sql` (rezumat unic, idempotență, firma fără
flotă, vizibilitate per destinatar, responsabilul cu team/own, scriere/refuz pe setări,
citirea închisă managerului și angajatului, pragul de salt prin funcția îngustă, fluxul
foii) și `izolare.sql` (l) „setările flotei”. Cele trei setări ale rezervărilor nu sunt
probate aici, ci în `tests/rls/proba-flota-rezervari.sql`. Fixture-ul inserează fișele ÎNAINTEA
membrilor: altfel 0083 îi creează administratorului o fișă și a doua lovește
`employees_org_user_primary_uniq`.
