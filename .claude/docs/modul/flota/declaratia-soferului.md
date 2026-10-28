---
tip: modul
titlu: Flotă — declarația șoferului, amenzile în rezumatul zilnic și pe fișa vehiculului
aliases:
  [
    declaratie incident,
    declaraIncident,
    declarat_de_employee_id,
    incidente_inainte,
    vehicul_al_meu_la,
    flota_destinatari_cheie,
    incidente_notifica,
    rezumat amenzi,
  ]
cai:
  - "supabase/migrations/0206_flota_amenzi_daune.sql"
  - "src/app/(portal)/portal/masina-mea/page.tsx"
  - "src/app/(portal)/portal/masina-mea/dialog-declaratie-incident.tsx"
  - "src/app/(app)/flota/amenzi/prezentare-vehicul.tsx"
  - "src/app/(app)/flota/amenzi/sectiune-vehicul.tsx"
  - "tests/rls/proba-flota-declaratie-incident.sql"
  - "tests/rls/proba-flota-rezumat-amenzi.sql"
tabele:
  [
    vehicle_incidents,
    vehicle_fines,
    employees,
    expirables,
    compliance_alerts,
    alert_notifications,
    notifications,
  ]
permisiuni: [vehicle_incidents:create, vehicle_incidents:read, vehicle_fines:read]
feature: fleet
capcane: [6, 17, 19, 26]
scris_pe: f437506578f23173e26c942102cdd3ddd2d109c8
scris_la: 2026-10-28
tags: [modul, operations]
---

# Flotă — declarația șoferului, amenzile în rezumat și pe fișa vehiculului

Extrasă din `[[modul/flota/amenzi-si-daune]]` (pagina aceea era la plafon). Trei decizii
din 21 oct 2026, toate în `0206_flota_amenzi_daune.sql` (§F, §G), editată pe loc fiindcă
nu e aplicată nicăieri — tot pe loc a intrat și revizia X2 din trigger (garda de firmă și
fișa vie a șoferului).

## Declarația șoferului din „Mașina mea” (§F)

| Ce                                                             | Unde                                                                        |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Cheia `vehicle_incidents:create = own`, seed pentru `employee` | 0206 §1 (singura cheie de amenzi/incidente în afara admin.)                 |
| Caseta „Declar un incident” + „Incidentele declarate de mine”  | `/portal/masina-mea` (`?incident=nou` o deschide, `?incidente=` = cursorul) |
| Acțiunea `declaraIncident` (`create` / own)                    | `src/app/(app)/flota/actions-amenzi.ts`                                     |
| Citirea `declaratiileMele` (`incidente_declarate_de_mine`)     | `src/lib/queries/flota-amenzi.ts`                                           |

**Ce face baza, nu aplicația:** triggerul `internal.incidente_inainte` pune
`declarat_de_employee_id` și `sofer_id` = `app.fisa_mea` pentru cine are `create` ≠ all și
refuză cu P0001 („Vehiculul ales nu vă era alocat în ziua incidentului…”, tradus pe
`vehicle_id`) vehiculul care nu e pool și nu era alocat fișei lui în ziua incidentului, ora
României — aceeași regulă ca foaia (0199 §C1), prin `app.vehicul_al_meu_la`. Politica de
INSERT o verifică încă o dată și refuză (42501) costurile, asigurătorul, dosarul și
cercetarea: le scrie responsabilul. WITH CHECK vede rândul de DUPĂ trigger — capcana #6.
Declarantul nu se mai schimbă la UPDATE (triggerul îl fixează la valoarea veche). Un
administrator nu declară în numele altuia (P0001 „Declarantul unui incident…”).

**Garda de firmă e prima (revizia X2):** un rând trimis pe altă firmă cade cu 42501 („Nu
aveți dreptul de a înregistra incidente în această organizație.”) înaintea oricărei
căutări din trigger. Fără ea, triggerul BEFORE — care rulează înaintea lui WITH CHECK,
capcana #6 — deosebea prin refuz vehiculul și fișa care EXISTĂ în firma victimei (P0001
din trigger, apoi 42501 din politică) de cele inexistente. Verificarea (5) a probei cere
exact asta: P0001 în firma lui, 42501 în firma străină. Tot din X2, `sofer_id` trebuie să
fie o fișă VIE a firmei, judecată la INSERT și la fiecare schimbare a coloanei: cheia
străină compusă `vi_sofer_fk` prinde doar firma, nu și ștergerea logică, deci o fișă
ștearsă trecea. Un singur mesaj pentru „nu există”, „e ștearsă” și „e în altă firmă”
(P0001 „Șoferul incidentului nu există…”), ca refuzul să nu fie o sondă între firme; o
desemnare veche rămâne valabilă dacă fișa e ștearsă ulterior. Șoferul nu o atinge — ramura
`own` îi pune `sofer_id` = `app.fisa_mea`; bate pe responsabilul care scrie coloana din
`/flota/incidente`. Amenzile au primit garda identică, pe `sofer_desemnat_id`
([[modul/flota/amenzi-si-daune]]).

