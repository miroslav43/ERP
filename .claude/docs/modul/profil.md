---
tip: modul
titlu: Profilul meu
aliases: [profil, cont, avatar]
cai:
  - "src/app/(app)/profil/**"
  - "src/lib/queries/profile.ts"
  - "src/components/forms/formular-profil.tsx"
tabele: [profiles, organization_members]
permisiuni: []
capcane: [2]
scris_pe: 711e5225e1df2ceab9324037466c87fda8abd8a0
scris_la: 2026-09-04
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

## Citiri

`src/lib/queries/profile.ts` deservește și alte ecrane, nu doar pagina asta — cine îl
schimbă schimbă mai mult decât profilul:

| Funcție                  | Cine o cheamă și cu ce filtru                                 |
| ------------------------ | ------------------------------------------------------------- |
| `citesteProfilPropriu`   | pagina asta — un rând, pe `id`                                |
| `avataturiPeUtilizatori` | `src/lib/queries/employees.ts` — filtru pe o listă de conturi |
| `toateAvatarurile`       | `src/app/(app)/departamente/page.tsx` — filtru pe organizație |

`toateAvatarurile` e o funcție separată, nu `avataturiPeUtilizatori` lărgită: apelanții
din `employees.ts` chiar vor filtrul pe id-uri, iar în [[modul/departamente]] el ar fi
legat citirea avatarurilor de rezultatul listei de angajați, adică ar fi scos-o din
valul de citiri paralele al paginii.

Restrângerea se face în **doi pași — membrii activi ai organizației, apoi avatarele
lor** — fiindcă `profiles` și `organization_members` se întâlnesc pe
`organization_members.user_id = profiles.id`, nu printr-o cheie străină, iar PostgREST
refuză embed-ul fără FK. Aceeași lipsă e documentată la `rolurileConturilor` din
`employees.ts`.

## Ce refuză baza tăcut

- **O citire din `profiles` fără filtru pe organizație întoarce mai mult decât cere un
  ecran de firmă.** `app.shares_org`, pe care se sprijină `profiles_select`, se
  evaluează pe `app.current_org_ids()` — toate organizațiile în care autorul cererii e
  membru activ, nu firma din sesiune. Pentru un cont membru în două firme diferența e
  reală și tăcută, fără nicio eroare. De aceea `toateAvatarurile` primește
  `organizationId` și filtrează `organization_members` explicit; orice citire nouă de
  aici care servește un ecran de firmă face la fel. — `src/lib/queries/profile.ts`
- **Peste 1000 de rânduri PostgREST trunchiază tăcut.** Ambii pași din
  `toateAvatarurile` trec prin `citesteTot` (cursor keyset, aruncă la plafon în loc să
  tacă). Un `.select()` simplu pus în locul lui readuce capcana, iar simptomul e un
  avatar lipsă, nu o eroare. — capcana #2

## Ce NU e aici

Fișa de angajat — CNP, IBAN, contract, încadrare — e la [[modul/angajati]] și se vede în
portal, sub `employees:read = own`. Distincția contează: un utilizator poate avea cont fără
fișă (administrator, contabil extern), caz susținut explicit de invitația `fara_fisa`.

Avatarul se rezolvă prin `src/lib/avatar/cale.ts`, comun cu restul aplicației.

## Când NU e suficientă pagina asta

- Datele de personal: [[modul/angajati]].
- Ce vede angajatul despre sine: portalul, `src/app/(portal)/portal/`.
