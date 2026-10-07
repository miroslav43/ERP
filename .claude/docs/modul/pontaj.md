---
tip: modul
titlu: Pontaj
aliases: [attendance, prezenta]
cai:
  - "src/app/(app)/pontaj/**"
  - "src/app/api/export/pontaj/arhiva/**"
  - "src/lib/queries/attendance.ts"
  - "src/lib/queries/pontaj-arhiva.ts"
  - "src/schemas/attendance.ts"
  - "src/domain/attendance/**"
  - "src/domain/reges/absente.ts"
tabele:
  [
    attendance_periods,
    attendance_entries,
    attendance_settings,
    attendance_approval_batches,
    attendance_week_submissions,
    attendance_week_submission_days,
    setari_pontare_rapida,
    puncte_lucru,
    contract_suspendari,
  ]
permisiuni:
  [
    attendance:read,
    attendance:create,
    attendance:update,
    attendance:approve,
    departments:update,
    employees:update,
  ]
feature: attendance
capcane: [2, 6, 7, 9, 17]
citeste_daca:
  - "buton de aprobare care nu apare → [[rol/manager]]"
  - "tranziție de perioadă respinsă → [[date/pontaj]]"
  - "zi respinsă pentru contract suspendat → [[modul/reges]]"
scris_pe: 81081549cb2cb8ebe26b396c7e7ea56df1678591
scris_la: 2026-10-07
tags: [modul, hr]
---

# Pontaj

Evidența zilnică a prezenței, pe perioade lunare care se deschid, se aprobă în loturi și
se blochează. Are trei fluxuri paralele: **ziua** (`attendance_entries`, interval
completat de mână prin `salveazaZiPontaj`), **săptămâna planificată**
(`attendance_week_submissions`, trimisă de angajat și decisă de manager) și
**pontarea rapidă** (`0096_pontaj_rapid.sql` — ceas „Am intrat"/„Am ieșit" sau
confirmarea zilei standard, apăsate din portal, scrise tot în `attendance_entries` cu
`sursa = pontare_rapida`). Care dintre ele îi e deschisă angajatului o decide **varianta
de pontaj** a firmei (`setari_pontare_rapida.varianta_pontaj`, 0165): pe `zilnic` toate
trei, pe `saptamanal` doar fișa săptămânii.

## Paginile modulului

Pagina asta e trunchiul; restul s-a spart pe subarborele de rute
(`.claude/docs/meta/conventii.md`).

| Pagină                     | Ce ține                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [[modul/pontaj/actiuni]]   | Server Actions, citirile din `queries/attendance.ts`, ce se mișcă împreună la o schimbare de formă a zilei de pontaj |
| [[modul/pontaj/saptamana]] | fișa săptămânii — plan sau pontaj, după variantă: RPC-ul cu `delete` + reinserare, scrierea în pontaj, plan ↔ fapt   |
| [[modul/pontaj/setari]]    | pontarea rapidă (0115), varianta de pontaj (0165), aprobarea ca alegere a firmei (0118), limitele legale             |

## Rute și cine ajunge

