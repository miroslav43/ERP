# Latența percepută — de la clic la primul pixel

**Data:** 2026-09-03 · **Abordare aprobată:** A (șase intervenții chirurgicale, fără
infrastructură nouă) · **Status:** spec, neimplementat

---

## 1. Problema, în cuvintele utilizatorului

> „Dau click și durează câteva secunde bune până se întâmplă ceva.”

Întrebat care clic doare, răspunsul a fost: **navigarea în meniu, salvarea unui formular, și
„peste tot, uniform”.**

Cuvântul care contează e *uniform*. Dacă lentoarea ar veni din interogările unei pagini anume, ar
fi inegală — Pontajul lent, Anunțurile instant. Uniformitatea e semnătura unui **cost fix pe
cerere**, plătit înainte ca pagina să înceapă să-și ceară datele.

## 2. Ce s-a măsurat

124 de măsurători, pe 7 straturi, executate pe VM-ul de producție și pe baza live
(numai `SELECT`/`EXPLAIN`). Costurile unitare:

| ce | cald | rece |
| --- | --- | --- |
| un apel GoTrue (`/auth/v1/user`) | 90 ms | 180 ms |
| un apel PostgREST (`/rest/v1/…`) | 110 ms | 200 ms |
| execuția în Postgres | **2,32 ms** medie ponderată pe 43 296 de apeluri (`pg_stat_statements`) | |
| Redis local (`strawboss-app_redis`, deja pe VM) | avg **1,66 ms** | |
| verificare locală a unui JWT ES256 | **1,7 ms** (`importKey` 0,433 + `verify` 1,269) | |

**Baza de date nu e problema.** Cel mai mare tabel are 2 795 de rânduri; Postgres răspunde în
milisecunde. Problema e că aplicația vorbește cu el de 6–10 ori pe rând, prin HTTP, peste
Cloudflare și Kong.

### Bugetul reconstruit

Navigare simplă: **≈ 1,2 s**, ×2,5 dacă clicul cade în propria rafală de prefetch → **1,2–2,5 s**.

Clic care salvează:

| | ms |
| --- | --- |
| proxy `getUser` (socket rece) | 180 |
| `createAction` → `resolveTenant` (getUser + `organization_members`) | 200 |
| module + permisiuni, în lanț | 220 |
| scrierea propriu-zisă | 110–330 |
| `writeAuditLog` — **așteptat** (`create-action.ts:233`) | 110 |
| `revalidatePath` → re-randare completă în același POST | 860 |
| `router.refresh()` → a treia randare completă | 950 |
| transport + client | 150 |
| **total** | **≈ 2,8 – 3,3 s** (4–6 s sub rafală) |

### Trei constatări neașteptate

1. **Amplificarea reală a utilizatorului e 34,9×.** Filtrat pe IP-ul lui în jurnalele nginx:
   **11 745 de cereri pentru 336 de documente**; 9 283 sunt RSC, toate cu status 200 — randări
   complete, nu redirecturi. Vârf de 38 într-o singură secundă.
2. **Clicul pe un rând de tabel nu produce niciun feedback.** `rand-tabel.tsx:37` face
   `router.push(destinatie)` gol, în afara oricărui `useTransition`. Voalul global
   (`PRAG_VOAL = 400`, `src/lib/incarcare/praguri.ts:24`) nu se aprinde niciodată. Pe 19 pagini
   de listă, ecranul rămâne identic până sosește pagina nouă.
3. **Utilizatorul e în Timișoara, pe RCS & RDS, rutat prin Frankfurt.** `cf-ray` arată constant
   `-FRA`/`-CDG`, nu `OTP`. Adică **+25–30 ms per dus-întors** peste tot ce s-a măsurat de pe VM,
   înmulțit cu ~35 de cereri per navigare.

### Cauza rădăcină a amplificării

`node_modules/next/dist/docs/01-app/02-guides/prefetching.md:61-62`:

| ruta | ce se prefetchează | TTL |
| --- | --- | --- |
| **fără** `loading.js` | pagina întreagă | 5 min (`staleTimes.static`) |
| **cu** `loading.js` | layout → prima graniță | **oprit implicit** (`staleTimes.dynamic`) |

