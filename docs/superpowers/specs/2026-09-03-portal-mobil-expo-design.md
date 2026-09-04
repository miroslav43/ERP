# Portalul de angajat ca aplicație publicată — design

**Data:** 2026-09-03
**Stare:** aprobat în discuție, neimplementat
**Numărul migrării: `0122` sau mai departe, de reconfirmat.** La ora scrierii
ultima pe disc era `0120_registru_documente.sql`, dar în aceeași oră o altă sesiune
a adăugat `0121_inregistrare_publica.sql` — dovada, în timp real, că numărul nu se
scrie în avans. Se ia liberul de la momentul implementării, iar la coliziune decide
`internal.migrari_aplicate`: se mută migrarea **neaplicată**.

---

## 1. Problema

Portalul de angajat există și e complet: 68 de fișiere, 8.831 de linii, ~25 de ecrane
în `src/app/(portal)/` — pontaj, concedii, cursuri, diurnă, salariu, documente,
tichete, sesizări, KPI, integrare, echipă. Se instalează deja ca PWA
(`src/app/manifest.ts`, cu `id`, iconițe 192+512 și `display: standalone`).

Îi lipsesc trei lucruri, verificate în cod, nu presupuse:

1. **Nicio notificare care ajunge la telefon.** Căutare în `src/` după `PushManager`,
   `web-push`, `serviceWorker`: zero rezultate. Notificările sunt rânduri în
   `public.notifications`, vizibile doar cuiva care deschide portalul.
2. **Nicio prezență în magazine.** „Caută Administrativo în Play Store" e o
   propoziție; „Safari → partajare → derulează → Add to Home Screen" e un training.
3. **Sesiune fragilă pe iOS.** Instalarea PWA pe iOS _copiază_ cookie-urile din
   Safari (WebKit 17.2+), producând două depozite cu **același** refresh token; cu
   rotația Supabase activă, folosirea alternativă le poate revoca pe amândouă.

## 2. Decizia

**Aplicație Expo publicată prin EAS Build, ca înveliș nativ peste portalul web
existent.** Nu o rescriere în React Native.

Motivul e cantitativ: React Native împarte cu portalul doar React-ul, nu
componentele — fără `<div>`, fără CSS, fără Tailwind, fără Server Components, fără
Server Actions. Cele 8.831 de linii nu se portează, se rescriu, iar de atunci
înainte fiecare ecran nou din portal s-ar scrie de două ori. La ritmul acestui
proiect (22 de module, 121 de migrări), duplicarea aia e cea mai scumpă linie din
plan.

**Corecție de terminologie, pentru evitarea confuziei din discuția inițială:**
Expo Go este aplicația-sandbox de dezvoltare. Nu se publică prin ea și nu rulează
module native proprii. Livrarea se face cu **EAS Build**, care produce `.aab` și
`.ipa`.

## 3. Ce NU face versiunea asta

Scrise explicit, ca să nu reapară ca „ar fi bine și":

- **Fără offline.** Decizia din `manifest.ts` rămâne validă și nemodificată: o coadă
  offline ar trebui să rejoace acțiuni pe care politicile RLS le pot refuza la
  sincronizare. E un subsistem, nu o bifă.
- **Fără ecrane native.** Zero linii din portal rescrise. Dacă apare vreodată un
  ecran nativ, învelișul a crescut peste rolul lui și se rediscută.
- **Fără login nativ.** Fără `SecureStore`, fără rută de schimb token→cookie.
- **Fără service worker.** Nu se inversează decizia din `manifest.ts`.
- **Fără widget-uri, fără Live Activities, fără shortcut-uri native.**

## 4. Arhitectura

