---
tip: modul
titlu: Diurnă — acțiuni și citiri
aliases: [diurna-actiuni, diurna-citiri, per_diem-actions]
cai:
  - "src/app/(app)/diurna/actions.ts"
  - "src/app/(app)/diurna/erori.ts"
  - "src/schemas/per-diem.ts"
  - "src/lib/queries/per-diem.ts"
  - "src/lib/queries/soferi.ts"
  - "supabase/migrations/0015_per_diem.sql"
  - "supabase/migrations/0233_oracol_intre_firme.sql"
tabele: [business_trips, business_trip_legs, trip_expenses, per_diem_policies, vehicles]
permisiuni: [per_diem:create, per_diem:update, per_diem:delete, per_diem:approve]
feature: per_diem
capcane: []
scris_pe: cd77c37564a0a2474dda087e9d2ec85035b57e46
scris_la: 2026-10-25
tags: [modul, hr]
---

# Diurnă — acțiuni și citiri

Secțiuni extrase din [[modul/diurna]]: scrierile modulului și citirile lui. Rutele,
decontul și **ce refuză baza** rămân în trunchi, fiindcă acolo se ajunge dintr-un bug;
politica firmei, calculul zilelor și notificările sunt în [[modul/diurna/legaturi]].

## Server Actions

`src/app/(app)/diurna/actions.ts` — un singur fișier pentru tot modulul.

| Funcție                                                              | Permisiune / minScope     |
| -------------------------------------------------------------------- | ------------------------- |
| `creeazaDeplasare`                                                   | `per_diem:create` / own   |
| `trimiteDeplasare`, `actualizeazaDeplasare`                          | `per_diem:update` / own   |
| `adaugaEtapa`, `stergeEtapa`, `adaugaCheltuiala`, `stergeCheltuiala` | `per_diem:update` / own   |
| `stergeCiornaDeplasare`                                              | `per_diem:delete` / own   |
| `decideDeplasare`, `deconteazaDeplasare`, `decideCheltuiala`         | `per_diem:approve` / team |
| `creeazaPolitica`                                                    | `per_diem:update` / all   |

`creeazaDeplasare` refuză un `employee_id` explicit când scope-ul nu e `all` — o cerere
pentru altcineva se oprește în acțiune, înainte să atingă baza.

`creeazaPolitica` primește **doar ce decide firma**: `diurna_interna_zi`, opțional suma
fixă externă (`diurna_externa_zi` + `moneda_diurna_externa`), `mod_calcul_zile`, pragul unic
`ore_minime`, regula de frontieră, `tarif_km_auto_personal`. Restul le pune acțiunea:
`moneda_tarif_km` = moneda țării interne, `categorie_barem` = `"II"`, ambele praguri de ore =
`ore_minime` (deci `fractiune_zi_partiala` rămâne inoperantă), valorile legale = umplutură,
v. [[modul/diurna/legaturi]].

**`vehicle_id` — mașina de serviciu (flota F9).** `deplasareNouaSchema` îl primește, dar
numai pe `auto_serviciu` ori `mixt`: altfel refuzul e o eroare de validare pe câmp,
oglinda lui `business_trips_vehicul_ck` (`0015_per_diem.sql`). Lista din care se alege
vine de la `vehiculePentruDeplasare` (`src/lib/queries/soferi.ts`) și e goală cu flota
oprită sau fără `vehicles:read` — atunci selectorul nu se randează, deci câmpul lipsește
cu totul din `FormData`. La corectură, `actualizeazaDeplasare` NU trimite `vehicle_id`
când formularul nu-l are (`null` din schemă înseamnă „neatins", nu „șters"); îl golește
doar când transportul nu mai e cu mașina firmei, fiindcă altfel constrângerea ar întoarce
un 23514 de neînțeles. Că mașina e a firmei o verifică `internal.valideaza_deplasare`, cu
P0001, nu cheia străină. V. [[modul/flota/soferi]].

**Ora se citește și se scrie ca ora României.** `plecare_la` și `sosire_la`, la deplasare și
la etapă, trec prin `dataOraRomania` (`src/schemas/comun.ts`); formularele umplu câmpul
invers, cu `oraRomanieiPentruCamp` (`src/lib/format/date.ts`), deci deschis și salvat neatins
reproduce momentul stocat. Înainte, șirul fără fus ajungea neatins în Postgres și era citit
în fusul sesiunii: 15:00 tastat se scria 15:00 UTC și apărea 18:00 pe fișă.

**Refuzurile bazei se întorc pe câmp, nu sub buton.** `adaugaEtapa` traduce P0001-urile lui
`internal.valideaza_etapa_deplasare` în `fieldErrors`: „să se încadreze” pe `plecare_la` +
`sosire_la`, „două țări diferite” pe `to_country_id`. `creeazaPolitica` pune pe
`valabil_de_la` atât 23505 (`per_diem_policies_uk` — o singură versiune pe zi) cât și P0001-ul
valorilor legale. Formularele înroșesc câmpul vinovat și lasă sub buton doar „Corectați
câmpurile marcate”. Din 0233 (§10) triggerul începe cu garda de firmă (42501, și pe firmă
null) și caută deplasarea doar în firma etapei: una inexistentă și una străină dau același
P0001, iar intervalul altei firme nu mai iese în mesaj.

## Citiri

`src/lib/queries/per-diem.ts` (marcat `import "server-only"`): `listeazaDeplasari`,
`citesteDeplasare`, `deplasarileMele`, `etapele`, `cheltuielile`, `calculeSalvate`,
`politicaLaData`, `politiciOrganizatie`, `valoriLegaleDiurna`, `tari`, `baremeleTarilor`,
`baremTara`, `angajatiDupaId`.

`valoriLegaleDiurna` NU ia `organizationId` — `per_diem_valori_legale` e nomenclator global,
ca `tari`; o citește `/diurna/politica` ca să arate plafonul pe care firma nu-l alege.

## Când NU e suficientă pagina asta

- Ce refuză baza fără să spună, rutele și confirmările de pe ecran: [[modul/diurna]].
- Politica firmei, valorile legale, salarizarea și notificările: [[modul/diurna/legaturi]].
- Vehiculul în sine și foaia de parcurs: [[modul/flota/soferi]].