Proiectul are 88 de `loading.tsx` care acoperă toate cele 112 pagini din `(app)`. Corect făcute —
și tocmai de asta fiecare prefetch cade în găleata `dynamic`, al cărei implicit e **0 secunde**
(schimbat de la 30 s în v15.0.0). Prefetch-ul e învechit în clipa în care aterizează, deci cele
~52 de intrări de meniu se re-cer la fiecare navigare, fiecare trecând prin proxy și plătind un
`getUser`.

Scheletele de încărcare nu sunt greșite. Fără `staleTimes`, ele transformă prefetch-ul dintr-o
optimizare într-o taxă.

## 3. Decizii luate

### D1 — `getClaims()` peste tot, expirarea JWT rămâne 1 h

`getUser()` întreabă GoTrue dacă tokenul e valid; `getClaims()` verifică semnătura local.
Proiectul **are deja** chei asimetrice: `jwks.json` întoarce o cheie EC P-256, `kid
d2816e7a-17b3-45a7-8977-191d3767bb03`, `alg ES256`. `@supabase/auth-js 2.112.3` are metoda, iar
cache-ul JWKS trăiește la nivel de **modul** (`GoTrueClient.js:46`, TTL 10 min), deci supraviețuiește
peste `createServerSupabase()`.

**Reîmprospătarea se păstrează.** Verificat în sursă: `getClaims()` fără argument cheamă
`getSession()` (`GoTrueClient.js:5325`), care cheamă `_callRefreshToken()` doar când sesiunea a
expirat (`:2554`). Token valid ⇒ zero rețea. Token expirat ⇒ exact un apel de reînnoire, ca acum.
`JwtPayload` conține `sub`, `email`, `user_metadata` — tot ce citește `current-user.ts` azi.

**Ce se slăbește:** un cont blocat sau deconectat global rămâne acceptat de *aplicație* până
expiră access-tokenul.

**De ce e acceptabil:** PostgREST verifică și el tot local, cu JWKS-ul, fără să întrebe GoTrue —
deci baza accepta oricum același token. `getUser()` din aplicație nu apăra o graniță pe care baza
o apără. Ce **nu** se slăbește: excluderea din firmă (`resolveTenant` citește
`organization_members` din bază la fiecare cerere), retragerea unei permisiuni, și RLS.

**De ce NU scurtăm expirarea la 15 min:** cu 30 de prefetch-uri simultane și un token proaspăt
expirat, toate încearcă să reînnoiască cu același refresh token, pe două replici Swarm fără lacăt
comun. Rotația de refresh token e exact locul unde asta produce deconectări aleatorii. Ar schimba
un risc teoretic pe unul observat, de patru ori mai des.

**De verificat empiric înainte de a considera D1 închisă:** afirmația „PostgREST acceptă tokenul
unui cont blocat până la `exp`” e comportament documentat, nu măsurat de noi. Nu se testează pe
producție — se testează pe bancul local (`banc-migrare.sh`) sau se acceptă ca ipoteză declarată.

### D2 — nginx: modificat, cu `nginx -t` înaintea reload-ului

`log_format` cu `$request_time` și `$upstream_response_time`, doar pe vhostul aplicației. Reload-ul
e comun celor ~9 site-uri de pe VM, deci: copie `.bak` întâi, `nginx -t` înainte, `nginx -s reload`
(niciodată `restart`), restaurare din `.bak` dacă `-t` pică.

## 4. Cele șase intervenții

Ordinea e parte din design: instrumentul întâi, feedbackul al doilea, milisecundele apoi.

### 0 · Instrumentul — jurnalizarea duratelor în nginx

Azi cele 3 376 de cereri din ultimele 72 h nu conțin nicio durată. Fără ele, nici lentoarea nu se
poate confirma retroactiv, nici reparația nu se poate dovedi. **Se face prima.**

- `cp <vhost> <vhost>.bak`
- în blocul `http`: `log_format durate '$remote_addr "$request" $status rt=$request_time urt=$upstream_response_time';`
- în `server{}`-ul aplicației: `access_log /var/log/nginx/administrativo.log durate;`
- `docker exec strawboss-nginx-1 nginx -t` → dacă pică, restaurează `.bak` și **nu** da reload
- `nginx -s reload`

Fișiere: în afara repo-ului, sub `/srv/apps/Strawboss`. Nu intră în commit-ul aplicației.

### 1 · Feedback la clic — `src/components/data/rand-tabel.tsx`

