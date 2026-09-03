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
scris_pe: 0815fbff2c885cd44b5768ee25f084f16a9e95b8
scris_la: 2026-09-03
tags: [modul]
---

# Avizier (anunțuri)

Anunțuri publicate întregii firme, cu confirmare de citire per angajat. Modulul cel mai
mic din proiect și, din cauza asta, **referința pentru preambulul unei pagini**: `CLAUDE.md`
trimite la `src/app/(app)/anunturi/page.tsx` pentru lanțul canonic
`requireTenant` → `requireFeature` → `getPermissionMap` → `can()` → `AccesRestrictionat`.

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

## De ce nu există direcționare pe departament

`announcement_attachments` și `announcement_targets` figurau în planul aprobat și au rămas
**neconstruite deliberat**. Motivul e seed-ul: `announcements:read = all` e acordat tuturor
rolurilor, deci un anunț e mereu vizibil întregii organizații. O tabelă de direcționare ar
fi fost decorativă cât timp pragul de citire e `all` pentru toată lumea.

Ordinea corectă, dacă apare vreodată nevoia: **întâi se schimbă seed-ul de permisiuni**,
abia apoi tabela. Invers, tabela ar exista fără să restrângă nimic.

## Ce refuză baza tăcut

- **Confirmarea de citire e unică pe (organizație, anunț, angajat)**, prin index unic. O a
  doua confirmare cade cu 23505; acțiunea o tratează ca reușită, fiindcă efectul dorit
  există deja.
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
