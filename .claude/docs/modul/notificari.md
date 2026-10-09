---
tip: modul
titlu: Notificări
aliases: [notificari, notifications, clopotel]
cai:
  - "src/app/(app)/notificari/**"
  - "src/app/(portal)/portal/notificarile-mele/**"
  - "src/lib/queries/notifications.ts"
  - "src/lib/push/**"
  - "src/lib/reges/genereaza-evenimente.ts"
  - "src/app/api/push/**"
  - "src/app/api/dispozitive/**"
  - "supabase/migrations/0001_kernel.sql"
  - "supabase/migrations/0122_push_dispozitive.sql"
  - "deploy/push-livrare.service"
tabele: [notifications, notification_preferences, dispozitive_push, push_livrari]
permisiuni: []
capcane: [17, 39]
scris_pe: 4a7494c169d49b92dc1c538a5d42748cdeab5ea7
scris_la: 2026-10-09
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

Ce pun totuși — și ce ține acum pe loc `actions.test.ts`: `requireUser` ÎNAINTE de orice
(fără sesiune, baza nu e atinsă deloc), Zod `z.uuid` ⇒ `VALIDARE` cu `fieldErrors.id` și
zero scrieri, filtru explicit pe `user_id` peste cel al politicii, `.is("read_at", null)`,
erorile prin `mapPostgrestError` (42501 ⇒ `INTERZIS`; necunoscutul ⇒ `EROARE_INTERNA` cu
`requestId` în mesaj), iar revalidarea **doar** după succes.

`reimprospateazaCutiaPostala` atinge trei căi — `/notificari`,
`/portal/notificarile-mele` și `/portal`, fiindcă pastila de necitite trăiește în antetul
portalului. Fără a treia, omul marchează citit și vede tot nemarcat: nu e o eroare, e
cache-ul de Router.

`src/app/(portal)/portal/notificarile-mele/actions.ts` ține scrierile din portal —
`retrageDispozitivul` cu învelișul `trimiteRetragereDispozitiv`, și
`comutaNotificarilePush` cu `trimiteComutarePush`. Lista felurilor,
`FELURI_NOTIFICARE`, stă **alături**, în `feluri.ts`, nu în `actions.ts`: un fișier
`"use server"` nu poate exporta decât funcții async, iar o constantă exportată de acolo
trece de `typecheck`, `lint` și `test` și cade abia la `next build`, în „Collecting page
data". Poarta care o prinde acum în două secunde e `pnpm check:server`. — capcana #39

## Citiri

`src/lib/queries/notifications.ts`, marcat `import "server-only"` — un import dinspre
client cade la build, nu în producție. `numaraNecitite` înghite eroarea și întoarce `0`:
pastila e ornament, iar o excepție acolo ar doborî antetul, deci navigarea.
`listeazaNotificarile` aruncă, și taie la `LIMITA_LISTA_NOTIFICARI` — exportată tocmai ca
ecranul să ȘTIE unde s-a oprit, altfel lungimea listei trece drept total.

## Unde duce o notificare — se decide LA RANDARE, nu la scriere

Producătorii (triggere, câteva acțiuni) scriu un `link` fix: coada în loc de cerere,
`/pontaj/saptamana` fără săptămână, `/portal/...` pentru oricine și-a pontat ziua, `/reges`
și la firmele fără modul. Rândul NU se corectează în bază; se traduce de două ori:

- **Aplicația mare**: `notificari/legaturi.ts` (`caleaInAplicatie`, pur, testat) + `context.ts`
  (o citire pe lot, sub RLS: săptămâni, înrolări, anunțuri încă vizibile). Obiectul
  (`entity_type`/`entity_id`) bate coada; ținta trece prin poarta paginii-ȚINTĂ
  (`poateDeschide`); ce nu se deschide devine `null` = text, nu refuz. Rută necunoscută
  registrului = se lasă cum e.
- **Portal**: `caleaDePortal(link, context, entitate)` — al treilea argument deschide
  săptămâna exactă; `/onboarding/<id>` doar pentru parcursul propriu.
- **Push**: `construiesteMesaj({ rol })` — pentru un rol din aplicația mare rămân link DOAR
  obiectele proprii (`TIPAR_OBIECT_PROPRIU`); restul cade pe cutia poștală. `golesteCoada`
  citește rolul din `organization_members` per dispozitiv.

Producătorul REGES e singurul reparat la sursă: fără `organization_features.reges` nu
scrie anunț (`genereaza-evenimente.ts`). Lipsesc încă senderii pentru deplasări, KPI,
predări de inventar.

## Ce refuză baza tăcut

- **Marcarea ca citită a unei notificări care nu e a ta atinge zero rânduri, fără eroare.**
  Politica filtrează prin `USING`. Aici însă golul e singurul loc din proiect care NU se
  tratează drept conflict: `marcheazaNotificareaCitita` e deliberat **fără** `.select()`,
  fiindcă `.is("read_at", null)` face al doilea clic să atingă zero rânduri, iar celelalte
  două căi spre gol — notificare ștearsă sau a altcuiva — n-au nimic de comunicat celui
  care își golește cutia. Un `throw` pe rezultat gol ar face din dublul clic o eroare.
  Excepția e fixată de `actions.test.ts`; nu o „repara" după capcana #17.
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
- **Caractere de control în link.** Poarta de formă `^/[^/\\]` — aceeași ca `check`-ul de
  pe `notifications.link`, `0001_kernel.sql:381` — acceptă un tab pe poziția a doua, iar
  parserele de URL care elimină tab-ul și newline-ul citesc apoi șirul ca URL absolut
  protocol-relativ. `areCaractereDeControl` din `src/lib/push/mesaj.ts` îl oprește, tăcut,
  pe `CALE_IMPLICITA`. Stratul din cod e deliberat mai strict decât constrângerea din
  bază: migrarea aplicată nu se mai atinge, iar asimetria merge în direcția sigură.
  Astăzi poarta e inaccesibilă — toate valorile `link` sunt literale din cod sau derivate
  dintr-un UUID, niciuna intrare de utilizator.
- **Predarea telefonului abandonează doar `in_asteptare`.** Când jetonul înregistrat e al
  altcuiva, `retrageDispozitivPrinAdmin` (`src/app/api/dispozitive/route.ts`) trece pe
  `abandonat` numai livrările `in_asteptare`; cele `in_lucru` sunt deja în zbor spre
  `exp.host` sub `for update skip locked`, iar marcarea lor de aici ar fi o cursă
  scriere-scriere cu `golesteCoada` — și o minciună în jurnal, fiindcă notificarea chiar a
  plecat. Nu scapă nimic: Pasul 1 din `app.push_ia_din_coada` abandonează orice rând al
  unui dispozitiv retras, iar un `in_lucru` agățat e recuperat după zece minute.
- **Cele trei scrieri ale retragerii nu sunt o tranzacție** — motivul exact al eșecului
  merge în jurnal (`console.error`), răspunsul rămâne generic, iar remediul diferă după
  care a picat. Dacă e rândul de audit, retragerea E făcută, dar rămâne doar urma
  triggerului, cu `actor_id` NULL sub `service_role`: se știe CĂ s-a întâmplat, nu și CINE
  a preluat telefonul.

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
- Lotul 7m: clopoțelul din antet previzualizează ultimele 5 necitite, traduse la obiect la deschidere (`citesteNotificarileRecente`): [[strat/navigare]].
