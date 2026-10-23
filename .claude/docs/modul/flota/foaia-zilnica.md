---
tip: modul
titlu: Flotă — foaia zilnică cu curse, numerotarea și PDF-ul
aliases: [foaia zilnica, trip_sheet_curse, curse, sabloane traseu, foaie de parcurs pdf]
cai:
  - "supabase/migrations/0200_flota_foaia_zilnica.sql"
  - "src/app/(app)/flota/actions-curse.ts"
  - "src/app/(app)/flota/actions-sabloane.ts"
  - "src/app/(app)/flota/foi/[id]/**"
  - "src/app/(app)/flota/foi/sabloane/**"
  - "src/domain/fleet/foaie.ts"
  - "src/lib/pdf/foaie-parcurs.ts"
  - "src/app/api/export/flota/foaie/**"
  - "tests/rls/proba-flota-foaia-zilnica.sql"
  - "tests/rls/proba-flota-stare-foii.sql"
  - "tests/rls/proba-flota-plafoane.sql"
tabele: [trip_sheets, trip_sheet_curse, trip_route_templates, fuel_entries, registru_documente]
permisiuni: [trip_sheets:read, trip_sheets:create, trip_sheets:update, trip_sheets:approve]
feature: fleet
capcane: [17, 22, 23]
scris_pe: 51d9f365e9618a5c1ac95a1a527079d009ab4972
scris_la: 2026-10-22
tags: [modul, operations]
---

# Flotă — foaia zilnică cu curse

Extrasă din `[[modul/flota]]`. Descrie faza F4 a planului „Flotă completă”, din migrarea
`0200_flota_foaia_zilnica.sql`.

Plafoanele (curse, alimentări, șabloane), suprapunerile față de foile declarate, foaia
numerotată ca document emis, gărzile X2 și tabelul stărilor (ce se mai mișcă pe `trimis`,
`respins`, `aprobat`): [[modul/flota/foaia-zilnica-garzi]].

## Modelul

**Foaia e ziua unui vehicul.** `trip_sheets.data` e GENERATĂ din `plecare_la` (ziua în ora
României), iar `ts_vehicul_zi_uq` ține o singură foaie activă pe (vehicul, zi) — fără cele
respinse și cele șterse. A doua foaie a zilei dă 23505, tradus pe `plecare_la`. Consecință
asumată (decizia 1): doi șoferi pe aceeași mașină de pool în aceeași zi nu încap.

**Liniile sunt `trip_sheet_curse`**: ora, de la → la, scopul, km de plecare și de sosire,
`km_parcursi` GENERATED. `ordine` o renumerotează baza, cronologic (`curse_dupa`); clientul
n-o trimite. Locul și scopul sunt obligatorii la scriere (HG 1/2016 pct. 16 alin. (2)).

**Antetul e agregatul curselor.** Pe o foaie CU curse, `foi_parcurs_inainte` rescrie la
orice UPDATE `plecare_la`/`km_plecare` (prima cursă) și `sosire_la`/`km_sosire` (ultima).
Scrise direct, cu altă valoare, dau P0001 („Orele și kilometrajul foii se scriu pe
curse”). `curse_dupa` doar „atinge” antetul; nu există nicio variabilă de sesiune care să
ocolească gărzile. Anomaliile (`foi_parcurs_dupa`), intervalul alimentărilor și registrul
(`col_data = plecare_la`) merg neschimbate. **O foaie fără nicio cursă activă nu se
trimite** (P0001 „Adăugați cursele zilei…”), oricât de completă ar fi sosirea din antet:
ștergerea ultimei curse lasă antetul cu cifrele ei, fiindcă agregatele se rescriu doar cât
există curse (găsit de santinelă la revizia F4; proba `(22)`). Backfill-ul a dat o cursă
fiecărei foi vechi. Tot la trimitere, o alimentare rămasă în afara intervalului curselor
(cursa mutată după alimentare) oprește foaia (proba `(23)`).

**Regulile cursei** (`curse_inainte`, P0001 pe câmp): pleacă în ziua foii și se încheie cel
târziu a doua zi; vecinii cronologici nu se suprapun; km monoton între curse; doar ultima
cursă poate rămâne fără sosire; sosirea e întreagă (oră ȘI km) sau lipsește; același șofer
nu are o cursă suprapusă pe o foaie DECLARATĂ ([[modul/flota/foaia-zilnica-garzi]]). Kilometrii de bord pot depăși
suma curselor („km fără cursă scrisă”): baza nu refuză, ecranul și PDF-ul arată diferența.

