---
tip: modul
titlu: Profilul meu
aliases: [profil, cont, avatar]
cai:
  - "src/app/(app)/profil/**"
  - "src/lib/queries/profile.ts"
  - "src/components/forms/formular-profil.tsx"
tabele: [profiles]
permisiuni: []
capcane: []
scris_pe: 0815fbff2c885cd44b5768ee25f084f16a9e95b8
scris_la: 2026-09-03
tags: [modul]
---

# Profilul meu

Datele contului — nume afișat, avatar — nu ale fișei de angajat. Pagina e scurtă și n-are
acțiuni proprii: formularul e componenta comună `src/components/forms/formular-profil.tsx`.

## Singura pagină din `(app)` care nu cere organizație

`requireUser`, nu `requireTenant`. Deliberat: profilul e al contului, nu al apartenenței,
deci trebuie să fie accesibil și cuiva care încă n-a ales o firmă sau a fost scos din toate.
Nicio poartă de permisiune, niciun `requireFeature` — nu există cheie de permisiune pentru
propriul cont dincolo de `users:read = own`, iar RLS întoarce oricum doar rândul propriu.

Consecința pentru cine schimbă pagina: **nu se poate folosi `tenant.organizationId` aici**.
Orice citire care are nevoie de organizație aparține fișei de angajat, adică portalului, nu
paginii ăsteia.

## Ce NU e aici

Fișa de angajat — CNP, IBAN, contract, încadrare — e la [[modul/angajati]] și se vede în
portal, sub `employees:read = own`. Distincția contează: un utilizator poate avea cont fără
fișă (administrator, contabil extern), caz susținut explicit de invitația `fara_fisa`.

Avatarul se rezolvă prin `src/lib/avatar/cale.ts`, comun cu restul aplicației.

## Când NU e suficientă pagina asta

- Datele de personal: [[modul/angajati]].
- Ce vede angajatul despre sine: portalul, `src/app/(portal)/portal/`.