`gestioneazaClick` la `:34-38` face `router.push(destinatie)` gol. Se înfășoară în `useTransition`,
iar starea de pending se leagă la voalul global prin `useSemnalIncarcare` din
`@/components/incarcare/use-incarcare.ts` (hook existent, folosit în 12 locuri).

**De ce nu se refolosește `SenzorLink`.** `src/components/incarcare/senzor-link.tsx` rezolvă deja
exact această problemă pentru `<Link>`, prin `useLinkStatus` (Next 16.3). Nu se poate folosi aici:
`useLinkStatus` cere să fii **descendent al unui `<Link>`**, iar un `<tr>` nu poate fi. Clicul pe
rândul întreg — nu doar pe coloana cu numele — e cerința explicită documentată la `rand-tabel.tsx:8-11`,
deci soluția nu e „pune un `<Link>`”, ci `useTransition` peste `router.push`. Rândul de tabel e
singurul loc din aplicație care scapă senzorului de `<Link>`.

**Interacțiune cu intervenția 3, în direcția bună.** `senzor-link.tsx:24-25` notează că `pending` nu
se aprinde pentru o rută deja prefetch-uită. Cu `staleTimes.dynamic: 15`, mai multe rute vor avea un
prefetch valid, deci voalul va apărea **mai rar**. Iar `PRAG_VOAL = 400` îl împiedică oricum să
clipească pe navigările instantanee: nu se aprinde nimic sub 400 ms.

**Capcană:** `useTransition` și `useSemnalIncarcare` trebuie declarate **înaintea** lui
`if (href === null)` de la `:29`. `useRouter()` e deja acolo; celelalte două trebuie să-l urmeze
imediat, nu să ajungă sub ramura de ieșire — altfel se încalcă Rules of Hooks și componenta
crapă exact pe rândurile fără destinație.

Repară 19 pagini de listă: angajati, concedii, diurna, flota, inventar, salarizare, cursuri,
mentenanță, onboarding, reges, ssm, ticketing, super-admin/organizatii ș.a.

Separat, în același pas: cele 13 fișiere care declară `inCurs` fără să-l lege de nimic (trei îl
aruncă din start cu `const [, porneste]`).

**Milisecunde reale salvate: zero.** Intervalul până la primul semn vizual: de la infinit la
sub 100 ms. Asta e plângerea literală.

### 2 · `getClaims()` — `current-user.ts:20` și `middleware.ts:76`

Ambele docblock-uri argumentează azi explicit pentru `getUser()` („getUser() validează token-ul la
GoTrue… singurul rezultat de încredere pe server”). **Se rescriu**, nu se șterg: noul comentariu
trebuie să spună de ce verificarea locală e suficientă și care e fereastra acceptată — altfel
următoarea sesiune „repară” înapoi la `getUser()`.

`current-user.ts` mapează din claims: `claims.sub` → `id`, `claims.email` → `email`,
`claims.user_metadata?.full_name` → `fullName`. Tipul `AuthUser` rămâne neschimbat, deci nimic
din aval nu se atinge.

**Câștig: 270 ms → 1,7 ms pe fiecare cerere.**

### 3 · `staleTimes` — `next.config.ts`

Fișierul n-are deloc cheia `experimental`. Se adaugă `experimental: { staleTimes: { dynamic: 15 } }`.

**Risc:** strict prospețime în interiorul aceleiași firme, pe client, per browser. Scrierile
proprii sunt acoperite de `revalidate:` din `createAction`; se pot vedea până la 15 s vechime din
scrierile altcuiva la revenirea pe o listă. **Nu e risc de izolare** — Router Cache-ul e per-browser,
iar comutarea firmei îl purjează de două ori independent (`setOrganizationCookie` și
`revalidatePath("/", "layout")`).

Cere rebuild de imagine. Atenție la capcana cunoscută: `NEXT_PUBLIC_APP_URL` se coace la build.

### 4 · Proxy — `src/proxy.ts`

Trei tăieturi independente:

a. **`/api/` înaintea sesiunii.** `:81` (`if (pathname.startsWith("/api/")) return response;`) rulează
   azi **după** `:76` (`await updateSession(request)`). Rutele de API își verifică singure sesiunea;
   plătesc un `getUser` pe care apoi îl aruncă. Se inversează ordinea.

