---
tip: modul
titlu: Flotă — documentele vehiculului, nomenclatorul firmei, fișierele și erorile
aliases: [flota-erori, vehicle_document_types, tipuri document vehicul, org-flota]
cai:
  - "src/app/(app)/flota/erori.ts"
  - "src/app/(app)/flota/etichete.ts"
  - "src/app/(app)/flota/[id]/**"
  - "src/app/(app)/flota/setari/documente/**"
  - "src/app/(app)/flota/actions-tipuri.ts"
  - "src/app/(app)/flota/actions-fisiere.ts"
  - "src/app/(app)/flota/incarcare-fisier-flota.tsx"
  - "src/domain/fleet/tipuri-document.ts"
  - "src/domain/fleet/fisiere.ts"
  - "supabase/migrations/0202_flota_tipuri_si_fisiere.sql"
  - "tests/rls/proba-flota-tipuri-fisiere.sql"
tabele:
  [
    vehicle_document_types,
    vehicle_document_type_setari,
    vehicle_documents,
    vehicle_assignments,
    fuel_entries,
  ]
permisiuni: [vehicles:create, vehicles:update]
feature: fleet
capcane: [21]
scris_pe: bdf23c28f5dd664ad437a27a555b034b9f907214
scris_la: 2026-10-23
tags: [modul, operations]
---

# Flotă — documentele vehiculului, nomenclatorul firmei, fișierele și erorile

Extrasă din `[[modul/flota]]`, ca pagina principală să rămână sub plafon.

## Fișa vehiculului

**Fișa vehiculului nu e doar de citit.** Modificarea și ștergerea stau amândouă în spatele
lui `vehicles:update` all — `poateAdministra` din `[id]/page.tsx`, poarta cerută de
`vehicule_update` în bază. Sub ea intră și corectura documentelor din coloana „Acțiuni”.
Pe un rând fără document, aceeași coloană are „+” (`vehicles:create`, cu tipul
preselectat); „Document nou” din capul secțiunii deschide aceeași casetă fără tip (panoul
permanent de sub tabel a fost scos). Pentru cine nu poate nici una, nici alta, coloana
lipsește cu totul. Tabelul listează tipurile ACTIVE ale firmei care SE APLICĂ vehiculului,
plus orice tip pe care vehiculul chiar are un document: obligatoriile întâi (roșu
„Lipsește” când n-au document), apoi opționalele (pastilă neutră „Neînregistrat”); un
document fără dată de expirare e „Fără scadență”, nu „Lipsește”. Sub tabel, „Istoricul
documentelor” arată rândurile înlocuite la reînnoire, cu scanarea lor.

**„Obligatoriu” e al vehiculului, nu al tipului** (0202). `tipuriObligatoriiPentru`
(`src/domain/fleet/scadente.ts`) filtrează după `categorii_aplicabile` și `masa_max_kg`;
lista, fișa și portalul o cheamă toate trei, ca să aprindă aceeași culoare. Seed-ul:
rovinieta până la 3.500 kg, trusa și stingătorul fără remorcă și semiremorcă. ⚠ Plafonul
rovinietei e decizia planului, nu o valoare legală confirmată (OG 15/2002 are categorii
și peste 3,5 t): de confirmat de jurist. Masa necompletată lasă tipul aplicabil
(rovinieta „Lipsește” până se completează masa). Aplicabilitatea NU blochează scrierea —
un document pe un tip neaplicabil trece. Un document pe un tip RETRAS de firmă se
corectează fără să-și schimbe tipul: selectorul casetei primește și tipul lui
(`tipuriPentruDocument`), altfel ar cădea pe „Alegeți tipul”.

**Ieșirea din parc trece prin `actualizeazaVehicul`** (`vehicule_insert` cere `status =
'activ'`): `status` și `motiv_iesire` sunt doar în `actualizeazaVehiculSchema`, cu motiv
obligatoriu la `vandut`/`casat`; `data_iesire` o pune baza. Ștergerea e pentru rândul care
n-ar fi trebuit să existe; `vehicles_dupa` scoate scadențele din semafor.

## Nomenclatorul firmei — `/flota/setari/documente`

