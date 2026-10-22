---
tip: modul
titlu: Asistent AI — uneltele de flotă
aliases: [unelte flota, scadente_flota, cine_are_masina, propune_foaia_de_azi, F12e]
cai:
  - "src/lib/asistent/unelte/flota/**"
  - "src/lib/queries/flota-asistent.ts"
  - "src/lib/asistent/unelte/poarta.ts"
  - "src/lib/asistent/unelte/tip.ts"
  - "tests/rls/proba-asistent-flota.sql"
tabele:
  [
    vehicles,
    vehicle_documents,
    trip_sheets,
    trip_sheet_curse,
    vehicle_assignments,
    vehicle_reservations,
    vehicle_service_plans,
    vehicle_fines,
    driver_licenses,
    vehicle_consumption_norms,
    vehicle_fiscal_regimes,
  ]
permisiuni:
  [
    vehicles:read,
    trip_sheets:read,
    trip_sheets:create,
    driver_licenses:read,
    vehicle_fines:read,
    vehicle_reservations:read,
  ]
feature: asistent
capcane: [18, 19, 26]
citeste_daca:
  - "asistentul spune „fără foi” sau „nealocată” și omul vede altceva → „Ce refuză baza tăcut”"
  - "cine_are_masina dă alt nume decât sugestia de pe amendă → precedența, mai jos"
scris_pe: bd6c9549d760439f142ae5a6b355e1246d6a36ce
scris_la: 2026-10-22
tags: [modul, nucleu]
---

# Asistent AI — uneltele de flotă

Extensia F12e: uneltele de date ale asistentului pentru parcul auto. Pagina mamă e
`[[modul/asistent]]` (lista închisă, poarta dublă, destinațiile efemere); parcul în sine e
`[[modul/flota]]`. Nicio migrare, nicio scriere: toate citesc prin clientul de sesiune, sub
RLS-ul celui care întreabă.

## Uneltele și poarta lor

| Unealtă                | Întrebarea                                  | Poarta                                         |
| ---------------------- | ------------------------------------------- | ---------------------------------------------- |
| `scadente_flota`       | ce expiră, ce lipsește, revizii, amenzi     | `vehicles:read` own                            |
| `vehicule_fara_foi`    | ce mașini n-au foi luna asta                | `vehicles:read` all ȘI `trip_sheets:read` all  |
| `consum_fata_de_norma` | consumul lunii față de normă                | `trip_sheets:read` team                        |
| `cine_are_masina`      | cine are mașina azi / într-o zi / la o oră  | `vehicles:read` team                           |
| `propune_foaia_de_azi` | caseta „Foaie nouă” precompletată           | `trip_sheets:create` own, fără fișă doar `all` |
| `scadente_soferi`      | permisele care expiră (HR are unealta asta) | `driver_licenses:read` own                     |

A doua cheie a lui `vehicule_fara_foi` stă în `permisiuniSuplimentare` (`tip.ts`), verificată
de `poarta.ts` în ambele treceri: sub `trip_sheets:read = team`, foile altora pe o mașină de
pool sunt invizibile, iar „fără foi” ar fi o afirmație falsă, nu doar incompletă.

`ContextUnealta.zona` (forțată de rută: `employee` → `portal`) decide href-ul destinațiilor
efemere: `vehicul.<id>`, `foaie.<id>` și `propune.foaie.<idVehicul>`, construite doar în
`unelte/flota/comun.ts`. Drumul de click vine din destinația statică a părintelui. O pastilă
`propune.*` deschide caseta (iconița `FilePlus`), iar promptul primește regula „nu spui că ai
creat” DOAR când modelul are `propune_foaia_de_azi`.

## Citiri

`src/lib/queries/flota-asistent.ts`: filtru explicit pe `organization_id` (politicile
flotei au ramura `is_platform_admin`) și `deleted_at is null` în fiecare citire (din 0018,
politicile de SELECT nu-l mai cer), agregări prin `citesteTot`, coloanele de filtru puse și în
`select` (poarta `coloane.test.ts` nu vede `.eq`/`.lte`). Refolosite fără copie: consumul
(`foiAprobateLuna` + `consumPeVehicul`, ale rapoartelor F8), `vehicululMeu`/`listeazaVehicule`
(exact mulțimea casetei), `ocupareaPool`, `setarileRezervarilor`, `permisulAngajatului`,
`angajatiDupaId`, `tipuriDocument`.

## Ce refuză baza tăcut

- **Vizibilitatea parțială nu dă eroare, dă zero rânduri.** Managerul nu vede foaia unui
  coleg din afara echipei pe pool, nici alocarea unui ne-subordonat (`alocari_select` merge pe
  șoferul alocării). De aceea `cine_are_masina` spune „dintre cele pe care le poți vedea” sub
  vizibilitate parțială, iar consumul spune „pe foile echipei tale”.
- **Normele și regimurile fiscale (F10) le vede doar `vehicles:read = all`.** Consumul nu le
  cere pentru manager; norma de rezervă e atunci consumul declarat.
- **Planurile de service (`vsp_select`) cer `vehicles:read >= team`, amenzile cer
  `vehicle_fines:read = all`.** Scadențele nu le citesc altfel și nici nu pomenesc „nicio
  revizie” cuiva care nu le vede.
- **`expirables` îi dă zero rânduri lui manager și angajatului** (capcanele #19, #26):
  documentele se citesc din `vehicle_documents`, doar pe vehiculele din parc.
- **Ocuparea pool-ului e tăiată la azi.** `propune_foaia_de_azi` o citește pe ziua curentă ca
  să nu propună o mașină comună deja ocupată de un coleg (foaie sau rezervare, fără identitate);
  pe o zi trecută funcția nu întoarce nimic.
- **Un nume invizibil nu se inventează**: „un angajat la a cărui fișă nu ai acces”.

## Precedența din `cine_are_masina`

`alegeSoferul` (`calcul.ts`) reproduce `app.sofer_la` (`0206_flota_amenzi_daune.sql`): întâi
cursa nerespinsă care acoperă momentul (fără sosire, până la sfârșitul zilei foii; și foaia de
ieri, pentru cursele de noapte), apoi alocarea `[de_la, pana_la)`. Foaia zilei fără cursă
potrivită vine DUPĂ alocare, ca să n-o contrazică. Fără oră, pe o zi trecută, se enumeră foile
și alocările zilei românești (limitele prin `momentDinOraRomaniei`, zilele de 23 și 25 de ore
incluse). La o divergență câștigă baza: se corectează TS-ul. Răspunsul e o sugestie, nu
desemnarea de la art. 39; locurile curselor nu se citesc deloc.

## Ce se mișcă împreună

- `trip_sheets.data`, `norma_l_100km`, `vehicul_nr` și cursele din 0200 cu
  `flota-asistent.ts` și cu rapoartele F8.
- `app.sofer_la` (0206) cu `alegeSoferul`; `foi_parcurs_inainte` și caseta foii
  (`date-foaie-noua.ts`) cu candidatele lui `propune_foaia_de_azi`.
- Seed-ul de permisiuni cu `context-de-test.ts` și cu `proba-asistent-flota.sql`, care
  numără ce vede fiecare rol din fiecare citire.

## Ce NU e aici

Nicio scriere, niciun `createAdminSupabase`, nicio funcție SECURITY DEFINER nouă. Nici
`vehicle_exits`, nici locurile curselor, nici numărul permisului, nici verdict fiscal: lângă
vehiculul cu deducere integrală stă o propoziție neutră, cu temei, de validat cu contabilul.