b. **Ieșire devreme pe prefetch.** Cererile cu antetul `Next-Router-Prefetch: 1` plătesc azi un
   `getUser` fiecare (probă directă: o astfel de cerere primește 307 de la proxy). După schimbare,
   prefetch-ul unui vizitator nelogat ajunge la pagină, care face `requireTenant()` →
   `redirect("/autentificare")` — comportament corect, doar mutat un strat mai jos.
   **Consecință de verificat:** cookie-ul de sesiune nu se mai reîmprospătează pe prefetch. Navigările
   reale îl reîmprospătează în continuare; scenariul „o oră numai prefetch, zero navigare” nu e real.

c. **Faviconurile în matcher.** `icon`, `icon1`, `apple-icon` sunt rute de metadate **fără extensie**,
   deci regexul de la `:141` (care exclude doar `.*\.(png|svg|…)$`) nu le prinde. Sunt servite cu
   `cache-control: public, max-age=0, must-revalidate` și `cf-cache-status: DYNAMIC`, deci browserul
   le re-cere la fiecare încărcare. A/B pe origine, 8 perechi intercalate: fără cookie mediana ~21 ms,
   cu cookie de sesiune mediana ~90 ms — **+69 ms fiecare, de 2–3 ori pe pagină**. În jurnal: 1 491
   de cereri `/icon*` + `/manifest` din 11 745. Se adaugă lângă `manifest.webmanifest`, în aceeași
   listă de excluderi, cu un comentariu care explică de ce rutele fără extensie scapă regexului.

### 5 · `src/instrumentation.ts` (fișier nou)

Supabase nu trimite antet `Keep-Alive`, deci undici aplică implicitul de **4 000 ms**. Măsurat:
pauză 0–3 s → 53–68 ms per apel; pauză 4–10 s → 87–149 ms. Un om apasă mai rar de patru secunde,
deci fiecare clic începe cu TCP+TLS de la zero: **+125 ms**.

`register()` cu `setGlobalDispatcher(new Agent({ keepAliveTimeout: 30_000 }))`.

**Risc:** `ECONNRESET` la reutilizarea unui socket pe care marginea l-a închis. undici reia automat
un `GET`, **nu** un `POST`. De aceea 30 s și nu 60 — și de aceea pragul real al marginii Cloudflare
se măsoară înainte de a alege altă valoare.

### 6 · Paralelizare — `src/lib/actions/create-action.ts`

a. `:133` (`getEnabledFeatures`) și `:145` (`getPermissionMap`) sunt două `await` înlănțuite pe
   operații **independente** — ambele au nevoie doar de `tenant`. Se unesc într-un `Promise.all`.
   Structura celor 8 straturi și ordinea refuzurilor rămân neschimbate: se paralelizează *citirile*,
   nu *deciziile*. Verificarea modulului (`MODUL_DEZACTIVAT`) rămâne înaintea celei de permisiune
   (`INTERZIS`), ca mesajul de eroare să nu se schimbe.

b. Auditul de **succes** de la `:233` e `await`-uit pe calea fericită. Se mută în `after()` din
   `next/server` — folosit azi de **zero** ori în proiect. Auditul de **refuz** (din `refuza()`,
   `:101`) rămâne sincron: un refuz care se pierde e o gaură în urmă, un succes pierdut e o linie
   lipsă dintr-un jurnal care are deja rândul de date.

c. Același tipar aplicat preambulului paginilor, întâi pe cele 10–15 pagini grele
   (`/pontaj` 11 `await`, `/concedii` 9, `/angajati` 9, `/mentenanta/echipamente/[id]` 10).
   Lanțul „listă → nume angajați” e o dependență reală și rămâne serial.

## 5. Ce s-a respins, cu motiv

