---
tip: modul
titlu: Notificări
aliases: [notificari, notifications, clopotel]
cai:
  - "src/app/(app)/notificari/**"
  - "src/lib/queries/notifications.ts"
  - "supabase/migrations/0001_kernel.sql"
tabele: [notifications]
permisiuni: []
capcane: [17]
scris_pe: 0815fbff2c885cd44b5768ee25f084f16a9e95b8
scris_la: 2026-09-03
tags: [modul]
---

# Notificări

Clopoțelul: rândurile din `notifications` adresate utilizatorului curent. Tabela vine din
`0001_kernel.sql`, deci e mai veche decât aproape tot restul aplicației, iar module foarte
diferite scriu în ea.

## Singurul modul fără poartă de permisiune

`/notificari` cere doar `requireTenant`. **Nu** are `requireFeature`, nu cheamă
`getPermissionMap`, nu compară niciun scope — și e corect așa: nu există cheie
`notifications:*` în `role_permissions`, iar una inventată ar întoarce `none`, adică refuz
tăcut pentru toată lumea.

Filtrarea o face **exclusiv RLS**: fiecare vede rândurile lui. Cine adaugă aici un ecran
„toate notificările firmei" are nevoie întâi de o resursă de permisiune, nu de un filtru în
TypeScript.

Poarta de SCRIERE e însă reală și trăiește tot în politică: cine scrie o notificare **în
numele altui utilizator** trebuie să aibă `announcements:create`. De aceea fanout-ul din
[[modul/anunturi]] merge, iar un modul oarecare nu poate trimite mesaje în numele nimănui.

## Acțiuni

`src/app/(app)/notificari/actions.ts` — funcții simple, nu `createAction`:
`marcheazaNotificareaCitita`, `marcheazaToateNotificarileCitite` și învelișul
`trimiteMarcheazaToateCitite`, folosit ca `action` de formular. Nu trec prin cele opt
straturi fiindcă n-au ce autoriza dincolo de RLS și n-au nimic de auditat: „mi-am citit
notificarea" nu e un fapt de reținut în jurnal.

## Ce refuză baza tăcut

- **Marcarea ca citită a unei notificări care nu e a ta atinge zero rânduri, fără eroare.**
  Politica filtrează prin `USING`; ecranul nu trebuie să raporteze succes pe baza absenței
  unei erori. — capcana #17
- **Notificarea e un plus, nu poarta.** Acolo unde o acțiune scrie și o notificare — decizia
  pe o cerere de concediu, de exemplu — INSERT-ul eșuat se loghează, iar acțiunea principală
  rămâne dată. Un flux care depinde de sosirea notificării ca să fie corect e proiectat
  greșit.

## Când NU e suficientă pagina asta

- Cine produce notificările: [[modul/anunturi]], [[modul/concedii]], [[modul/onboarding]].