```
  ┌─ Aplicația Expo (un cod, două magazine) ────────────┐
  │  ┌───────────────────────────────────────────────┐  │
  │  │  WebView → administrativo.ro/portal/*         │  │
  │  │  cele ~25 de ecrane de azi, 0 linii rescrise  │  │
  │  └───────────────────────────────────────────────┘  │
  │  Nativ, lipit pe margini:                           │
  │   🔒 lacăt biometric la deschidere                  │
  │   🔔 push  →  deep link către notifications.link    │
  │   📷 scanner QR  →  /portal/ponteaza/[cod]          │
  │   ⬇  descărcare PDF + tipărire HTML                 │
  └─────────────────────────────────────────────────────┘
```

### Autentificarea

Login în WebView, pe ecranul existent. Serverul pune cookie-urile prin `Set-Cookie`
în cookie jar-ul **propriu aplicației** (WKWebView / Android WebView), izolat de
Safari și Chrome.

Asta desface capcana de la §1.3: sesiunea din aplicație e creată prin login propriu,
**nu e o copie** a celei din Safari, deci rotația refresh token-ului o tratează
normal.

Constatare care face varianta corectă, nu doar ieftină: **portalul nu instanțiază
niciodată clientul de browser Supabase.** `getBrowserSupabase` apare în șapte
fișiere, toate în `src/app/(app)/` — cursuri, angajați, onboarding, concedii, avatar
— și în niciunul din `(portal)`. Deci în portal nimic nu rescrie cookie-ul din
JavaScript; sesiunea e pusă exclusiv de server. Plafonul ITP de 7 zile al Safari
lovește storage-ul _scriptabil_, nu `Set-Cookie` de la server.

Lacătul biometric (`expo-local-authentication`) acoperă ecranul la revenire și **nu
atinge sesiunea**. Biometrie eșuată = ecran acoperit, nu deconectare.

## 5. Modificări în bază — migrarea `0122_push_dispozitive.sql`

Scheletul canonic din `0013_attendance.sql`: secțiuni numerotate, indexuri parțiale
`where deleted_at is null`, trio `_select`/`_insert`/`_update`, **nicio politică
DELETE**, `search_path = ''`, granturi în bucla `do $$`.

### 5.1 `public.dispozitive_push`

| coloană           | notă                                                         |
| ----------------- | ------------------------------------------------------------ |
| `id`              | uuid pk                                                      |
| `user_id`         | fk `auth.users`, on delete cascade                           |
| `organization_id` | fk `organizations`, on delete cascade                        |
| `jeton`           | text, `ExponentPushToken[…]`, check de formă                 |
| `platforma`       | enum nou `public.platforma_mobila` = `('ios','android')`     |
| `vazut_la`        | timestamptz — ultima dată când aplicația a confirmat jetonul |
| coada de audit    | `created_at/by`, `updated_at/by`, `deleted_at`               |

Index unic parțial pe `(jeton)` where `deleted_at is null`. Index pe
`(user_id, organization_id)` where `deleted_at is null`.

**RLS:** fiecare vede și scrie **doar** rândurile proprii (`user_id = auth.uid()`).
Fără cheie de permisiune nouă — nu există resursă „dispozitivul meu" și una
inventată ar întoarce `none`, adică refuz tăcut pentru toată lumea. Aceeași logică
pe care o urmează deja modulul Notificări.

### 5.2 `public.push_livrari` (coada)

| coloană           | notă                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------- |
| `id`              | uuid pk                                                                                |
| `notification_id` | fk `notifications`, on delete cascade                                                  |
| `dispozitiv_id`   | fk `dispozitive_push`, on delete cascade                                               |
| `stare`           | enum nou `public.stare_livrare_push` = `('in_asteptare','trimis','esuat','abandonat')` |
| `incercari`       | int not null default 0                                                                 |
| `trimis_la`       | timestamptz                                                                            |
| `eroare`          | text                                                                                   |
| coada de audit    | idem                                                                                   |

Index parțial pe `(stare, created_at)` where `stare = 'in_asteptare'`.

