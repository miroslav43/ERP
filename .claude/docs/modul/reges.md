---
tip: modul
titlu: REGES
aliases: [reges, revisal, registru-salariati]
cai:
  - "src/app/(app)/reges/**"
  - "src/lib/queries/reges.ts"
  - "src/lib/reges/**"
  - "src/domain/reges/**"
  - "src/app/api/reges/reconciliere/route.ts"
  - "supabase/migrations/0086_reges_redenumire.sql"
  - "supabase/migrations/0087_reges_online.sql"
  - "supabase/migrations/0128_absente_nemotivate_suspendare.sql"
  - "supabase/migrations/0129_reges_sporuri.sql"
tabele:
  [
    reges_evenimente,
    reges_credentiale,
    reges_mesaje,
    reges_nomenclatoare,
    reges_propuneri,
    reges_apeluri,
    reges_inchiriere,
    reges_termene,
    contract_suspendari,
    salary_component_types,
    salary_components,
  ]
permisiuni: [reges:read, reges:create, reges:update, reges:transmit, reges:configure, reges:export]
feature: reges
capcane: [17]
citeste_daca:
  - "meniu care nu arată modulul deși rolul pare potrivit → [[rol/hr]]"
scris_pe: b32cfef59471a67b3a39ff3e5d3108cf04c7366c
scris_la: 2026-09-05
tags: [modul, hr]
---

# REGES

Registrul general de evidență a salariaților, transmis la Inspecția Muncii prin **API**,
nu prin fișier. Modulul construiește evenimentele din contractele din aplicație, le pune
într-o coadă de mesaje, le trimite și împerechează recipisele asincrone.

Numele vechi era Revisal; `0086_reges_redenumire.sql` a redenumit `revisal_config` în
`reges_termene`. Valorile legale au rămas acolo unde erau — `0087` n-a adus niciun termen
nou.

## De ce n-a existat un fișier oficial

Până la REGES-Online, aplicația **nu putea** produce documentul cerut: `.rvs` e formatul
de IEȘIRE al aplicației Revisal, codificat, nu unul pe care un terț să-l poată scrie.
Drumul real ar fi fost `ERP → XML → import în Revisal → .rvs`, iar acel XSD nu era în
posesie. Serializarea nu s-a inventat, deliberat: un fișier care arată plauzibil dar are un
element greșit se descoperă abia la import. CSV-ul de lucru a rămas, ca instrument intern.
— antetul lui `src/domain/reges/export.ts`

## Rute și cine ajunge

| Rută               | Ce cere                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `/reges`           | `requireFeature(..., "reges")`; scope-ul de `reges:read` filtrează |
| `/reges/[id]`      | idem, detaliul unui mesaj                                          |
| `/reges/propuneri` | idem, detașările și mutările în ambele sensuri                     |
| `/reges/setari`    | idem; configurarea cere `reges:configure` la scope `all`           |

Modulul dezactivat înseamnă **404**, nu `AccesRestrictionat`: `requireFeature` se aplică
înaintea oricărei verificări de permisiune.

Butoanele se calculează pe server, fiecare cu cheia lui la scope `all`:
`poateActualiza` (`reges:update`), `poatePregati` (`reges:create`), `poateTransmite`
(`reges:transmit`), `poateExporta` (`reges:export`), `poateConfigura` (`reges:configure`).
`meetsScope` face comparația, nu `can()`.

Din `0087`, cheile merg la `super_admin`, `org_admin` și `hr` — inclusiv `configure`,
fiindcă specialistul de personal e cel care obține accesul din portalul REGES. `manager` și
`employee` nu primesc niciun rând: absența permisiunii ESTE refuzul. Strângerea lui
`configure` la `org_admin` se face per firmă, dintr-un rând în `role_permissions`, fără
deploy. — v. [[rol/hr]]

**Modul pornit ≠ modul conectat.** Pagina derivă `conectat` din `citesteRezumatCredentiale`
— rezumatul, nu secretele. Neconectat, registrul se construiește local și **nimic nu pleacă**
(`citesteCredentiale` → `jetonValid` refuză): `ButonPregateste` cere și `poatePregati`, și
`conectat`; altfel rândul spune „Neconectat la ITM" și deasupra listei stă un `Callout` —
stare legitimă, dar de știut înainte de apăsare, nu din eroarea de după. `comutaActivarea`
refuză pornirea cât timp rezumatul n-are secret, n-are parolă sau `verificatOk !== true`.

