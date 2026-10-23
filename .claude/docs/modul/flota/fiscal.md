---
tip: modul
titlu: Flotă — fiscalul: regimul de deducere, norma de consum, avantajul în natură
aliases:
  [
    vehicle_fiscal_regimes,
    vehicle_consumption_norms,
    regim_impozitare,
    avantaj in natura,
    deducere 50%,
    flota_fiscal_luna,
  ]
cai:
  - "supabase/migrations/0205_flota_fiscal.sql"
  - "src/app/(app)/flota/actions-fiscal.ts"
  - "src/app/(app)/flota/fiscal/**"
  - "src/domain/fleet/fiscal.ts"
  - "src/lib/queries/flota-fiscal.ts"
  - "src/schemas/flota-fiscal.ts"
  - "tests/rls/proba-flota-fiscal.sql"
  - "supabase/migrations/0225_flota_costuri_ascunse.sql"
tabele:
  [vehicle_fiscal_regimes, vehicle_consumption_norms, organizations, trip_sheets, vehicle_costuri]
permisiuni: [vehicles:read, vehicles:update, organizations:update, payroll:read]
feature: fleet
capcane: [17, 23]
scris_pe: 9db525aeb5cc48094f85f4fe37b4a424e68ed3f8
scris_la: 2026-10-23
tags: [modul, operations, fiscal]
---

# Flotă — fiscalul: regimul de deducere, norma de consum, avantajul în natură

Extrasă din `[[modul/flota]]`. Migrarea: `0205_flota_fiscal.sql` (planul n-a dat număr; cele
intermediare s-au ocupat). Temeiurile legale și tot ce rămâne de confirmat cu contabilul
(marcat ⚠️) sunt în `NOTES.md`, secțiunea „Flotă — fiscal”. Regula de fond: **fiscalul e
SUGESTIE**. Aplicația nu scrie nimic pe statul de plată și nu încadrează vehiculul în locul
firmei.

## Rute și cine ajunge

| Rută / ecran                                        | Poartă                                                          |
| --------------------------------------------------- | --------------------------------------------------------------- |
| `/flota/fiscal`                                     | `vehicles:read = all` — luna fiscală și regimul de impozitare   |
| Secțiunea „Fiscal” de pe `/flota/[id]`              | `vehicles:read = all` vede, `vehicles:update = all` scrie       |
| „Avantaj în natură” pe `/angajati/[id]`             | `payroll:read = all` (aceeași poartă ca secțiunea „Salarizare”) |
| Regimul de impozitare al firmei, pe `/flota/fiscal` | `organizations:update = all` scrie; ceilalți îl citesc ca text  |

Managerul și angajatul **văd vehiculul, nu și fiscalul lui**: tabelele fiscale cer
`vehicles:read = all` pe SELECT, deci pentru ei întorc zero rânduri, fără eroare, iar
ecranul nu le montează secțiunea (nu un tabel gol care ar spune „n-are regim”). `hr` n-are
parcul (decizia 3), dar face statul de plată: de aceea avantajul trece printr-o funcție
SECURITY DEFINER proprie, nu printr-un drept pe vehicule. Luna fiscală îi întoarce zero
rânduri și când conduce o mașină a firmei.

## Ce face fiecare piesă

- **Regimul vehiculului pe perioade** (`vehicle_fiscal_regimes`): `limitat_50`,
  `integral_exclusiv_economic`, `exceptat_categorie` (cu categoria din art. 25 alin. (3)
  lit. l) pct. 1–5) și `peste_3500_sau_9_locuri`, plus titlul de folosință (proprietate,
  leasing, închiriat, mașină personală în comodat sau cu chirie). **Regimul în vigoare la o
  zi** = perioada cu cel mai mare `valabil_de_la` ≤ zi. **Corectura e ștergere logică +
  perioadă nouă**; nu există acțiune de modificare.
- **Norma proprie de consum** (`vehicle_consumption_norms`): trimiterea foii o ia din
  ziua foii (`internal.foi_parcurs_numerotare`, rescrisă de la forma din 0200), altfel
  cade pe `consum_mediu_declarat`. Foile deja trimise își păstrează norma din instantaneu.
- **Luna fiscală** (`public.flota_fiscal_luna`, SECURITY INVOKER): zilele lunii cu
  deducere integrală, norma, foile aprobate și neaprobate. Zilele se numără pe zile, **foile
  pe luna întreagă** (⚠ în `NOTES.md`). Verdictul („deducere integrală fără nicio foaie”) îl
  dă domeniul pur, `verdictLuna` — nu SQL-ul. Vehiculul trece și prin
  `app.poate_vedea_vehicul` (scope-ul lui `vehicles:read`), nu doar prin politica
  `vehicule_select`: ramura „decizia 3” din 0215 îi arată lui `hr` mașina lui în „Mașina
  mea”, nu și în raportul fiscal (moștenită, ar fi dat un rând fals, „fără regim” toată
  luna). O rescriere a funcției păstrează filtrul.
