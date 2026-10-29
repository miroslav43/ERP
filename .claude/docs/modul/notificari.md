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
scris_pe: 6e0792e9aa37ea9f4b874d856489a4f0b9344c20
scris_la: 2026-10-29
tags: [modul]
---

# Notificări

Clopoțelul: rândurile din `notifications` adresate utilizatorului curent. Tabela vine din
`0001_kernel.sql`, deci e mai veche decât aproape tot restul aplicației, iar module foarte
diferite scriu în ea.

## Paginile modulului

Trunchiul ține poarta, acțiunile, citirile și **unde duce o notificare** — plus secțiunea
pentru care se deschide pagina dintr-un bug. Lanțul de livrare pe telefon s-a spart
(`.claude/docs/meta/conventii.md`).

| Pagină                    | Ce ține                                                                         |
| ------------------------- | ------------------------------------------------------------------------------- |
| [[modul/notificari/push]] | cele cinci verigi ale push-ului, secretul în trei locuri, comentariile din 0122 |

## Fără poartă de permisiune pe modul — dar cu poarta paginilor-țintă

`/notificari` cere doar `requireTenant`. **Nu** are `requireFeature` și nu compară niciun
scope ca să decidă dacă intri — și e corect așa: nu există cheie `notifications:*` în
`role_permissions`, iar una inventată ar întoarce `none`, adică refuz tăcut pentru toată
lumea. Filtrarea rândurilor o face **exclusiv RLS**: fiecare vede rândurile lui.

`getPermissionMap` și `getEnabledFeatures` se cheamă totuși, din `page.tsx` și din
`citesteNotificarileRecente` — nu ca să te lase înăuntru, ci ca să decidă ce rând devine
link și ce rând rămâne text (mai jos). Cine adaugă aici un ecran „toate notificările
firmei" are nevoie întâi de o resursă de permisiune, nu de un filtru în TypeScript.

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
`requestId` în mesaj), iar revalidarea **doar** după succes. Fiindcă ocolesc
`createAction`, ambele fișiere de acțiuni importă `@/schemas/mesaje-zod` pentru efectul
lui: altfel harta de mesaje în română a lui Zod nu se încarcă, iar `z.flattenError` ar
întoarce engleza.

`citesteNotificarileRecente`, din același fișier, servește previzualizarea de la
clopoțelul din antet (`src/components/layout/clopotel.tsx`): necititele, tăiate la cinci,
cu aceeași traducere la obiect ca pe `/notificari`. Se cer LA DESCHIDEREA meniului, nu în
antet — antetul se randează pe fiecare navigare, iar contextul de legături costă o citire
sub RLS, pentru un meniu deschis rar. E singura din fișier care trece prin `requireTenant`
(are nevoie de organizație pentru porți) și singura cu `try`, fiindcă
`listeazaNotificarile` aruncă.

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
`listeazaNotificarile` aruncă, taie la `LIMITA_LISTA_NOTIFICARI` — exportată tocmai ca
ecranul să ȘTIE unde s-a oprit, altfel lungimea listei trece drept total — și aduce
`entity_type`/`entity_id`, fără care traducerea de mai jos n-ar avea obiect.

## Unde duce o notificare — se decide LA RANDARE, nu la scriere

Producătorii (triggere, câteva acțiuni) scriu un `link` fix: coada în loc de cerere,
`/pontaj/saptamana` fără săptămână, `/portal/...` pentru oricine și-a pontat ziua, `/reges`
și la firmele fără modul. Rândul NU se corectează în bază; se traduce în trei locuri, pe
aceeași regulă: **obiectul bate coada, iar ținta trece prin poarta paginii-ȚINTĂ**.

- **Aplicația mare**: `notificari/legaturi.ts` (`caleaInAplicatie`, pur, testat) +
  `context.ts` (o citire pe lot, sub RLS: săptămâni, înrolări, anunțuri încă vizibile).
  Obiectul (`entity_type`/`entity_id`) bate coada; `prinPoarta` cere `poateDeschide` din
  `src/config/porti-ruta.ts`; ce nu se deschide devine `null` = text, nu refuz. Rută
  necunoscută registrului = se lasă cum e. Legăturile de portal ajunse la un manager sau
  la HR se traduc în echivalentul din aplicație, pe fișa proprie (`idFisaProprie`) —
  altfel layout-ul portalului i-ar scoate pe `/panou`.