## Server Actions

Sunt în **două** fișiere, toate la scope `all`:

- `src/app/(app)/reges/actions.ts` — ce nu atinge rețeaua: `marcheazaTransmis`
  (`reges:update`) și `exportaEvenimente` (`reges:export`).
- `src/app/(app)/reges/actiuni-api.ts` — ce vorbește cu Inspecția Muncii; antetul lui spune
  de ce ocolește RLS. `pregatesteTransmiterea`, `propunePlecarea` → `reges:create`;
  `transmiteMesajul`, `raspundePropunerii` → `reges:transmit`; `anuleazaMesajul`,
  `salveazaClasificarea` → `reges:update`; `salveazaCredentialele`, `testeazaConexiunea`,
  `comutaActivarea`, `sincronizeazaNomenclatoarele`, `creeazaSporAngajator` →
  `reges:configure`. `creeazaSporAngajator` înregistrează un spor **propriu firmei** în
  registrul angajatorului și scrie UUID-ul întors în
  `salary_component_types.reges_tip_spor_id` — act de configurare, nu transmitere de
  contract; n-are încă ecran.

**Poarta acțiunii trebuie să fie identică cu poarta paginii.** `marcheazaTransmis` a
declarat până la `0087` o cheie de citire, în timp ce pagina ținea butonul în spatele unei
chei de scriere — iar o Server Action se poate chema direct, fără ecran. Marcarea unui
eveniment drept transmis e o afirmație despre registrul oficial, deci acțiunea cere azi
exact ce gatează pagina. Regula se aplică peste tot, nu doar aici.

Reconcilierea cozii nu e o acțiune, ci ruta `src/app/api/reges/reconciliere/route.ts`.
Comanda care o cheamă nu se reproduce din memorie — sursa de adevăr e
`deploy/reges-reconciliere.service`, care trece secretul prin `-K -`, nu prin argv.

## Stările unui mesaj

`reges_stare_mesaj` = `de_transmis` → `in_curs` → `asteapta_raspuns` → `reusit` | `esuat`,
plus `anulat`. `in_curs` există exact ca să nu trimită de două ori același mesaj un ciclu
de reconciliere care se suprapune cu apăsarea butonului „Transmite"; `reges_inchiriere`
serializează ciclul.

Tranzițiile se scriu cu `.select()` după `.update()`: un rând care nu mai e în starea
așteptată nu produce eroare, produce zero rânduri. — capcana #17

## Vocabularul de protocol rămâne în engleză

`reges_operatie` conține literal valorile din enum-ul `MessageType` al schemei REGES 2025,
inclusiv scrierea PascalCase — `InregistrareSalariat`, `AdaugareContract`,
`IncetareSuspendareContract`. Sunt vocabular de protocol, ca numele metodelor HTTP, nu
identificatori de domeniu: o traducere ar cere o tabelă de mapare ținută sincronizată cu un
sistem pe care nu-l controlăm, iar prima valoare uitată acolo ar produce un mesaj respins
fără explicație. Regula proiectului „identificatorii de domeniu în română" **nu** se aplică
aici.

## Nomenclatoarele se referențiază prin UUID, nu prin cod

În mesajul de contract, unde fișierele Revisal vechi purtau coduri: `Cor` e azi un
`Referinta`, nu perechea `{ cod, versiune }` — `idCor` ia UUID-ul din oglinda locală
(`reges_nomenclatoare`, `tip = "Cor"`, `activ`), nu live de la ITM, iar `codCor` rămâne pe
`ContractIntern` pentru validare. Și `salariu` a încetat să fie un număr: e
`{ salariuBaza, sporuri? }`, cu `SporSalarial` = `referintaTipSpor` (UUID **brut**, nu
`Referinta`) + `valoare` + `esteProcent`, fără `$type` și fără monedă. `sporuri` se **omite**
când e gol — `[]` nu e același lucru cu absența câmpului pentru un deserializator strict.