- **Avantajul în natură** (`public.avantaj_natura_flota`, SECURITY DEFINER pe
  `payroll:read = all`): alocările cu folosință personală ale unui om într-o lună și faptele
  vehiculului. Ce se sugerează decide `sugereazaAvantaj`: 1,7% din valoarea de intrare sau
  chiria; nimic la 50%, la firmă micro/specific sau la mașina personală.
- **Excepția intenționată de la costurile ascunse.** Valoarea de achiziție stă în
  `vehicle_costuri` (0225), pe care hr nu o vede. Funcția avantajului o întoarce totuși
  (`valoare_intrare`) cui are `payroll:read = all` — org_admin și hr —, dar DOAR pe
  vehiculele alocate angajatului cerut CU folosință personală în luna cerută: e baza
  legală a avantajului (Codul fiscal art. 76 alin. (3) lit. j), nu o fereastră spre
  costurile parcului. Mașina alocată fără folosință personală nu apare. Confirmat
  empiric, fără schimbare: `proba-costuri-compatibilitate.sql` (3) și celula
  „avantaj_natura_flota(E1) cu valoare” din `proba-flota-matrice-roluri.sql`.

## Ce refuză baza tăcut

- **Fără drept de citire pe tabelele fiscale = zero rânduri, fără eroare.** Pagina cere
  `vehicles:read = all` tocmai ca să nu arate „niciun regim” cuiva care doar nu-l vede.
  Același lucru la `avantaj_natura_flota`: cine nu are `payroll:read = all` primește listă
  goală, iar cardul de pe fișă nu se randează.
- **Un UPDATE respins de USING afectează zero rânduri.** `stergeRegimFiscal`,
  `stergeNormaConsum` și `salveazaRegimImpozitare` fac `.select("id")` după scriere, iar
  rezultatul gol e CONFLICT. Regimul de impozitare e o coloană pe `organizations`: o scrie
  doar `org_admin`, prin politica existentă; `guard_organizations` (0002) readuce numai
  coloanele platformei.
- **Două perioade în aceeași zi pe vehicul** dau 23505 pe `vfr_vehicul_de_la_uq` /
  `vcn_vehicul_de_la_uq`, traduse pe `valabil_de_la`. Regimul „peste 3.500 kg” pe un
  vehicul pe care fișa îl știe ușor dă P0001 pe `regim`, **doar la INSERT/UPDATE de conținut,
  nu și la ștergerea logică** (`new.deleted_at is null`): fișa se poate completa după ce
  regimul a fost pus pe o fișă incompletă, iar corectura „șterge + perioadă nouă” nu trebuie
  să cadă exact pe rândul greșit (proba (18)). Invers (50% la un vehicul greu) e doar
  avertisment pe ecran, fiindcă e prudent, nu riscant.
- **`created_by` și `updated_by` se trimit explicit** la INSERT (capcana #23), ca la restul
  tabelelor flotei; fără ele, 42501.

## Citiri și erori

`src/lib/queries/flota-fiscal.ts` (`server-only`): `regimurileVehiculului`,
`normeleVehiculului`, `lunaFiscala`, `regimImpozitareFirma`, `avantajeNaturaAuto`. Fișier
separat de `fleet.ts`, pe care îl scriu și alte faze. Generatorul de tipuri dă coloanele unui
`returns table` ca NON-null; `lunaFiscala` și `avantajeNaturaAuto` le copiază într-un tip
cu nullabilitatea adevărată. Mesajele P0001 și restricțiile tabelelor sunt traduse de
`traduEroareFiscal` (`erori.ts`), pe câmpul vinovat.

## Ce se mișcă împreună

Migrarea → `src/types/database.ts` → `src/schemas/flota-fiscal.ts` →
`src/domain/fleet/fiscal.ts` (enum-urile sunt oglindite de mână; testul le lipește de
migrare) → citiri → `actions-fiscal.ts` → ecranele din `flota/fiscal/`. Ruta nouă e
înregistrată în `porti-ruta.ts`, `file-module.ts`, destinațiile asistentului și e2e.
Verdictul „deducere integrală fără foi” are o singură formulă, `verdictLuna`: orice raport
nou o refolosește, nu o rescrie.

## Ce NU e aici

Proporționarea pe zile sau pe kilometri personali (km personali nu se înregistrează),
decontul mașinii personale, categoria omologată a vehiculului și orice scriere automată pe
statul de plată: toate rămân la contabil, cu ⚠️ în `NOTES.md`. Amenzile și daunele sunt
fază separată.