**RLS activat și `force`, fără nicio politică** — adică inaccesibilă oricărui rol de
aplicație. E o coadă de sistem, citită exclusiv de rută prin `createAdminSupabase()`,
cu comentariul obligatoriu care spune de ce se ocolește RLS și cu filtru explicit.
Nu se lasă tabela fără RLS: regula proiectului e RLS peste tot, iar o excepție
„pentru că oricum n-o citește nimeni" e exact felul în care apare a doua excepție.

### 5.3 Declanșatorul

`after insert on public.notifications` → inserează în `push_livrari` câte un rând
per dispozitiv activ al lui `notifications.user_id`, respectând
`notification_preferences.push`.

**Funcția trebuie să fie `security definer`, cu `search_path = ''`.** Fără asta,
declanșatorul rulează cu identitatea celui care a scris notificarea, iar politica de
pe `dispozitive_push` limitează citirea la `user_id = auth.uid()`. Cum actorul care
scrie o notificare aproape niciodată nu e destinatarul ei — un `manager` care aprobă
un concediu, un job `pg_cron` fără `auth.uid()` deloc — selectul dinăuntru ar
întoarce **zero dispozitive, fără nicio eroare**, iar coada ar rămâne goală la
nesfârșit. E clasa de defect pe care proiectul o repetă cel mai des: refuzul tăcut
care arată identic cu „n-a avut nimeni telefon instalat".

Coada REVOKE/GRANT obligatorie pe funcție, ca la orice funcție din proiect.

**De ce pe tabelă și nu în Server Actions:** o parte din notificări sunt scrise de
joburi `pg_cron` dinăuntrul bazei — `0103_pontaj_mementouri`, `0008_expirables`,
`0095_integrare_notificari` — care nu trec niciodată prin Next.js. Un expeditor
legat de aplicație ar rata fix memento-urile, adică notificările cu cea mai mare
nevoie de push.

### 5.4 O coloană, nu o tabelă

`alter table public.notification_preferences add column push boolean not null
default true`.

Tabela există din `0001_kernel.sql` cu `in_app` și `email` per fiecare din cele opt
valori ale enum-ului `notification_kind` (`info`, `success`, `warning`, `error`,
`task`, `reminder`, `approval`, `announcement`). Push-ul se așază acolo, nu lângă.

### 5.5 Programarea golirii

`pg_cron` la fiecare minut → `pg_net.http_post` către
`https://administrativo.ro/api/push/livreaza`, cu secret partajat în antet.

Ambele extensii se activează condiționat, ca în `0095_integrare_notificari.sql`
(`if exists (select 1 from pg_catalog.pg_available_extensions …)`), fiindcă migrarea
rulează și pe Postgres 17 gol în CI, unde nu există niciuna.

`pg_net` nu e folosit azi nicăieri — apare doar ca sugestie într-un comentariu din
`0008_expirables.sql:898`. Asta e prima lui folosire reală.

## 6. Rute noi în `src/app/api/`

### `POST /api/dispozitive`

Înregistrează sau reîmprospătează jetonul. Citește sesiunea din cookie-uri, deci
**nu are nevoie de niciun cod de autentificare nativ**: partea nativă injectează
jetonul în WebView, iar pagina face un `fetch` obișnuit care poartă cookie-urile.

`DELETE /api/dispozitive` la deconectare, apelat din aceeași pagină.

### `POST /api/push/livreaza`

Golește coada. Autentificare prin secret partajat (variabilă de mediu de server,
niciodată `NEXT_PUBLIC_`). Selecție cu `for update skip locked` — **cele două replici
Swarm nu se calcă reciproc**. Trimite lot către Expo Push API
(`https://exp.host/--/api/v2/push/send`), marchează `trimis`/`esuat`, incrementează
`incercari`, abandonează după N încercări.

Jetoanele respinse cu `DeviceNotRegistered` își marchează `dispozitive_push` cu
`deleted_at`.

### Deep link-ul e deja validat de bază

