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
    notifications,
  ]
permisiuni:
  [
    reges:read,
    reges:create,
    reges:update,
    reges:transmit,
    reges:configure,
    reges:export,
    employees:read,
  ]
feature: reges
capcane: [17, 53]
citeste_daca:
  - "meniu care nu arată modulul deși rolul pare potrivit → [[rol/hr]]"
scris_pe: a67bb3cc1be0a37072b4d1bb96fb262cf8338586
scris_la: 2026-10-31
tags: [modul, hr]
---

# REGES

Registrul general de evidență a salariaților, transmis la Inspecția Muncii prin **API**,
nu prin fișier. Modulul construiește evenimentele din contractele din aplicație, le pune
într-o coadă de mesaje, le trimite și împerechează recipisele asincrone.

Numele vechi era Revisal; `0086_reges_redenumire.sql` a redenumit `revisal_config` în
`reges_termene`. Valorile legale au rămas acolo unde erau — `0087` n-a adus niciun termen
nou.

## Paginile modulului

| Pagină                     | Ce ține                                                                    |
| -------------------------- | -------------------------------------------------------------------------- |
| [[modul/reges/actiuni]]    | Server Actions: cele două fișiere, poarta fiecăreia, ciclul de transmitere |
| [[modul/reges/evenimente]] | De unde vine un rând în registru, cine e anunțat, termenul, absențele      |
| [[modul/reges/protocol]]   | Forma mesajului: vocabularul de protocol, nomenclatoarele, actul adițional |

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

`/reges/[id]` arată azi aceleași butoane ca coada („Transmite", „Anulează"), cu EXACT
condițiile din `/reges`: cine deschide mesajul dintr-o notificare sau de pe fișa omului nu
mai e trimis înapoi în coadă ca să-l transmită.

Legătura către fișa salariatului — din coadă, din registru, din propunerile **trimise** —
apare doar la `employees:read` la scope `all` (`poateDeschideFisa`): cu o suprascriere pe
`team`, fișa unui om din afara echipei dă 404, iar rândul ar promite un ecran inexistent.
Propunerea **primită** descrie omul altui angajator, deci nu se leagă niciodată.

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

## Citiri

`src/lib/queries/reges.ts` începe cu `import "server-only"`: o valoare importată de acolo
într-un fișier `"use client"` cade la `pnpm check:server`, nu abia la build. Vocabularul
partajat (etichete, opțiuni de filtru, scheme) stă în `src/app/(app)/reges/constante.ts`,
care NU e `server-only`. — capcana #53

`interogheazaEvenimenteReges` și `interogheazaMesajeReges` primesc amândouă filtrul
`angajat` — intrarea de pe fișa omului, validată ca UUID pe server și ignorată altfel.
Coada are plafon propriu, iar **statisticile ei se numără în bază** când pagina iese plină:
socotite peste rândurile afișate, mesajele vechi încă de transmis dispăreau și din contor,
nu doar din tabel. `RandReges.angajatVizibil` spune dacă fișa mai există (`false` =
„Angajat șters", linkul n-are țintă), `RandMesaj.evenimentId` leagă mesajul de rândul din
registru, iar `RandPropunere.mesajId` / `employeeId` leagă propunerea trimisă de mesajul ei
și de salariatul nostru — rezolvat prin contract, **sub RLS**, ca legătura să existe doar
când poate fi deschisă.

## Stările unui mesaj

`reges_stare_mesaj` = `de_transmis` → `in_curs` → `asteapta_raspuns` → `reusit` | `esuat`,
plus `anulat`. `in_curs` există exact ca să nu trimită de două ori același mesaj un ciclu
de reconciliere care se suprapune cu apăsarea butonului „Transmite"; `reges_inchiriere`
serializează ciclul. Cine o revendică și cum se iese din ea la refuz sau la excepție:
[[modul/reges/actiuni]].

Tranzițiile se scriu cu `.select()` după `.update()`: un rând care nu mai e în starea
așteptată nu produce eroare, produce zero rânduri. — capcana #17

## Credențialele

`reges_credentiale` ține un rând per firmă, cu secretele criptate **la nivel de aplicație**
înainte de a atinge baza: fiecare valoare are `ciphertext`, `iv` de 12 octeți, `tag` de 16
și o versiune de cheie, ca rotația să nu ceară migrare de date. `consumer_id` e cursorul
firmei în cozile REGES și e **stabil**: schimbat, coada se reia de la capăt și rezultatele
deja împerecheate se reprocesează.

Ambele baze din `BAZE_API` (`src/lib/reges/client.ts`) sunt azi confirmate în folosire
reală; avertismentul „NEVERIFICATĂ" de pe cea de producție a căzut odată cu prima
transmitere a unei firme reale.

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

- Forma unui mesaj și clientul HTTP: `src/lib/reges/`, plus [[modul/reges/protocol]].
- Termenele legale: `reges_termene`, plus `NOTES.md` — valorile ⚠ cer confirmarea unui
  jurist înainte de a fi folosite în calcul real.
- Numele din coadă, `?eveniment=` și „N mesaje în coadă”, rândul nou din propuneri: [[strat/navigare]].