| Rută                       | Poartă                                                                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/pontaj`                  | `attendance:read` cu scope citit prin `scopeFor`; `approve` team și `update` all pentru butoanele lor; scrierea are DOUĂ porți, mai jos                                       |
| `/pontaj?vizualizare=…`    | aceeași poartă; vezi „Cele trei vizualizări" mai jos                                                                                                                          |
| `/pontaj/aprobare`         | `attendance:approve` team; blocarea cere `all`                                                                                                                                |
| `/pontaj/perioade`         | `attendance:approve` team/all, `attendance:create` all                                                                                                                        |
| `/pontaj/perioade/[id]`    | `attendance:read` team                                                                                                                                                        |
| `/pontaj/saptamana`        | `attendance:create` own; decizia cere `approve` team; titlul, săptămâna implicită (`saptamanaImplicita`) și navigarea înainte (`existaSaptamanaUrmatoare`) depind de variantă |
| `/pontaj/setari`           | `attendance:update` all — fila **Pontarea**: `varianta_pontaj`, `mod_pontare_rapida`, `verificare_pontare`, `program_start`                                                   |
| `/pontaj/setari/reguli`    | `attendance:update` all — fila **Regulile de timp**: parametrii juridici versionați                                                                                           |
| `/pontaj/setari/coduri-qr` | `departments:update` all — fila **Coduri QR**: poarta SECRETULUI, ca afișul din `puncte-lucru`                                                                                |

Toate trec întâi prin `requireFeature(tenant.organizationId, "attendance")`.

**Două porți de scriere, nu una.** `poatePontaSine` e `attendance:create` la `own` —
butonul „Pontează-te" din antet (duce în `/pontaj/saptamana`) și grila proprie.
`poateEdita` e FOAIA: `create` la SCOPE-UL DE CITIRE. Un `manager` citește `team` dar
creează doar `own` (0161), deci foaia colectivă îi rămâne read-only, exact ca RLS — cu o
singură poartă, celulele subordonaților ar fi devenit apăsabile și ar fi răspuns cu
refuz. „Sincronizează concediile aprobate" (`ButonSincronizareConcedii`, mutat în antetul
foii, lângă cel din `/pontaj/aprobare`) cere `create` la `all` ȘI modulul `leave`.

**Codurile QR nu se deschid cu cheia pontajului.** Fila `/pontaj/setari/coduri-qr` cere
`departments:update` la `all`, ca afișul din `puncte-lucru/[id]/afis`: cine vede codul poate
ponta de oriunde, deci poarta e a SECRETULUI, nu a modulului din care se întâmplă să fie privit.
Se verifică în pagină, ÎNAINTEA citirii `coduriQrDePontare` — soră cu `afiseDePontare`, care
rămâne fără `cod_pontaj` fiindcă ecranului ei îi ajunge „are cod / n-are cod". Codul citit nu
traversează granița: devine SVG pe server. De aceea antetul are două drumuri cu porți DIFERITE
(`ButonSetariPontaj`, `poateVedeaCoduriQr` din `file-pontaj.ts`) — compuse într-un boolean, un
rol ar fi căpătat un buton care duce la un refuz.

**Luna se naște deschisă** (`0132_pontaj_luni_deschise_implicit.sql`): rândul din
`attendance_periods` îl creează `internal.pontaj_perioada_lunii` la prima scriere, deci nu
mai există „lună nedeschisă" care să refuze pontajul. Rândul lipsă se citește într-un singur
loc, `stareaLunii` (`src/domain/attendance/luna.ts`); singura stare care refuză e `blocata`.

## Varianta de pontaj: pe zi sau pe săptămână

`setari_pontare_rapida.varianta_pontaj` (`0165_pontaj_varianta_saptamanala.sql`), implicit
`zilnic`, citită în SQL de `internal.pontaj_varianta`. Pe `saptamanal`, fișa săptămânii e
SINGURA cale prin care omul se pontează: ceasul, confirmarea zilei, dialogul `CelulaZi` și
tragerea pe grilă nu mai scriu. Întrebarea se pune o singură dată, cu `sePonteazaPeZi`
(`pontare-rapida.ts`), ca niciun ecran să nu rămână cu un buton pe care serverul îl
refuză; filele o primesc prin `varianta` din `fileDePontaj`, iar „Planul săptămânii"
devine „Pontajul săptămânii".

Refuzul e scris de două ori, deliberat: `refuzaZiuaInVariantaSaptamanala` în
`salveazaZiPontaj`/`stergeZiPontaj` și în `pregatirePontareRapida`, plus triggerul BEFORE
`internal.pontaj_doar_pe_saptamana` ca plasă pentru orice cale care ocolește acțiunile —
politicile din `0013` lasă un `employee` să scrie direct prin PostgREST. Triggerul ridică
**P0001 cu ACELAȘI text**, nu 42501, fiindcă mesajul spune ce are de făcut omul. Scapă:
contextul de serviciu, `attendance:create = all` (responsabilul de pontaj corectează în
continuare foaia colectivă — varianta privește cum se pontează OMUL, nu corecturile),
rândurile de concediu și UPDATE-urile care ating doar decizia. Portița pe
`leave_request_id`, coloană scrisă de CLIENT, a fost strânsă de
`0166_pontaj_saptamanal_fara_portita_concediu.sql`.

Fișa devine pontaj prin `scrieSaptamanaInPontaj` — la aprobare, sau pe loc la trimiterea
care se închide singură (0167). Scrierea e best-effort, fiindcă aprobarea e deja
înregistrată când se ajunge la ea, deci plasa zilnică
`internal.recupereaza_saptamani_fara_pontaj` (0169) reface ce a căzut și anunță ce nu se
poate deriva în SQL. Zilele unei luni `blocata` nu se scriu niciodată: clientul admin e
scutit de triggerul lunii, deci garda stă în cod. Restul: [[modul/pontaj/saptamana]].

## Sediul zilei: scanat ≠ declarat

Două coloane cu sensuri diferite (`0163_pontaj_sediu_declarat.sql`):
`attendance_entries.punct_lucru_id` e SCANAT din codul QR (0096), adică dovadă, iar
`punct_lucru_declarat_id` e ales de om în formular și nu dovedește nimic. Sediul efectiv =
scanat ?? declarat ?? cel din contract, iar `null` pe declarat înseamnă „cel din
contract", nu „necunoscut" — de aceea prima opțiune din `CampSediu` e VALOAREA GOALĂ și
doar numește sediul contractului. Regulile stau o singură dată, în
`src/domain/attendance/sediu.ts` (`seAlegeSediul`, `tipulPermiteSediu`, `sediulDeTrimis`,
`etichetaSediului`): le aplică două formulare și o acțiune.

Se întreabă doar unde întrebarea are sens: cel puțin două sedii și verificare ≠ `cod_qr`
(acolo sediul vine din scanare). Lista vine din `sediiPentruPontaj`, care cheamă RPC-ul
`public.sedii_pentru_pontaj` — `puncte_lucru_select` cere `departments:read`, pe care
`employee` nu-l are, iar el e tocmai cel care completează ziua; funcția întoarce doar id,
denumire și `din_contract`, niciodată `cod_pontaj`. `din_contract` e al CELUI CONECTAT,
deci pe ziua altcuiva se stinge, ca să nu numească sediul greșit.

## Cele trei vizualizări ale lui `/pontaj`

`?vizualizare=` cu `saptamana` · `luna` · `lista`. **Implicita depinde de ROL**
(0118): `implicitaPentruScope` din `vizualizari.ts` dă `lista` pentru cine vede și
pontajul altora (`scope !== "own"` — `org_admin`, `hr`, `all`; `manager`, `team`) și
`saptamana` pentru angajat. Valoarea implicită e ștearsă din adresă de
`ComutatorVizualizare`, deci `/pontaj` curat înseamnă lucruri diferite pentru roluri
diferite — iar pagina TREBUIE să dea aceeași implicită și schemei
(`vizualizareaCeruta`), și comutatorului, altfel butonul vizualizării implicite duce
la o adresă care se citește altfel decât s-a scris.
Enumul și opțiunile stau în `vizualizari.ts`; comutarea folosește primitiva
`ComutatorVizualizare`, deci starea e în adresă și nu se livrează JavaScript pentru ea.

- **`saptamana`** — grila orară a pontajului PROPRIU, `?saptamana=<luni ISO>`.
  Implicită doar pentru `employee`: pentru un `org_admin` sau `hr` grila arată propria
  lui săptămână, deci ateriza în ea în loc să vadă firma pe care o administrează.
  Se pontează trăgând peste o zonă dintr-o zi; la eliberare se deschide `CelulaZi` cu intervalul
  precompletat (`oraInceputInitiala`/`oraSfarsitInitiala`, care BAT `intrare`). Fereastra
  e 06:00–22:00, lărgită de `intervalulGrilei` cât să cuprindă orice intrare din afara ei.
  Tragerea e doar cu mausul: pe telefon `touch-action: none` ar bloca derularea paginii,
  deci acolo atingerea deschide dialogul cu intervalul propus — aceeași cale ca tastatura.
  În varianta `saptamanal` grila rămâne de CITIT, dar nu se mai trage pe ea
  (`sePonteazaZiua` din `sectiune-saptamana.tsx`), iar motivul se scrie pe celulă.
- **`luna`** — calendar de 7 coloane cu TOȚI angajații, max 3 pe zi plus „+N alții"
  (citibili prin `sr-only`, nu prin `title`). Server Component pur, needitabil.
- **`lista`** — foaia colectivă, neschimbată.

`luna` și `lista` se hrănesc din ACELEAȘI citiri și se ramifică abia la randare
(`LunaIntreaga` din `page.tsx`); o a doua citire ar fi însemnat două ecrane care pot
arăta lucruri diferite pentru aceeași lună. Aritmetica grilei orare e în
`src/domain/attendance/grila-orara.ts`, cu teste — inclusiv cel purtător: orice tragere
produce un interval pe care `oreleZilei` îl acceptă.

Săptămâna se ancorează în luna din adresă (`an`+`luna`), iar comutatorul completează
cheia care lipsește în cealaltă direcție — altfel comutarea ar sări în altă perioadă
decât cea de pe ecran.

## Ce refuză baza tăcut

- **Coloanele calculate de triggere BEFORE nu se trimit din client**:
  `attendance_periods.data_inceput`/`data_sfarsit`/`blocata_la`/`blocata_de`,
  `attendance_entries.period_id` și `tip_zi` când e null. În plus, politicile INSERT
  **cer** `approved_at`/`approved_by`/`batch_id` = NULL,
  `attendance_approval_batches.linii_aprobate` = 0, `attendance_periods.status` =
  `deschisa`. Un INSERT cu doar (organization_id, an, luna) reușește. — capcana #6
- **`.upsert()` cade cu 42P10.** `attendance_entries_zi_uq` e index unic **parțial**
  (`where deleted_at is null`), iar PostgREST nu emite predicatul în `ON CONFLICT`.
  Salvarea unei zile și sincronizarea cu concediile se fac citire-apoi-INSERT-sau-UPDATE.
  — capcana #7
- **Tranzițiile perioadei sunt exact**: `deschisa`→{`in_aprobare`, `blocata`},
  `in_aprobare`→{`deschisa`, `blocata`}, `blocata`→`deschisa`.
  `blocata`→`in_aprobare` ridică P0001. Blocarea și deblocarea cer scope **all** — un
  manager cu `team` primește 42501, deci butonul se ascunde cu
  `can(permisiuni, "attendance:approve", "all")`. — capcana #9
- **Un UPDATE respins de `USING` afectează zero rânduri, fără eroare.** Orice tranziție
  face `.select()` după `.update()` și tratează rezultatul gol drept conflict. — capcana #17
- **Foaia colectivă arată TOȚI angajații, dar citește pe bucăți.** PostgREST trunchiază
  tăcut peste `max_rows`. Din 6 oct 2026 nu mai există „Pagina următoare" (foaia are
  derulare proprie): `totiAngajatiiPontaj` urmează cursorul keyset în pagini de 500, iar
  `intrariLuna` cere pontajul în bucăți de 30 de angajați (30 × 31 = 930), în paralel.
  Bucla se oprește la 20 de pagini și o SPUNE pe ecran (`trunchiat` → `Callout`), ca
  tăierea să nu fie tăcută. — capcana #2
- **O zi deschisă și neînchisă nu poate fi aprobată**: constrângerea
  `attendance_entries_aprobare_zi_incheiata_ck` (`0096_pontaj_rapid.sql`) cere ca
  `approved_at` să fie null cât timp există `ora_inceput` fără `ora_sfarsit`. 23514 NU e
  tradus de `traduEroare`, iar el ar cădea pe ÎNTREG lotul — de aceea `aprobaPontajBloc`
  filtrează zilele în curs înainte, le numără și întoarce `zileDeschise`. Constrângerea e
  plasa de sub filtru, nu invers; fără ea, „Am ieșit" de după aprobare e respins tăcut de
  `USING`. — capcana #17
- **Sediul declarat pe o zi care nu e la birou** cade pe
  `attendance_entries_punct_declarat_ck` (0163): coloana cere `tip_prezenta` null sau
  `birou`. 23514 NU e tradus, deci `sediulDeTrimis` stinge alegerea înainte de a o trimite
  — omul a ales un sediu, apoi a comutat pe homeoffice, și nu are ce să citească într-o
  eroare de bază. Acțiunea verifică încă o dată că sediul e al firmei și ACTIV: FK-ul
  compus `attendance_entries_punct_declarat_fk` prinde sediul străin, nu pe cel dezactivat
  între deschiderea formularului și salvare.
- **Ziua din concediu are `approved_at` gol pe veci**: aprobarea pontajului o EXCLUDE
  (`liniiDeAprobat`, iar `aprobaPerioada` filtrează `leave_request_id is null`), fiindcă
  decizia s-a luat deja în Concedii. Citită după `approved_at`, purta în foaie punctul
  „așteaptă decizia" pe care nimeni nu-l mai putea stinge, deci `intrareaClient` o citește
  aprobată când are `leave_request_id`.
- **Sincronizarea concediilor ÎNLOCUIEȘTE ziua pontată**, nu o mai păstrează: un concediu
  de urgență peste o zi deja pontată se plătea și ca muncă, și ca zi scăzută din sold. Se
  rescrie ACELAȘI rând, golit de interval, sediu și decizie (`ZI_LUCRATA_GOLITA`), iar
  dovada rămâne în `audit_logs`. De aici `inlocuite` în rezultat; `pastrate` înseamnă acum
  UPDATE cu zero rânduri — ziua fusese aprobată între timp, iar `attendance_entries_update`
  o refuză celui fără `attendance:approve`. — capcana #17
- **`intrariProprii` NU filtrează pe `employee_id`** — se bazează pe RLS. Corect pentru
  un `employee`, dar pentru scope `all` (`hr`, `org_admin`) RLS nu îngustează nimic, deci
  funcția întoarce pontajul ÎNTREGII firme. Orice ecran „al meu" trebuie să rezolve fișa
  explicit și să filtreze pe ea: `sectiune-saptamana.tsx` cheamă `fisaMea` + `intrariLuna(org, [fisa], …)`.
  `fisaMea`, nu `idFisaProprie`: `app.current_employee_id()` CERE `is_primary`, în timp ce
  a doua doar sortează după el — de aici starea `fara_principala`, un cont care își vede
  marca și căruia baza îi refuză orice scriere.
- **`oraOptionala` respinge ora brută din Postgres.** Coloana `time` sosește `"08:30:00"`,
  iar schema cere `^([01]\d|2[0-3]):[0-5]\d$`. Cine deschidea o zi cu interval din foaia
  colectivă, schimba doar observația și apăsa „Salvează" primea eroare de validare pe un
  câmp neatins. Normalizarea se face o singură dată, în `intrareaClient`
  (`intrare-client.ts`), care e acum singurul constructor al formei de client — testat în
  `intrare-client.test.ts`, inclusiv perechea brut-respins / normalizat-acceptat.
- **`employee` nu-și poate citi propria fișă cu clientul autentificat**: politica
  `employees_select` (`0005_hr_rls.sql`) nu deschide drumul, deci `fisaProprie` folosește
  `createAdminSupabase()` cu filtru explicit pe `organization_id` și cere
  `is_primary = true`, cerința lui `app.current_employee_id`. Același motiv pentru
  `puncte_lucru`: `puncte_lucru_select` (`0030_onboarding_companie.sql`) cere
  `departments:read`, pe care rolul `employee` nu-l are, deci codul de pe afiș se rezolvă
  tot cu clientul admin, filtrat pe organizație. — `0096_pontaj_rapid.sql`

## Erori traduse

`src/app/(app)/pontaj/erori.ts`, funcția `traduEroare` (tip `never`, întrerupe fluxul
ca un `throw`):

- **23505** → mesaj propriu: ziua există deja pentru angajatul acela.
- **P0001** → mesajul triggerului **se propagă**, trunchiat. Deliberat: mesajele din
  `0013_attendance.sql` conțin cifrele („perioada 08.2026 este blocată"), iar traducerea
  generică le-ar înlocui cu un text fără informație. `error.details` și `error.hint` nu
  se propagă niciodată.

## Ce NU e aici

Concediile (`[[modul/concedii]]` — pontajul doar le sincronizează prin
`sincronizeazaConcediile`), sporurile și agregarea în state de plată
(`[[modul/salarizare]]`), și fișa angajatului (`[[modul/angajati]]`).

Butoanele pontării rapide nu sunt sub `/pontaj`: ecranele stau în
`src/app/(portal)/portal/`, iar afișul de tipărit și acțiunea care rotește `cod_pontaj`
rămân în `src/app/(app)/puncte-lucru/`. Fila **Coduri QR** doar ARATĂ codul și cheamă
acțiunea aceea, importată (`ButonCodQr`) — rescrisă aici, ar fi fost a doua implementare a
aceleiași reguli, adică locul unde cele două se despart tăcut. Aici sunt doar acțiunile pe
care le apelează și setările care le pornesc.

## Când NU e suficientă pagina asta

- Calculul efectiv al orelor și al intervalului de noapte: `src/domain/attendance/` și
  `src/app/(app)/pontaj/interval-noapte.ts`.
- Forma exactă a politicilor: migrarea `0013_attendance.sql`, care e și scheletul canonic
  pentru orice migrare nouă.
- Coloanele și tipurile pontării rapide, cu motivele lor: `0096_pontaj_rapid.sql`.