**Ce vede șoferul:** RÂNDUL incidentului deloc — `vehicle_incidents_select` e doar
`read = all` (pachetul X1: RLS-ul taie rânduri, nu coloane, iar fosta ramură `own` îi
dădea prin PostgREST costurile, despăgubirea, asigurătorul, dosarul, observațiile și
cercetarea SSM). Declarațiile lui vin din `public.incidente_declarate_de_mine` (DEFINER):
doar câmpurile declarației, stadiul și închiderea, cât are încă cheia `create`, după fișa
PRINCIPALĂ (`app.fisa_mea`); keyset pe (`produs_la`, `id`), iar `total` numără tot. Nu
incidentele colegilor, nu pe cel înregistrat de administrator pe mașina lui, nicio amendă.
Nu modifică nimic (update = none, zero rânduri). O suprascriere pe membru `create = none`
îi ia și declararea, și lista. **De aici: INSERT-ul șoferului nu cere `RETURNING`** —
`declaraIncident` pune singură id-ul; un `.select()` ar cădea cu 42501 pe fiecare
declarație.

**Notificarea:** `internal.incidente_notifica` (AFTER INSERT, doar rânduri cu declarant)
scrie o notificare `warning` cu legătura `/flota/incidente/<id>` către
`internal.flota_destinatari_cheie(org, 'vehicle_incidents')`: responsabilii de flotă care
citesc incidentele la `all` (`internal.scope_membru`), altfel administratorii activi care le
citesc. Un responsabil `manager` fără cheie NU o primește. Push-ul pleacă singur (0122).

`manager` NU are cheia (decizia a numit doar `employee`); o firmă o poate acorda prin
suprascriere.

## Termenul amenzii în rezumatul zilnic (§G)

`internal.flota_rezumat` e rescrisă de la forma 0203 §11 cu `vehicle_fine` în lista albă.
Rândul din `expirables` poartă id-ul AMENZII, deci vehiculul vine prin `vehicle_fines`.
Destinatarii amenzii: `internal.flota_destinatari_cheie(org, 'vehicle_fines')` — șoferul
alocat primește în continuare documentele mașinii, nu și amenda; `flota_vede_vehicul` nu se
aplică (cine citește amenzile le vede pe toate). Titlul numără „amendă de răspuns în
curând” / „cu termenul de răspuns trecut”; legătura: o singură amendă → `/flota/amenzi/<id>`
(`entity_type = vehicle_fine`), mai multe → `/flota/amenzi?stadiu=de_raspuns`, amestec cu
documente → regula din 0203. Pragurile sunt cele implicite (30/14/7,
`internal.praguri_implicite`): `fleet_settings.praguri_alerta_zile` se oglindește doar pe
documente și service. Dedup: `alert_notifications`, `canal = 'in_app'`; după „răspuns
trimis” scadența iese din `expirables`, deci și din rezumat. Fără amenzi, textul și
legăturile sunt cele din 0203.

## Fișa vehiculului: amenzile și incidentele lui (`/flota/[id]`)

`SectiuneAmenziVehicul` (server) citește ultimele 5 prin `listeazaAmenzi` /
`listeazaIncidente` cu `vehicul`, iar `PrezentareAmenziVehicul` (pură, probată în happy-dom)
le arată, cu legături spre fișe și spre `/flota/amenzi?vehicul=` și
`/flota/incidente?vehicul=`. Fiecare parte apare DOAR cu `vehicle_fines:read` /
`vehicle_incidents:read` = all; altfel lipsește cu totul (un tabel gol ar minți „n-a avut
amenzi”). HR nu are cheile (decizie) și nici parcul.

## Probe

`tests/rls/proba-flota-declaratie-incident.sql` (14 verificări: mașina lui, pool, mașina
colegului, ziua fără alocare, firma străină, costurile, vizibilitatea, amenzile închise,
notificarea și căderea pe administratori, suprascrierea pe membru) și
`tests/rls/proba-flota-rezumat-amenzi.sql` (destinatarii, a doua rulare, firma fără
responsabili, legăturile, ieșirea după răspuns). Pe forma 0203 a rezumatului, a doua pică
la (1), (6), (7), (7b); fără seed-ul `employee`, prima pică la nouă verificări. (7b)
deosebește notificarea nouă după `id`, nu după `created_at`: în tranzacția probei ambele au
același `now()`, iar `order by created_at desc, id desc` (id aleator) o pica la întâmplare,
cam o rulare din trei, fără legătură cu funcția (revizia A5).
