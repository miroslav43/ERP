---
tip: modul
titlu: Pontaj — foaia
aliases: [pontaj-foaia, foaia-colectiva, vizualizari-pontaj]
cai:
  - "src/app/(app)/pontaj/page.tsx"
  - "src/app/(app)/pontaj/vizualizari.ts"
  - "src/app/(app)/pontaj/sectiune-saptamana.tsx"
  - "src/app/(app)/pontaj/foaie-colectiva.tsx"
  - "src/app/(app)/pontaj/calendar-luna.tsx"
  - "src/app/(app)/pontaj/celula-zi.tsx"
  - "src/app/(app)/pontaj/camp-sediu.tsx"
  - "src/app/(app)/pontaj/intrare-client.ts"
  - "src/app/(app)/pontaj/buton-setari.tsx"
  - "src/app/(app)/pontaj/buton-sincronizare-concedii.tsx"
  - "src/app/(app)/pontaj/file-pontaj.ts"
  - "src/domain/attendance/sediu.ts"
  - "src/domain/attendance/grila-orara.ts"
  - "src/domain/attendance/totaluri.ts"
  - "src/domain/attendance/zi-de-pontat.ts"
  - "src/lib/queries/attendance.ts"
tabele: [attendance_entries, puncte_lucru]
permisiuni: [attendance:read, attendance:create, departments:read, departments:update, leave:read]
feature: attendance
capcane: [2]
scris_pe: bd516e390b0ca4dbe758079da30184b7288ceeb5
scris_la: 2026-10-12
tags: [modul, hr]
---

# Pontaj — foaia

Ecranul de la rădăcina modulului, `/pontaj`: foaia colectivă, grila săptămânii proprii și
calendarul lunii, plus dialogul zilei din care se scrie. Rutele modulului și restul
secțiunii „Ce refuză baza tăcut" stau în trunchi, [[modul/pontaj]].

## Antetul și foaia: fiecare buton cu poarta lui

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
decât cea de pe ecran. Containerele derulabile ale celor trei ecrane sunt `relative`
(UX-005): spanurile `sr-only` din celule sunt `position: absolute`, iar fără strămoș
poziționat poziția lor statică, adânc în tabelul lat, întindea PAGINA, nu cutia.
`overflow` singur nu ajută — decupează doar descendenții al căror bloc conținător e el.

**Ziua respinsă nu intră în totaluri** (`src/domain/attendance/totaluri.ts`:
`conteazaInTotaluri`, `totalurileZilelor`, `ziDeTotalizat`): respingerea nu șterge ziua,
fiindcă e declarația omului și el trebuie s-o corecteze, dar până atunci orele ei nu sunt
ore ale firmei. Adunarea era scrisă separat în foaia colectivă — pe coloană, pe rând și
în totalul general — și încă o dată în ecranele portalului, iar nicăieri nu se uita la
respingere; un total din care ziua respinsă iese într-un loc și rămâne în altul e mai rău
decât unul greșit peste tot, fiindcă cifrele nu se mai pot compara. Ziua NEDECISĂ rămâne
numărată. Același filtru a ajuns și în agregarea pentru salarizare
(`0198_agregat_fara_zile_respinse.sql`), ca fluturașul să se potrivească cu foaia, și în
`numarZilePontatePerioada`, avertismentul de pe ciorna de stat.

**Ziua care nu se pontează.** `refuzulZilei` (`src/domain/attendance/zi-de-pontat.ts`)
refuză ziua din VIITOR și ziua dinaintea angajării (`employees.hired_on`), pentru TOATE
scope-urile: pontajul înregistrează ce s-a întâmplat, iar planificarea are drumul ei,
fișa săptămânii — `scrieSaptamanaInPontaj` scrie legitim zile viitoare din planul
aprobat, de aceea regula stă în acțiune și nu în vreun CHECK pe tabelă. `hired_on` nul
sare verificarea angajării: un refuz pe o informație absentă n-ar avea ce să-i spună
omului. De aici și `fisaDePontat`: fișa pe care se scrie ziua se citește cu clientul
ADMIN pentru AMBELE scope-uri — pe `own` ca să afle a cui e ziua, pe `all` ca să afle
`hired_on` — filtrată explicit pe organizație, iar fișa cerută și negăsită e NEGASIT, nu
o scriere care cade abia pe FK. Refuzul vine ÎNAINTEA citirii setărilor și a zilei
existente, iar `mesajRefuzZi` scrie textul și pentru ecranele portalului.

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

## Ce refuză baza tăcut

- **Foaia colectivă arată TOȚI angajații, dar citește pe bucăți.** PostgREST trunchiază
  tăcut peste `max_rows`. Din 6 oct 2026 nu mai există „Pagina următoare" (foaia are
  derulare proprie): `totiAngajatiiPontaj` urmează cursorul keyset în pagini de 500, iar
  `intrariLuna` cere pontajul în bucăți de 30 de angajați (30 × 31 = 930), în paralel.
  Bucla se oprește la 20 de pagini și o SPUNE pe ecran (`trunchiat` → `Callout`), ca
  tăierea să nu fie tăcută. — capcana #2
- **Sediul declarat pe o zi care nu e la birou** cade pe
  `attendance_entries_punct_declarat_ck` (0163): coloana cere `tip_prezenta` null sau
  `birou`. 23514 NU e tradus, deci `sediulDeTrimis` stinge alegerea înainte de a o trimite
  — omul a ales un sediu, apoi a comutat pe homeoffice, și nu are ce să citească într-o
  eroare de bază. Acțiunea verifică încă o dată că sediul e al firmei și ACTIV: FK-ul
  compus `attendance_entries_punct_declarat_fk` prinde sediul străin, nu pe cel dezactivat
  între deschiderea formularului și salvare.
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
