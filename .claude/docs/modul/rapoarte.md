---
tip: modul
titlu: Rapoarte
aliases: [rapoarte, statistici, grafice]
cai:
  - "src/app/(app)/rapoarte/**"
  - "src/lib/queries/rapoarte.ts"
tabele: [payroll_periods, payroll_entries, attendance_periods]
permisiuni: [payroll:read, payroll:create]
feature: payroll
capcane: [2]
scris_pe: 0815fbff2c885cd44b5768ee25f084f16a9e95b8
scris_la: 2026-09-03
tags: [modul]
---

# Rapoarte

Statistici anuale peste perioadele de salarizare — evoluție lunară, structura costului,
ore. Un singur ecran, fără nicio scriere.

## Nu e un modul propriu, e o față a salarizării

`/rapoarte` cere `requireFeature(..., "payroll")` și `payroll:read` la scope **`all`**.
Nu există resursă `reports:*` folosită de vreo politică — cheia `reports:read` există în
vocabularul din `src/config/permissions.ts`, dar niciun consumator nu o citește.

Consecința practică: **cine nu vede salariile nu vede nici rapoartele**, iar un `manager`
n-are `payroll` deloc (`none` explicit în seed). Butonul care duce la deschiderea unei
perioade cere în plus `payroll:create` la `all`.

## Citiri

`src/lib/queries/rapoarte.ts`: `aniCuPerioade` (anii pentru care există perioade) și
`statisticiAnuale`. Ambele agregă peste perioade închise sau calculate; nu recalculează
nimic — sumele sunt cele scrise de [[modul/salarizare]].

## Ce refuză baza tăcut

- **`max_rows = 1000` din `supabase/config.toml`: PostgREST TRUNCHIAZĂ TĂCUT.** Orice
  agregare care se apropie de prag trebuie paginată explicit, sau citită în buclă cât timp
  vin exact 1000 de rânduri. Un raport anual peste o firmă mare e exact forma care lovește
  pragul fără să se plângă. — capcana #2
- **Un an fără perioade nu e o eroare.** `aniCuPerioade` întoarce listă goală, iar ecranul
  arată starea goală — nu se confundă cu „datele nu s-au încărcat".

## Când NU e suficientă pagina asta

- Cum se calculează sumele: [[modul/salarizare]] și `src/domain/payroll/`.
- De ce o perioadă nu se recalculează: [[date/pontaj]].
