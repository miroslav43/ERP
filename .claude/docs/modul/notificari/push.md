---
tip: modul
titlu: Notificări — push pe telefon
aliases: [push, dispozitive_push, push_livrari, expo, push-livrare]
cai:
  - "src/lib/push/**"
  - "src/app/api/push/**"
  - "src/app/api/dispozitive/**"
  - "supabase/migrations/0122_push_dispozitive.sql"
  - "supabase/migrations/0001_kernel.sql"
  - "deploy/push-livrare.service"
  - "deploy/push-livrare.timer"
tabele: [dispozitive_push, push_livrari, notification_preferences, notifications]
permisiuni: []
capcane: []
scris_pe: 6e0792e9aa37ea9f4b874d856489a4f0b9344c20
scris_la: 2026-10-29
tags: [modul]
---

Secțiune extrasă din [[modul/notificari]]: lanțul de livrare pe telefon, de la
înregistrarea jetonului până la atingere, cu felul propriu de a tăcea al fiecărei
verigi.

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

- Cum se alege calea trimisă în `data.cale`, pe rol și pe obiect: [[modul/notificari]].
- Instalarea timerului și cele trei locuri ale secretului: `DEPLOY.md`.
- Aplicația mobilă în sine (build EAS, magazine, ce nu se poate proba local): `mobil/README.md`.
