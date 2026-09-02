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
  ]
permisiuni: [reges:read, reges:create, reges:update, reges:transmit, reges:configure, reges:export]
feature: reges
capcane: [17]
citeste_daca:
  - "meniu care nu arată modulul deși rolul pare potrivit → [[rol/hr]]"
scris_pe: 0815fbff2c885cd44b5768ee25f084f16a9e95b8
scris_la: 2026-09-03
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

## Server Actions

`src/app/(app)/reges/actions.ts`, două: `marcheazaTransmis` (`reges:update` / all) și
`exportaEvenimente` (`reges:export` / all).

**Poarta acțiunii trebuie să fie identică cu poarta paginii.** `marcheazaTransmis` a
declarat până la `0087` o cheie de citire, în timp ce pagina ținea butonul în spatele unei
chei de scriere — iar o Server Action se poate chema direct, fără ecran. Marcarea unui
eveniment drept transmis e o afirmație despre registrul oficial, deci acțiunea cere azi
exact ce gatează pagina. Regula se aplică peste tot, nu doar aici.

Reconcilierea cozii nu e o acțiune, ci ruta `src/app/api/reges/reconciliere/route.ts`.

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

## Credențialele

`reges_credentiale` ține un rând per firmă, cu secretele criptate **la nivel de aplicație**
înainte de a atinge baza: fiecare valoare are `ciphertext`, `iv` de 12 octeți, `tag` de 16
și o versiune de cheie, ca rotația să nu ceară migrare de date. `consumer_id` e cursorul
firmei în cozile REGES și e **stabil**: schimbat, coada se reia de la capăt și rezultatele
deja împerecheate se reprocesează.

## Ce se mișcă împreună

`contract_suspendari` a apărut odată cu `0087` — suspendarea contractului nu exista ca
entitate în aplicație, deși REGES o cere. Orice schimbare de contract în [[modul/angajati]]
produce un eveniment aici.

`reges_nomenclatoare` e oglinda nomenclatoarelor naționale (COR, CAEN, județe, temeiuri
legale); se împrospătează din API, nu se editează de mână.

## Când NU e suficientă pagina asta

- Forma unui mesaj și clientul HTTP: `src/lib/reges/`.
- Termenele legale: `reges_termene`, plus `NOTES.md` — valorile ⚠ cer confirmarea unui
  jurist înainte de a fi folosite în calcul real.
