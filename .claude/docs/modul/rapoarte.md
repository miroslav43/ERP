---
tip: modul
titlu: Rapoarte
aliases: [rapoarte, statistici, grafice]
cai:
  - "src/app/(app)/rapoarte/**"
  - "src/lib/queries/rapoarte.ts"
tabele: [payroll_periods, payroll_entries, employees, organization_features]
permisiuni: [payroll:read, payroll:create]
feature: rapoarte
capcane: [2]
scris_pe: 00e37653eadf3e9d2827de0ebf88e9a043eec856
scris_la: 2026-09-04
tags: [modul]
---

# Rapoarte

Statistici anuale peste perioadele de salarizare — evoluție lunară, structura costului,
ore. Un singur ecran, fără nicio scriere.

## Modul propriu la poartă, salarizare la permisiune

`/rapoarte` cere `requireFeature(..., "rapoarte")` — cheia lui proprie din `FEATURE_KEYS`
(`src/config/features.ts`), nu a salarizării. Poarta era `payroll` până la
`0123_module_rapoarte_si_kpi.sql`: ecranul se vindea separat în ofertă, dar nu s-ar fi
deschis fără modulul-părinte. Guard-ul și `getPermissionMap` rulează acum într-un singur
`Promise.all` — două dus-întorsuri independente, nu înlănțuite.

**Permisiunea nu s-a mutat**: tot `payroll:read` la scope **`all`**, și în pagină, și pe
intrarea de meniu din `src/config/navigation.ts` (`featureKey: "rapoarte"`,
`permission: "payroll:read"`, `minScope: "all"`). Separarea e comercială, la nivel de
modul; controlul de acces a rămas al salarizării. Nu există resursă `reports:*` folosită
de vreo politică — cheia `reports:read` există în vocabularul din
`src/config/permissions.ts`, dar niciun consumator nu o citește.

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
- **Un an fără perioade nu e o eroare.** `aniCuPerioade` întoarce listă goală, iar
  `statisticiAnuale` iese devreme cu toate totalurile pe zero; ecranul arată starea goală
  — nu se confundă cu „datele nu s-au încărcat". — `src/lib/queries/rapoarte.ts`
- **Modul dezactivat ⇒ 404, nu 403.** `requireFeature` cheamă `notFound()`
  (`src/lib/auth/features.ts`), deci o firmă fără rând `rapoarte` în
  `organization_features` primește pagină inexistentă, nu `AccesRestrictionat`. Firmele
  care aveau `payroll` au primit rândul prin copiere, cu `enabled` preluat din
  rândul-părinte, nu pus `true` orbește — `0123:58-62`.

## Când NU e suficientă pagina asta

- Cum se calculează sumele: [[modul/salarizare]] și `src/domain/payroll/`.
- De ce o perioadă nu se recalculează: [[date/pontaj]].
