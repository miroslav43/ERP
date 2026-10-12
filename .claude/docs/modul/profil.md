---
tip: modul
titlu: Profilul meu
aliases: [profil, cont, avatar]
cai:
  - "src/app/(app)/profil/**"
  - "src/lib/queries/profile.ts"
  - "src/components/forms/formular-profil.tsx"
  - "src/config/porti-ruta.ts"
tabele: [profiles, organization_members, employees]
permisiuni: []
capcane: [2]
scris_pe: ed4ad654d64120bfad37e146a32c8fbe4f6159f0
scris_la: 2026-10-10
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

Consecința pentru cine schimbă pagina: **nu se poate folosi `requireTenant` aici**. Rail-ul
„Ce ține de mine" (de mai jos) rezolvă firma SOFT, prin `resolveTenant()`, care întoarce o
stare în loc să redirecteze; fără firmă aleasă rail-ul lipsește, profilul rămâne.

## „Ce ține de mine"

Rolurile din `(app)` (org_admin, hr, manager) n-au portal, iar ecranele lor personale
erau împrăștiate prin filele fiecărui modul. Secțiunea leagă: fișa proprie
(`idFisaProprie` + `/angajati/[id]`), pontajul propriu (`/pontaj/saptamana?angajat=` sau
`/pontaj?angajat=`), `/concedii`, `/ticketing` (tichetele mele), `/inventar/in-primire`,
`/notificari`. Fiecare link trece prin `poateDeschide()` din `src/config/porti-ruta.ts`:
modul activ + permisiunea paginii-țintă. Nicio citire de date aici, doar porți și id-ul
fișei — `getPermissionMap`, `getEnabledFeatures` și `idFisaProprie` pleacă într-un
`Promise.all`, iar rail-ul întreg pleacă în paralel cu `citesteProfilPropriu`.

Cele două linkuri legate de fișă — fișa proprie și pontajul — cer `idFisaProprie` nenul;
pontajul alege `/pontaj/saptamana` când poarta lui trece, altfel cade pe `/pontaj`.

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

Fișierul începe cu `import "server-only"`: un import dintr-o componentă client oprește
build-ul pe loc, în locul unei erori la rulare. `FormularProfil` primește deci valorile
inițiale ca props de la `page.tsx`, nu le citește el.

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
- **Un cont fără fișă de angajat pierde tăcut două linkuri din rail.** `idFisaProprie`
  întoarce `null` — nu o eroare — când nu există `employees` activ cu `user_id`-ul
  contului în firma aleasă, iar fișa proprie și pontajul pur și simplu nu se randează.
  Cazul e legitim (invitația `fara_fisa`), deci nu se tratează ca defect; dar cine
  raportează „mi-a dispărut pontajul din profil" verifică mai întâi fișa, nu poarta.
  — `src/app/(app)/profil/page.tsx`

## Ce NU e aici

Fișa de angajat — CNP, IBAN, contract, încadrare — e la [[modul/angajati]] și se vede în
portal, sub `employees:read = own`. Distincția contează: un utilizator poate avea cont fără
fișă (administrator, contabil extern), caz susținut explicit de invitația `fara_fisa`.

Avatarul se rezolvă prin `src/lib/avatar/cale.ts`, comun cu restul aplicației.

## Când NU e suficientă pagina asta

- Datele de personal: [[modul/angajati]].
- Ce vede angajatul despre sine: portalul, `src/app/(portal)/portal/`.
