---
tip: modul
titlu: Notificări
aliases: [notificari, notifications, clopotel]
cai:
  - "src/app/(app)/notificari/**"
  - "src/app/(portal)/portal/notificarile-mele/**"
  - "src/lib/queries/notifications.ts"
  - "src/lib/push/**"
  - "src/app/api/push/**"
  - "src/app/api/dispozitive/**"
  - "supabase/migrations/0001_kernel.sql"
  - "supabase/migrations/0122_push_dispozitive.sql"
  - "deploy/push-livrare.service"
tabele: [notifications, notification_preferences, dispozitive_push, push_livrari]
permisiuni: []
capcane: [17]
scris_pe: 7b0743024ed266fcaecc6c1cbeb56ed31bd257df
scris_la: 2026-09-04
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

## Push pe telefon — lanțul, și unde se rupe

Din `0122_push_dispozitive.sql`. Cinci verigi, fiecare cu propriul fel de a tăcea:

1. **Aplicația** (`mobil/`) își înregistrează jetonul Expo la FIECARE pornire —
   `inregistrat` e un `useRef`, deci se pierde la repornire. `POST /api/dispozitive`.
2. **Declanșatorul** `internal.push_pune_in_coada()` pune un rând în `push_livrari` per
   dispozitiv viu — dar NUMAI dacă `notification_preferences.push` nu e `false` pentru
   acel `(user, organizație, kind)`. Fără rând de preferință, implicitul e `true`.
3. **Timerul** `deploy/push-livrare.timer`, la un minut, cheamă `POST /api/push/livreaza`.
4. **`golesteCoada`** ia lotul cu `for update skip locked` și îl trimite la `exp.host`.
5. **Aplicația** primește și, la atingere, deschide calea din `data.cale`.

### Ce refuză tăcut, pe fiecare verigă

- **Secret gol ⇒ ruta răspunde 404 la TOT.** Indistinct de „rută inexistentă". Iar
  `PUSH_CRON_SECRET` trebuie să fie în TREI locuri: `.env.production`, blocul
  `environment:` din `docker-stack.yml` (Swarm nu propagă ce nu e enumerat) și
  `/etc/administrativo/push.env`. Lipsa din oricare oprește tot lanțul, fără eroare.
- **Timerul NU poate ajunge la aplicație pe `127.0.0.1:3000`** — serviciul Swarm nu
  publică porturi. Se merge prin nginx-ul local, cu `--resolve`, fără `-L`.
- **Un bilet „ok" de la Expo nu înseamnă LIVRAT**, ci acceptat. Chitanțele
  (`getReceipts`) nu se cer încă — vezi mai jos.
- **Canalul Android.** `channelId: "implicit"` se creează în aplicație, la pornire.
  Android ignoră tăcut o notificare trimisă pe un canal inexistent.
- **Legătura care duce în 404.** `caleaDePortal` traduce `/concedii/<uuid>` și
  `/ticketing/<uuid>` DOAR dacă entitatea îi aparține destinatarului: aceleași legături
  ajung, din triggere, și la HR, aprobatori sau managerul direct, iar ecranele „ale mele"
  cheamă `notFound()`. Fără `ContextDestinatar`, nu se traduce — implicitul e cel sigur.

### Două comentarii FALSE în `0122`, care nu se pot repara acolo

Migrarea e aplicată pe cloud (2026-09-04 06:08:16); forward-only, deci fișierul nu se mai
atinge — o editare i-ar schimba suma de control față de `internal.migrari_aplicate` și ar
semnala un drift care nu există. Corecțiile stau aici:

- `0122:189-191` descrie potrivirea pe `organization_id` din politica `_update`. A fost
  **scoasă** la reparația 5; politica potrivește azi doar pe `user_id`.
- `0122:288-289` spune că „repo-ul n-are niciun `alter default privileges`". E literal
  fals — sunt trei, `on functions`, la `0002:1559-1561`. Concluzia rămâne corectă;
  formularea a pierdut calificativul. Din cauza lor, `service_role` are pe
  `push_livrari` și drepturi care nu apar în `grant`-ul explicit din `0122` (`DELETE`,
  folosit de retenția din `coada.ts`).

### Ce NU există încă

- **Chitanțele Expo.** `push_livrari` n-are coloană pentru id-ul biletului, deci
  corelarea cere o migrare. Consecință: un jeton care a murit între înregistrare și
  livrare rămâne în tabelă până când Expo îl respinge la o trimitere ulterioară.
- **Matricea de preferințe pe fel × canal.** `notification_preferences` o suportă, dar
  n-are ecran nici aici, nici în aplicația mare. `portal/notificarile-mele` are doar
  comutatorul „toate felurile, pe telefon".

## Când NU e suficientă pagina asta

- Cine produce notificările: [[modul/anunturi]], [[modul/concedii]], [[modul/onboarding]].
- Instalarea timerului și cele trei locuri ale secretului: `DEPLOY.md`.
- Aplicația mobilă în sine (build EAS, magazine, ce nu se poate proba local): `mobil/README.md`.