- **Portal**: `caleaDePortal(link, context, entitate)` — al treilea argument deschide
  săptămâna exactă (`attendance_week_submission` prin `saptamani` din context;
  `attendance_week_submission_missing` o citește din corp, cu `ziuaRomaneascaDinText`).
  Clasa „aceeași legătură pleacă și la aprobator" cere proprietate dovedită:
  `/onboarding/<id>` prin `integrariProprii`, `/flota/foi/<uuid>` prin `foiProprii` —
  proprietarul de portal al foii e ȘOFERUL ei, nu aprobatorul. Ce nu-i aparține rămâne
  text. `/flota/rezervari` e în harta fixă; coada aprobatorilor
  `/flota/rezervari?stare=ceruta`, nu.
- **Push**: `construiesteMesaj({ rol })` — pentru un rol din aplicația mare rămân link
  DOAR obiectele proprii (`TIPAR_OBIECT_PROPRIU`); restul cade pe cutia poștală.
  `golesteCoada` citește rolul per dispozitiv din `organization_members`
  (`roluriPeDispozitiv`); citirea picată lasă rolul necunoscut, adică tratare ca angajat.

Producătorul REGES e singurul reparat la sursă: fără `organization_features.reges` activ
nu scrie anunț, iar linkul e coada (`/reges?stare=de_transmis`), cu termenul în
`zz.ll.aaaa` prin `formatDate` (`genereaza-evenimente.ts`). Lipsesc încă senderii pentru
KPI și predări de inventar. Au sender din W2-03
(`0192_notificari_fluxuri_lipsa.sql` + TS lângă producător): diurna (trimitere, decizie pe
deplasare și pe cheltuială), pontajul lunar (zi respinsă, zi aprobată, bloc — una per
angajat pe lună, `pontaj/anunta-*.ts`), tichetele (repartizare, comentarii publice —
triggere) și legarea fișei de un membru existent la înrolare.
Închiderea „de aprobat": triggerul generic pe `approval_tasks` marchează citite
notificările aprobatorului când sarcina lui iese din `in_asteptare` (decisă sau anulată de
surori); tichetele își închid `approval`-ul la ieșirea din `in_aprobare`; deplasările, fără
`approval_tasks`, se închid din `decideDeplasare` — o retragere viitoare trebuie s-o facă și ea.

## Ce refuză baza tăcut

- **Marcarea ca citită a unei notificări care nu e a ta atinge zero rânduri, fără eroare.**
  Politica filtrează prin `USING`. Aici însă golul e singurul loc din proiect care NU se
  tratează drept conflict: `marcheazaNotificareaCitita` e deliberat **fără** `.select()`,
  fiindcă `.is("read_at", null)` face al doilea clic să atingă zero rânduri, iar celelalte
  două căi spre gol — notificare ștearsă sau a altcuiva — n-au nimic de comunicat celui
  care își golește cutia. Un `throw` pe rezultat gol ar face din dublul clic o eroare.
  Excepția e fixată de `actions.test.ts`; nu o „repara" după capcana #17.
- **O citire de context picată nu oprește ecranul — doar retrogradează legătura.**
  `contextAplicatie` și `contexteDestinatar` loghează eroarea pe `console.error` și
  întorc contextul gol; rândul rămâne pe linkul lui de bază, trecut prin poartă, ori
  devine text. Verificat pe clientul fals în
  `src/app/(portal)/portal/notificarile-mele/context.test.ts`.
- **Notificarea e un plus, nu poarta.** Acolo unde o acțiune scrie și o notificare — decizia
  pe o cerere de concediu, de exemplu — INSERT-ul eșuat se loghează, iar acțiunea principală
  rămâne dată. Un flux care depinde de sosirea notificării ca să fie corect e proiectat
  greșit.

## Când NU e suficientă pagina asta

- Lanțul de livrare pe telefon, de la jeton la atingere: [[modul/notificari/push]].
- Cine produce notificările: [[modul/anunturi]], [[modul/concedii]], [[modul/onboarding]].
- Registrul de porți pe rută (`poateDeschide`, `legaturaSigura`) și clopoțelul din antet: [[strat/navigare]].
- Lotul 7n (migrări 0188–0189, pe banc; producția după confirmare): duplicatul primește linkul lui; aprobatorii respectă rândul de membru (`internal.scope_membru`): [[strat/navigare]].