`notifications.link` are `check (link ~ '^/[^/\\]')` din `0001_kernel.sql` — cale
internă obligatorie, URL-uri absolute și protocol-relative respinse. Constrângerea a
fost scrisă împotriva injecției de `//evil.com` într-un clopoțel web; acum e exact
verificarea de care are nevoie un deep link, ca o notificare ostilă să nu deschidă
un site străin din interiorul unei aplicații semnate. Nu se mai adaugă nimic.

## 7. Aplicația Expo — `mobil/`

### Unde stă și de ce așa

`mobil/` la rădăcina repo-ului, **cu `pnpm-workspace.yaml` propriu**, exclus din
`tsconfig.json`, din configurația ESLint, din proiectele Vitest, din Prettier și
adăugat la `.dockerignore`. `pnpm verify` la rădăcină rămâne neschimbat.

**Capcană verificată empiric pe 2026-09-03, nu presupusă:**
`pnpm-workspace.yaml` de la rădăcină conține doar `ignoredBuiltDependencies`, fără
câmp `packages:`. Sub o astfel de rădăcină, `pnpm install` într-un subdirector cu
`package.json` propriu **raportează „Done" cu cod de ieșire 0 și nu instalează
nimic** — nici `node_modules/`, nici lockfile. Reprodus de trei ori, inclusiv cu
`--dir` explicit.

Cele două ieșiri care funcționează:

| soluție                                          | verdict                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `pnpm install --ignore-workspace`                | merge, dar cere ca fiecare om **și EAS Build** să-și amintească flagul |
| `mobil/pnpm-workspace.yaml` cu `packages: ["."]` | **ales** — `pnpm install` simplu funcționează, fără flag               |

Ce **nu** se face: adăugarea lui `packages:` în `pnpm-workspace.yaml` de la rădăcină.
Ar schimba semantica instalării pentru toate sesiunile concurente și pentru CI, ca
să rezolve o problemă locală de amplasare.

### Pachete

| pachet                        | pentru ce                                        |
| ----------------------------- | ------------------------------------------------ |
| `react-native-webview`        | portalul întreg                                  |
| `expo-notifications`          | jetonul push, permisiunea, atingerea notificării |
| `expo-local-authentication`   | lacătul la deschidere                            |
| `expo-camera`                 | scannerul QR                                     |
| `expo-print` + `expo-sharing` | tipărirea adeverinței, salvarea fluturașului     |
| `expo-linking`                | deep link-uri                                    |

Fără `expo-router`: nu există navigație de gestionat, WebView-ul _este_ navigația.
Estimare: sub 500 de linii de TypeScript nativ, total.

## 8. Descărcări și tipărire — obligatorii, nu opționale

Verificat în cod: două căi se rup **tăcut** într-un WebView netratat.

| cale                                     | ce întoarce                            | ce se întâmplă netratat                |
| ---------------------------------------- | -------------------------------------- | -------------------------------------- |
| `/api/export/salarizare/fluturas?…`      | PDF, `content-disposition: attachment` | descărcarea eșuează fără mesaj         |
| `/portal/cursurile-mele/[id]/adeverinta` | HTML de tipărit (`new Response(html)`) | nu există buton de tipărire în WebView |

Tratare, prin `onShouldStartLoadWithRequest`:

- **PDF** → pagina îl aduce ca blob, îl trimite nativ prin `postMessage`,
  `expo-sharing` deschide foaia de partajare a sistemului.
- **HTML de tipărit** → `expo-print` primește HTML-ul direct și dă tipărire reală pe
  ambele platforme — mai mult decât oferă azi browserul de pe telefon.

Autentificarea descărcării funcționează fără cod nativ de sesiune datorită unei
decizii deja luate în `src/lib/supabase/optiuni-cookie.ts`: `httpOnly: false`
(pus pentru încărcările directe în Storage). Efectul lateral e că pagina își poate
autentifica singură descărcarea.

