---
tip: modul
titlu: Avizier (anunțuri)
aliases: [anunturi, avizier, announcements]
cai:
  - "src/app/(app)/anunturi/**"
  - "src/lib/queries/announcements.ts"
  - "src/schemas/announcement.ts"
  - "supabase/migrations/0028_announcements.sql"
tabele: [announcements, announcement_reads, notifications]
permisiuni: [announcements:read, announcements:create, announcements:update]
feature: announcements
capcane: [17]
scris_pe: 074209a31c682afb49b59c9e6b9989693e9f179e
scris_la: 2026-10-02
tags: [modul]
---

# Avizier (anunțuri)

Anunțuri publicate întregii firme, cu confirmare de citire per angajat. Modulul cel mai
mic din proiect și, din cauza asta, **referința pentru preambulul unei pagini**: `CLAUDE.md`
trimite la `src/app/(app)/anunturi/page.tsx` pentru lanțul canonic
`requireTenant` → `requireFeature` → `getPermissionMap` → `can()` → `AccesRestrictionat`.

Săgețile din lanț sunt ordinea deciziilor, nu ordinea așteptărilor. În
`src/app/(app)/anunturi/page.tsx` și în `src/app/(app)/anunturi/[id]/page.tsx`,
`requireFeature` și `getPermissionMap` pleacă împreună într-un `Promise.all`: citesc
tabele diferite, niciuna n-are nevoie de rezultatul celeilalte, iar în serie erau două
dus-întorsuri către PostgREST unul după altul. Refuzurile rămân în aceeași ordine —
`notFound()` din `requireFeature` respinge `Promise.all`, deci un modul dezactivat dă
404 înainte ca `can()` să ajungă să se uite la permisiuni. Doar `requireTenant` rămâne
obligatoriu înaintea lor: le dă amândurora argumentele.

## Rute și cine ajunge

| Rută             | Poartă                                                    |
| ---------------- | --------------------------------------------------------- |
| `/anunturi`      | `announcements:read` own; administrarea cere `update` all |
| `/anunturi/[id]` | idem                                                      |

Toate rolurile au `announcements:read = all` în seed. Nu există anunț „pentru un
departament".

## Server Actions

| Funcție               | Permisiune / minScope        |
| --------------------- | ---------------------------- |
| `creeazaAnunt`        | `announcements:create` / all |
| `publicaAnunt`        | `announcements:update` / all |
| `marcheazaAnuntCitit` | `announcements:read` / own   |

`marcheazaAnuntCitit` e singura acțiune din modul pe care o poate chema un angajat — de
aceea e pe `read`, nu pe `update`: confirmarea de citire nu e o modificare a anunțului.

Auditul lui `creeazaAnunt` are allow-list `["titlu", "fixat"]`: `continut` nu intră
niciodată în jurnal, deci jurnalul de audit nu e o a doua copie a textului anunțului.

## De ce nu există direcționare pe departament

`announcement_attachments` și `announcement_targets` figurau în planul aprobat și au rămas
**neconstruite deliberat**. Motivul e seed-ul: `announcements:read = all` e acordat tuturor
rolurilor, deci un anunț e mereu vizibil întregii organizații. O tabelă de direcționare ar
fi fost decorativă cât timp pragul de citire e `all` pentru toată lumea.

Ordinea corectă, dacă apare vreodată nevoia: **întâi se schimbă seed-ul de permisiuni**,
abia apoi tabela. Invers, tabela ar exista fără să restrângă nimic.

## Citiri

`src/lib/queries/announcements.ts` începe cu `import "server-only"`: o componentă client
sau un test care ar importa fișierul cade la încărcare, nu la prima interogare.

Cele două liste ale modulului filtrează din locuri diferite, intenționat.
`listeazaAnunturi` (administrare) nu reproduce nimic: ce vede cititorul îl decide
`announcements_select`, de unde și ciornele vizibile adminului. `anunturiPublicate`
(portal) scrie filtrul „publicat, neexpirat" **explicit în interogare**, fiindcă „ale
mele" din portal trebuie să însemne același lucru indiferent de scope-ul celui care
deschide ecranul — regula e cea din capul lui `queries/portal.ts`. Marca temporală intră
ca argument `acum`, ca citirea să rămână deterministă la test.

## Ce refuză baza tăcut

- **Confirmarea de citire e unică pe (organizație, anunț, angajat)**, prin
  `announcement_reads_uq` (`0028_announcements.sql:54-55`). `marcheazaAnuntCitit` caută
  confirmarea înainte de a o scrie, deci a doua apăsare pe același ecran nici nu ajunge la
  INSERT. Cursa rămâne: două file deschise pe același anunț trec amândouă de căutare, a
  doua ia 23505, iar handlerul îl ridică mai departe — `mapPostgrestError` îl traduce în
  `CONFLICT` („Există deja o înregistrare cu aceste date"), adică un mesaj de eroare pentru
  ceva ce s-a întâmplat deja. Defect cunoscut, fixat ca `it.fails` în
  `src/app/(app)/anunturi/actions.test.ts`: e stare curentă, nu contract — nu scrie nicăieri
  că acțiunea înghite 23505, fiindcă n-o face.
- **Un utilizator fără fișă de angajat** (administrator pur) primește reușită de la
  `marcheazaAnuntCitit` fără ca nicio confirmare să se scrie: `idFisaProprie` întoarce
  `null` și handlerul iese devreme. De aceea numitorul raportului de citire e
  `numarAngajatiCuCont`, nu `numarAngajatiActivi` — cine nu are cont nu poate confirma.
- **Publicarea la creare nu e atomică.** `creeazaAnunt` cu `publica_acum` inserează
  anunțul, apoi scrie notificările într-o a doua rundă, fără o tranzacție comună. Dacă
  fanout-ul e respins, acțiunea întoarce eroare și nu revalidează nimic, dar anunțul rămâne
  pe disc, publicat și fără notificări. Un „a eșuat" pe ecran nu înseamnă aici „nu s-a
  scris nimic".
- **Un anunț nepublicat e invizibil angajaților**, dar rămâne vizibil administratorilor, ca
  să-l poată edita înainte de publicare sau după expirare. Deci o listă goală pentru
  angajat, cu rânduri pentru admin, e comportamentul corect, nu un defect de filtrare.
- **`publicaAnunt` e o tranziție**: face `.select()` după `.update()`, iar rezultatul gol
  înseamnă conflict, nu succes. — capcana #17

## Ce se mișcă împreună

Publicarea face fanout în `notifications` (`0001_kernel.sql`). Poarta de acolo verifică
explicit `announcements:create` pentru cine scrie o notificare în numele altui utilizator —
integrarea era pregătită din nucleu, nu improvizată la `0028`. Ecranul care le arată e
[[modul/notificari]].

## Când NU e suficientă pagina asta

- Tiparul complet al unei pagini noi: `docs/project-overview.md`.
- Ce se întâmplă cu notificarea după fanout: [[modul/notificari]].
- Comportamentul exact al celor trei acțiuni, executabil:
  `src/app/(app)/anunturi/actions.test.ts` — payload-uri, filtre, allow-list de audit, căi
  revalidate și singurul defect încă nereparat. Straturile comune ale lui `createAction` se
  verifică o singură dată, în `src/app/(app)/salarizare/actions.test.ts`.