`compuneContract` le primește pe amândouă de la apelant, ca să rămână sincronă; în
reconciliere le rezolvă `idCor` și `sporurileContractului`, care citește doar
`kind in ('spor_procent', 'spor_suma')`, active la data trimiterii — aceeași linie trasă în
bază de `salary_component_types_spor_reges_ck` (`0129`). Maparea nu se ghicește din denumire.

**Ce lipsește din oglindă OPREȘTE mesajul, nu se sare tăcut.** `verificaContract` refuză
contractul cu `regesCorId` null și sporul cu `referintaTipSpor` gol: o referință inventată
trece de schemă și e refuzată **asincron**, ore mai târziu, cu termenul deja curgând, iar un
spor sărit ar declara un salariu mai mic decât cel real. Tot acolo cad valoarea ≤ 0 și
procentul peste 100.

## Credențialele

`reges_credentiale` ține un rând per firmă, cu secretele criptate **la nivel de aplicație**
înainte de a atinge baza: fiecare valoare are `ciphertext`, `iv` de 12 octeți, `tag` de 16
și o versiune de cheie, ca rotația să nu ceară migrare de date. `consumer_id` e cursorul
firmei în cozile REGES și e **stabil**: schimbat, coada se reia de la capăt și rezultatele
deja împerecheate se reprocesează.

## Absențele nemotivate — al doilea drum către o suspendare

`0128` a adăugat `suspendare_nemotivata` și `reluare_nemotivata` în `reges_tip_eveniment`.
**Nu sunt operații noi de protocol** — `plan.ts` le mapează la `SuspendareContract` și
`ReactivareContract`, ca surorile lor. Diferența e despre **termen**, iar `reges_termene` are
un rând per `event_type`: nu încap două sub aceeași cheie. Rândurile de platformă din `0128`
dau 3 zile lucrătoare **de la** suspendare (absența nu poate fi anunțată în ziua anterioară)
și **zero** zile la reluare, ca întoarcerea neanunțată să nu apară ca întârziere.

Detecția e `seriiDeAbsente` din `src/domain/reges/absente.ts`, modul pur. „Consecutiv" NU
înseamnă zile calendaristice la rând: weekendul și sărbătoarea nelucrate lasă seria deschisă,
iar o zi în care omul a **făcut** ceva (a lucrat, concediu, medical) o rupe — de aceea
funcția primește toate zilele lunii, nu doar absențele. Pragul, `PRAG_ZILE_ALERTA`, stă în
cod: e convenție de produs, nu regulă legală.

Aplicația **semnalează**, nu suspendă singură — emiterea e decizie de om, în
`src/app/(app)/pontaj/suspendare-absente.ts` (v. [[modul/pontaj]]). Suspendarea se deschide
cu `data_sfarsit` NULL și se închide când pontajul primește ore lucrate;
`contract_suspendari.sursa` (`manuala` | `concediu` | `absenta_nemotivata`) dă detecției de
conflict un predicat în loc de text liber, iar o suspendare suprapusă cade pe
`contract_suspendari_fara_suprapunere` cu **23P01**.

## Ce se mișcă împreună

`contract_suspendari` a apărut odată cu `0087` — suspendarea contractului nu exista ca
entitate în aplicație, deși REGES o cere. Orice schimbare de contract în [[modul/angajati]]
produce un eveniment aici. Din `0128` mai are o sursă, [[modul/pontaj]].

`salary_component_types` și `salary_components` sunt ale [[modul/salarizare]], dar de la
`0129` un spor nemapat blochează transmiterea contractului care îl folosește.

`reges_nomenclatoare` e oglinda nomenclatoarelor naționale (COR, CAEN, județe, temeiuri
legale); se împrospătează din API, nu se editează de mână. Excepția e `tip = "SporAngajator"`,
scris per firmă de `creeazaSporAngajator`, cu unicitate pe `(organization_id, tip, reges_id)`.

## Când NU e suficientă pagina asta

- Forma unui mesaj și clientul HTTP: `src/lib/reges/`.
- Termenele legale: `reges_termene`, plus `NOTES.md` — valorile ⚠ cer confirmarea unui
  jurist înainte de a fi folosite în calcul real.