Poarta e `vehicles:update` all; tipul nou cere în plus `vehicles:create` all
(`vdt_insert`). `vehicle_document_type_setari` (org, tip, activ, obligatoriu) e DOAR pe
tipuri de platformă: pe un tip propriu baza dă P0001, iar acțiunea refuză înainte.
Valoarea efectivă e `coalesce(setarea, tipul)`, în `aplicaSetariTipuri`
(`src/domain/fleet/tipuri-document.ts`) — aceeași regulă ca `internal.vdoc_inainte`;
un tip retras nu rămâne obligatoriu (`vdts_inainte`). Citirile filtrează explicit
`organization_id is null OR = firma`. Codul tipului propriu vine din denumire
(`codDinDenumire`) și nu se mai schimbă; coliziunea cu un cod de platformă se spune pe
`denumire`. Fără `.upsert()`: unicitatea setării e parțială (capcana #7).

## Fișierele — bucketul `org-flota`

Căi cu patru segmente: `{org}/vehicles/{vehicul}/…` (scanarea) și
`{org}/trip_sheets/{foaie}/…` (bonul). Poarta proprie `app.flota_poate_fisier`, nu
`app.can_path`: citirea după vizibilitatea vehiculului sau a foii; scrierea scanării cu
`vehicles:update` all, a bonului de cine poate scrie foaia, doar pe ciornă. Pe rând,
triggerele cer calea în folderul entității (P0001). Trei pași în `actions-fisiere.ts`
(semnare pe clientul omului → urcare → `masoaraObiectul` + UPDATE cu `.select()`);
`IncarcareFisierFlota` e caseta comună fișei și foii (și în portal). Linkurile se
semnează pe server (`urlSemnateFlota`): cine n-are voie vede „indisponibil”, nu un link.

## Ce refuză baza tăcut

- **Tipul de document se judecă pe setarea FIRMEI** (0202): un tip de platformă retras
  pentru ea dă P0001 la un document nou, iar unul retras din platformă (transportul, 0116) trece dacă firma l-a activat. Calea scanării și a bonului trebuie să stea în
  folderul entității (P0001); bonul se urcă doar pe ciornă. Proba:
  `tests/rls/proba-flota-tipuri-fisiere.sql`.

## Erori traduse

`src/app/(app)/flota/erori.ts` acoperă `23505`, `22012`, `22003` și `P0001`, iar pentru
alocări `traduEroareAlocare` adaugă `23P01`. `22012` (împărțire la zero) apare real: preț
pe litru cu cantitate zero.

**P0001 ajunge pe câmp, nu sub buton.** Mesajele triggerelor se propagă neschimbate —
cifrele din ele se află doar din bază — dar `CAMPURI_DUPA_MESAJ` le potrivește după
ÎNCEPUTUL mesajului, iar `invalidInput` pune `fieldErrors` pe câmpul vinovat. Ce nu se
potrivește rămâne `businessRule`, mesaj general (foaie aprobată, vehicul ieșit din parc).

**Alocările au harta lor** (`CAMPURI_ALOCARE`). În caseta de predare vehiculul e un câmp
ASCUNS: harta foilor ar pune „Vehiculul …” pe `vehicle_id`, iar mesajul s-ar pierde sub
„Corectați câmpurile marcate”. Suprapunerea (`23P01`) cade pe `de_la`, fără `details`, care
are uuid-uri și intervale brute.

Capcana potrivirii: **mesajele funcțiilor din 0012/0018/0172 NErescrise sunt cu s și t cu
SEDILĂ**. Rescrierile din 0199–0202 (foaia, alimentările, documentele, anomalia de km) au
ș/ț cu virgulă; `erori.test.ts` ține cele patru migrări fără sedile. `traduEroare`
aplică `cuVirgula` ÎNAINTEA tiparelor, deci tiparele se scriu pe forma cu virgulă și prind
ambele forme. Un tipar scris pe altă formă decât cea de după `cuVirgula` nu s-ar potrivi
NICIODATĂ, iar eroarea ar cădea tăcut în mesajul general. `erori.test.ts` fixează asta mesaj cu mesaj; `erori-etichete.test.ts` lipește
hărțile din `etichete.ts` de enumurile din `src/schemas/fleet.ts`. Nomenclatorul are harta
lui, `traduEroareTipuri` (23505 pe `vdt_org_cod_uq` și „Codul „…” cu sedilă → `denumire`).

## Nomenclatorul de tipuri de document

`vehicle_document_types` e o TABELĂ, nu un enum — ca primul client de transport să nu
ceară o migrare de platformă. Din rândurile de platformă sunt active doar cele care privesc orice mașină: ITP, RCA,
CASCO, rovinietă, stingător, trusă medicală (din `0116`). Tipul `revizie` a fost retras
de `0203`: revizia are acum planuri de service, cu kilometri și cost
(`[[modul/flota/service-si-costuri]]`); documentele deja scrise pe el rămân. Cele patru de
transport (licență, copie conformă, tahograf, ADR) au `activ = false` pe platformă; din
0202 o firmă și le activează singură, din setări, fără să le vadă celelalte.

Un tip PROPRIU firmei nu poate purta codul unuia de platformă (`vdt_normalizeaza`, 0018 §F6):
`kind`-ul din `expirables` se deduce din `cod`, iar o coliziune ar face două tipuri să scrie
peste aceeași scadență. Dezactivarea nu îngheață documentele existente — de la 0018 §F4,
`vdoc_inainte` revalidează tipul doar la INSERT sau când `document_type_id` chiar se schimbă.

Coloana `numar` a ieșit din interfață. Rămâne în bază, cu valorile deja scrise.