| Ce | De ce |
| --- | --- |
| **„Lipsesc `loading.tsx`”** | Respins prin numărătoare. Un raport intermediar susținea 36 de pagini fără schelet; testul număra pe director propriu, nu pe strămoși. Un `loading.tsx` acoperă tot subarborele: **0 din 112** pagini sunt fără graniță de încărcare. |
| **Rescrierea celor 929 de apeluri RLS în `(select …)`** | Diferență măsurată: **0,08 ms** pe 357 de rânduri. PG 17 le ridică singur în One-Time Filter. 404 de politici atinse pentru zero câștig, cu risc de regresie de izolare. |
| **Un RPC de rate-limit în `createAction`** | Respins: `rate-limit` nu apare în `create-action.ts`. Trăiește în `public-action.ts` (autentificare, invitație, resetare) și în email/invitații/cursuri. |
| **Indexuri noi, plan Supabase mai mare** | Postgres e sub 3% din timpul unui clic. |
| **Cele 89 de `count: "exact"`** | 1,3–8,7 ms în bază, deja în `Promise.all` alături de interogarea de date. Puse deliberat (vezi comentariile din `employees.ts:226`, `leave.ts:119`). |
| **`optimizePackageImports`, `lucide-react`, `date-fns`, compresia RSC** | Deja corecte, verificate pe antete: `immutable` + `cf-cache-status: HIT`; RSC comprimat 50 981 → 6 514 octeți; `lucide-react` optimizat implicit; `date-fns` nu e importat niciodată. |
| **`prefetch={false}` pe meniu, de sine stătător** | Ar face primul clic pe fiecare intrare vizibil mai lent — opusul plângerii. Acceptabil doar împreună cu `staleTimes`, și doar după ce preambulul e ieftin. |
| **Scoaterea celor 152 `router.refresh()`** (105 fișiere) | Fiecare cere verificarea manuală că `revalidate:` acoperă calea afișată. Un ecran învechit după salvare e clasa de defecte cea mai scumpă. După A, sau niciodată. |
| **`keepalive` spre upstream în nginx** | ~8 ms câștig contra riscului ca `nginx -t` să pice și reload-ul să dea jos cele 9 site-uri. |
| **Mutarea aplicației lângă bază (AWS eu-west-1)** | ~8 ms din ~90–130. VM-ul e deja la 7,7 ms de o margine Cloudflare; restul e Kong + PostgREST, nu fir. |
| **Mutarea bazei la Frankfurt** | ~30 ms din ~90–130, cu migrare de proiect, indisponibilitate, URL și chei noi. O treime din câștig pentru cel mai mare risc din listă. |
| **Conexiune Postgres directă prin pooler, în locul PostgREST** | Singura idee din familie cu un câștig real (28–30 ms RTT față de 90–130 per apel REST), dar cere rescrierea întregului strat de date și reconstruirea manuală a RLS-prin-JWT — exact suprafața pe care proiectul își ține izolarea. **Amânată**, nu respinsă: se reia doar dacă, după A, interogările proprii ale paginilor rămân termenul dominant. |
| **`cacheComponents` / `partialPrefetching`** | Firma activă vine dintr-un **cookie**, iar App Shell-ul s-ar cache-ui per sesiune pe client. Schimbă și semantica lui `force-dynamic` pe toate cele 112 pagini. Respinsă până există o probă de comutare A→B verificată explicit. |
| **Redis, acum** | Nu greșit — **prematur**. Vezi §6. |

## 6. Redis: de ce nu acum, și când da

Redis ar duce cele patru interogări de preambul (~440 ms) la ~5 ms. Containerul
`strawboss-app_redis` există deja pe VM și răspunde în 1,66 ms. Dar:

- Cel mai mare post din factură — cele două `getUser()` — **nu se cache-uiește, se elimină**.
  `getClaims()` face 270 ms → 1,7 ms, cu mai puțin cod și zero infrastructură. Redis ar face
  270 → ~5 ms: mai lent, cu mai mult.
- Nu atinge intervalul „până se întâmplă ceva” (`rand-tabel.tsx`). Zero pixeli schimbați.
- Nu reduce numărul de prefetch-uri (74,7% din trafic) — doar le face mai ieftine. Costul cozii e
  CPU de randare și strângeri de mână TLS pe un singur fir JS.
- Nu atinge datele proprii ale paginilor (330–550 ms): per-firmă, per-filtru, se schimbă la fiecare
  scriere.

**Argumentul real pro-Redis, singurul fără alternativă mai ieftină:** sunt două replici Swarm
confirmate. Un cache în memoria procesului e per-replică, iar `revalidateTag` de pe replica A **nu**
invalidează replica B — o permisiune retrasă rămâne activă pe cealaltă replică până la TTL. Asta nu
e o problemă de viteză, e una de corectitudine. **Dar ea se aplică abia după ce există un cache;
nu e un motiv să începi cu unul.**

Se reia ca fază B, după ce A e livrat și măsurat.

## 7. Riscuri de izolare — regula, dacă se ajunge la faza B

**Cheia de cache trebuie să conțină fiecare dimensiune pe care o citește predicatul RLS.** În acest
proiect predicatele citesc `auth.uid()`, `organization_id`, rolul, și pe unele tabele
`app.current_employee_id`.