**Numărul `FP-AAAA-NNNNN`** îl pune `foi_parcurs_numerotare` (trigger separat, rulează după
gărzi) la draft → trimis, din `document_sequences` (`foaie_parcurs`), doar dacă e null. Se
păstrează la retragere și la respins → retrimis. Clientul nu-l poate scrie. Tot atunci se
ia instantaneul vehiculului: `vehicul_nr`, `vehicul_categorie`, `vehicul_combustibil`,
`norma_l_100km` (din `consum_mediu_declarat` până la F10). Ecranele și PDF-ul îl citesc
înaintea vehiculului de azi. Foile vechi trimise sau aprobate n-au primit număr retroactiv.

## Acțiuni

| Funcție                                                              | Permisiune / minScope      |
| -------------------------------------------------------------------- | -------------------------- |
| `adaugaCursa`, `actualizeazaCursa`, `stergeCursa`                    | `trip_sheets:update` / own |
| `actualizeazaFoaie`, `stergeFoaie` (doar ciorna; numerotată = `all`) | `trip_sheets:update` / own |
| `retrageFoaie` (trimis → draft)                                      | `trip_sheets:update` / own |
| `actualizeazaAlimentare`, `stergeAlimentare`                         | `trip_sheets:update` / own |
| `creeazaSablonTraseu`, `actualizeazaSablonTraseu`, `sterge…`         | `trip_sheets:update` / all |

Cursele stau în `flota/actions-curse.ts`, șabloanele în `flota/actions-sabloane.ts`, restul în `flota/actions.ts`.
`trimiteFoaie` nu mai primește sosirea (o dau cursele) și filtrează pe `status = draft`.
„Adaugă din șablon” e caseta „Cursă nouă” cu selectorul de șablon: precompletează locurile,
scopul și km estimați (`cursaDinSablon`), iar `sablon_id` rămâne doar în audit.

## Ecranele

`/flota/foi/[id]` și `/portal/masina-mea/foi/[id]` folosesc aceeași `SectiuneCurse`
(componentă de server; butoanele de rând sunt client). Pe ciornă: „Cursă nouă”, corectura
și ștergerea pe rând, „Modifică foaia” (ora și km de plecare doar fără curse),
alimentările cu corectură și ștergere, „Trimite spre aprobare”, „Șterge ciorna”. Ciorna
numerotată arată „Anulează foaia” doar sub `update = all`; altfel, textul cui să ceară
anularea (`numar` și `poateAnula` pe `ActiuniFoaie`). Pe trimisă: doar „Retrage în
ciornă”. Lista `/flota/foi` arată ziua și numărul, cu filtrele `de_la` și `pana_la` pe `data` (filtrul pe șofer rămâne `?sofer=`). `/flota/foi/sabloane` cere
`trip_sheets:update = all`, ca politicile.

Trimiterea și alimentarea (`foi/[id]/actiuni-foaie.tsx`) sunt două `<Formular>` separate:
un refuz la alimentare nu înroșește trimiterea, iar valorile tastate rămân (ADM-022).

## PDF-ul

`/api/export/flota/foaie/[id]`: poarta e `trip_sheets:read` own, restul îl decide RLS-ul.
Modelul pur e `modelFoaieParcurs` (`src/domain/fleet/foaie.ts`, cu temeiul legal în cap:
HG 1/2016 pct. 16 și 68, OMFP 2634/2015 anexa 1 pct. 2–3), randarea în
`src/lib/pdf/foaie-parcurs.ts`, peisaj, cu `deseneazaAntet`/`antetOrganizatie`. Documentul
incomplet o spune sus (neaprobat, fără număr, fără normă, cursă fără loc). Nu se
înregistrează a doua oară în registru: o face triggerul la trimitere.

Cursele (`ordoneazaCurse`) și alimentările (`ordoneazaAlimentari`) se ordonează ÎN model, după
oră: pachetul lunar le citește printr-un embed fără `ORDER BY`, ruta foii singure printr-o
interogare ordonată, iar documentul trebuie să iasă la fel din ambele căi.

**Orele foilor sunt ora României.** `plecare_la`, `sosire_la` și `alimentat_la` trec prin
`dataOraRomania` și ies în UTC; formularele umplu câmpul cu `oraRomanieiPentruCamp`. Cu
`z.iso.datetime({ local: true })`, 15:00 tastat apărea 18:00.

## Probe

`proba-flota-stare-foii.sql` (D1/D2, fără tabelele noi; pică 8/17 peste 0199) și
`proba-flota-foaia-zilnica.sql` (curse, numerotare, unicitate, suprapuneri, șabloane,
`hr`/`super_admin`) și `proba-flota-plafoane.sql` (plafoanele, renumerotarea, foaia
numerotată și registrul, suprapunerile față de foile declarate, indexul GiST, contorul
dat înapoi, refuzul fără date pentru coleg și pentru altă firmă).
`izolare.sql`: fixture pentru cele două tabele noi și blocul „foaia zilnică cu curse (0200)”
din `(l)`. Probele vechi de flotă își țin foile pe zile diferite.