**În portal nu există niciun `<input type="file">`** — jumătatea de sus a problemei
nu costă nimic.

## 9. Livrare

- `app.config.ts` cu URL-ul portalului per canal; producție → `administrativo.ro`.
- EAS ține cheile: cont de serviciu **FCM V1** pentru Android, cheie **APNs**
  generată de EAS pentru iOS.
- **Conținutul aplicației e portalul**, deci fiecare deploy web actualizează
  instantaneu aplicația, fără review de magazin. Prin magazine trec doar
  schimbările de înveliș. `expo-updates` acoperă și o parte din acelea.

## 10. Verificare

Partea de server intră în lanțul obișnuit:

- Teste Vitest pe golirea cozii și pe traducerea `notification` → mesaj push.
- Migrarea prin bancul local: `bash .claude/skills/administrativo/scripts/banc-migrare.sh`.
- **Proba reală per rol** pe `dispozitive_push`: un `employee` trebuie să-și poată
  insera jetonul și să **nu** poată citi jetonul altuia. Fără proba asta, o politică
  prea largă înseamnă că oricine poate trimite notificări oricui.
- **Proba POZITIVĂ pe declanșator**, la fel de obligatorie: sub identitatea unui
  `manager` care aprobă un concediu al unui `employee` cu dispozitiv înregistrat,
  `push_livrari` trebuie să primească **exact un rând**. Și încă una cu actor nul, ca
  la joburile `pg_cron`. Amândouă trec doar dacă funcția e `security definer` (§5.3);
  amândouă „trec" fals dacă verifici numai că nu apare nicio eroare.
- Aplicarea pe producție cere confirmare explicită separată.

Aplicația nativă rămâne deliberat prea mică pentru a avea nevoie de teste. Dacă
ajunge să aibă, a crescut peste rolul de înveliș.

## 11. Riscuri și necunoscute

1. **Ghidul Apple 4.2, „minimum functionality".** Push + biometrie + scanner +
   tipărire e un dosar bun, dar respingerea rămâne posibilă. Cost: un ciclu de
   review, nu o rescriere.
2. **Conturi de magazin.** 99 $/an Apple, 25 $ o dată Google, **număr D-U-N-S** la
   ambele pentru cont de organizație — se obține în zile-săptămâni. **Se cere
   primul**, în paralel cu codul, fiindcă e singura poziție din plan pe care n-o
   controlăm.
3. **Ștergerea contului.** Politica Google Play cere cale de ștergere pentru
   aplicațiile care permit crearea de conturi. Portalul e strict prin invitație — de
   verificat dacă asta scutește sau dacă e nevoie de un ecran.
4. **`sent_email_at` e avertismentul din casă.** Coloană proiectată în `0001` și
   niciodată scrisă de nimeni: trimiterea pe email a fost gândită și nu a fost
   construită. Push-ul are coadă, `incercari` și `eroare` tocmai ca să se _vadă_
   când nu funcționează, în loc să tacă.

## 12. Ordinea de construcție

Prima poziție nu e cod, fiindcă e singura cu timp de așteptare extern.

1. **D-U-N-S + conturile de magazin.** În paralel cu tot restul.
2. Migrarea `0121` + proba reală per rol. Aplicare pe cloud, cu confirmare.
3. `POST/DELETE /api/dispozitive` + teste.
4. `POST /api/push/livreaza` + teste pe golire, retry, `DeviceNotRegistered`.
5. `pg_cron` + `pg_net`, activate condiționat.
6. `mobil/` — schelet Expo, WebView, `pnpm-workspace.yaml` propriu, excluderile de la
   rădăcină.
7. Push nativ: permisiune, jeton, injectare în WebView, deep link.
8. Descărcări și tipărire.
9. Lacăt biometric, scanner QR.
10. Build EAS intern, probă pe telefon real, apoi publicare.