1. Nimic cache-uit după cale sau URL. `(app)/layout.tsx:19` declară `force-dynamic` — **rămâne
   neatins** cât timp intră orice cache.
2. Chei exacte: `permisiuni:{organizationId}:{role}:{memberId}`, `module:{organizationId}`,
   `firma:{organizationId}`, `apartenente:{userId}`. **Nicio cheie fără `organizationId`.**
3. `apartenente:{userId}` primește cel mai scurt TTL (60 s) — e cheia care decide în ce firme are
   voie omul.
4. Zero cache pe date de rând. Preambulul e cache-uibil fiindcă e *metadată despre chiriaș*.
5. Harta de permisiuni e **poartă de autorizare** (`create-action.ts:145`). Un cache învechit
   permisiv lasă acțiunea să treacă poarta de aplicație; RLS o refuză apoi, dar refuzul apare ca
   **UPDATE cu zero rânduri, fără eroare**. Deci `revalidateTag` obligatoriu în fiecare acțiune care
   scrie `role_permissions`, **cu test**, TTL ≤300 s ca plasă, și **niciodată cache pe `super_admin`**
   (sursa e `platform_admins`).
6. Comutarea firmei trebuie să purjeze explicit. `comutaNucleu` face azi `revalidatePath("/", "layout")`,
   care golește Router Cache-ul clientului dar **nu** invalidează etichetele `unstable_cache`.
7. Cu două replici, invalidarea trebuie să ajungă la amândouă.
8. Redis-ul de pe VM deservește 9 site-uri: instanță separată sau minimum `db` dedicat + prefix
   `adm:` + `requirepass` + legat exclusiv la overlay.
9. `staleTimes.dynamic` e pe client, per-browser — nu poate scurge între utilizatori sau firme.
10. `getClaims()` nu schimbă nimic din izolare: JWT-ul verificat local e același pe care îl verifică
    PostgREST, iar RLS îl primește neatins.

## 8. Verificarea

Lanțul obligatoriu: `pnpm typecheck && pnpm lint && pnpm test`. **Build-ul nu se rulează de aici**
(cerință explicită a utilizatorului, repetată de două ori) — se declară ce rămâne de prins de el:
`src/instrumentation.ts` e fișier nou pe granița server, iar `next.config.ts` schimbat cere rebuild
de imagine. Ambele sunt exact ce prinde `next build` și `tsc` tace.

Poarta empirică, per intervenție:

| # | cum se dovedește |
| --- | --- |
| 0 | `rt=` apare în `/var/log/nginx/administrativo.log`; se strâng cifre înainte de orice altă schimbare |
| 1 | clic pe un rând → voalul se aprinde sub 100 ms; verificare vizuală headless (playwright-core + headless_shell din cache, rețeta existentă a proiectului) |
| 2 | `curl` cu sesiune validă → zero cereri `/auth/v1/user` în `query_logs` pentru o navigare; sesiunea supraviețuiește peste ora de expirare (test manual, o oră) |
| 3 | jurnalul nginx: proporția `?_rsc=` scade sub 74,7% |
| 4 | `curl -H 'Next-Router-Prefetch: 1'` nu mai apare în `query_logs`; `/icon1` cu cookie revine la ~21 ms |
| 5 | două cereri la 6 s distanță: a doua nu mai plătește TLS |
| 6 | `rt=` median pe POST-uri scade; auditul de succes apare în continuare în `audit_logs` |

**Poarta finală, singura care contează:** `rt=` median pe navigare și pe salvare, comparat cu seria
strânsă la pasul 0.

## 9. Ce rămâne nedovedit

1. **Nimeni n-a cronometrat un clic real, autentificat, într-un browser.** Toate cele 124 de
   măsurători sunt componente, făcute cu `curl` și `node` de pe VM. Bugetul din §2 e o reconstrucție
   care se adună plauzibil, nu o observație. De aceea pasul 0 e primul.
2. **Nu s-a măsurat din România.** La fiecare rând din buget se adaugă un segment client→margine
   necunoscut, plus ~247 KB de JS de hidratat.
3. **Ipoteza rămasă, dacă după A tot doare:** hidratarea. 247 KB comprimați pe `/panou`,
   `reactCompiler: true`, un singur fir. Nemăsurată de niciun strat. Testul: DevTools → Performance,
   înregistrează clicul; dacă bara galbenă (scripting) trece de 300 ms, e hidratare.
