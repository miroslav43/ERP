# Latența percepută — de la clic la primul pixel

**Data:** 2026-09-03 · **Abordare aprobată:** A (șase intervenții chirurgicale, fără
infrastructură nouă) · **Status:** spec, neimplementat

---

## 1. Problema, în cuvintele utilizatorului

> „Dau click și durează câteva secunde bune până se întâmplă ceva.”

Întrebat care clic doare, răspunsul a fost: **navigarea în meniu, salvarea unui formular, și
„peste tot, uniform”.**

Cuvântul care contează e _uniform_. Dacă lentoarea ar veni din interogările unei pagini anume, ar
fi inegală — Pontajul lent, Anunțurile instant. Uniformitatea e semnătura unui **cost fix pe
cerere**, plătit înainte ca pagina să înceapă să-și ceară datele.

## 2. Ce s-a măsurat

124 de măsurători, pe 7 straturi, executate pe VM-ul de producție și pe baza live
(numai `SELECT`/`EXPLAIN`). Costurile unitare:

| ce                                              | cald                                                                    | rece   |
| ----------------------------------------------- | ----------------------------------------------------------------------- | ------ |
| un apel GoTrue (`/auth/v1/user`)                | 90 ms                                                                   | 180 ms |
| un apel PostgREST (`/rest/v1/…`)                | 110 ms                                                                  | 200 ms |
| execuția în Postgres                            | **2,32 ms** medie ponderată pe 43 296 de apeluri (`pg_stat_statements`) |        |
| Redis local (`strawboss-app_redis`, deja pe VM) | avg **1,66 ms**                                                         |        |
| verificare locală a unui JWT ES256              | **1,7 ms** (`importKey` 0,433 + `verify` 1,269)                         |        |

**Baza de date nu e problema.** Cel mai mare tabel are 2 795 de rânduri; Postgres răspunde în
milisecunde. Problema e că aplicația vorbește cu el de 6–10 ori pe rând, prin HTTP, peste
Cloudflare și Kong.

### Bugetul reconstruit

Navigare simplă: **≈ 1,2 s**, ×2,5 dacă clicul cade în propria rafală de prefetch → **1,2–2,5 s**.

Clic care salvează:

|                                                                     | ms                                   |
| ------------------------------------------------------------------- | ------------------------------------ |
| proxy `getUser` (socket rece)                                       | 180                                  |
| `createAction` → `resolveTenant` (getUser + `organization_members`) | 200                                  |
| module + permisiuni, în lanț                                        | 220                                  |
| scrierea propriu-zisă                                               | 110–330                              |
| `writeAuditLog` — **așteptat** (`create-action.ts:233`)             | 110                                  |
| `revalidatePath` → re-randare completă în același POST              | 860                                  |
| `router.refresh()` → a treia randare completă                       | 950                                  |
| transport + client                                                  | 150                                  |
| **total**                                                           | **≈ 2,8 – 3,3 s** (4–6 s sub rafală) |

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

| ruta                  | ce se prefetchează     | TTL                                       |
| --------------------- | ---------------------- | ----------------------------------------- |
| **fără** `loading.js` | pagina întreagă        | 5 min (`staleTimes.static`)               |
| **cu** `loading.js`   | layout → prima graniță | **oprit implicit** (`staleTimes.dynamic`) |

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

**Ce se slăbește:** un cont blocat sau deconectat global rămâne acceptat de _aplicație_ până
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

**Corecție față de prima versiune a spec-ului: fișierul E în repo.** Vhostul live e
`/srv/apps/Strawboss/nginx/conf.d/30-administrativo.ro.conf`, dar **sursa lui de adevăr e
`deploy/nginx/30-administrativo.ro.conf` din acest repo** (identice byte-cu-byte azi), iar
`./administrativo.sh nginx:vhost` scrie copia live din ea (`ops/06-nginx.sh:103,:142`). Dacă se
modifică doar copia din `/srv/apps/Strawboss`, **prima rulare viitoare de `nginx:vhost` — a ta sau
a altei sesiuni — șterge tăcut jurnalizarea.** Se modifică repo-ul și se instalează cu `nginx:vhost`.

**Domeniul activ e `administrativo.ro`.** `infomeditatii.ro` nu mai are niciun server block; apare
o singură dată în `nginx -T`, într-un comentariu. Măsurătorile din §2 au fost filtrate pe IP tocmai
pentru că formatul `main` n-are `$host`.

Ce se scrie, și unde:

- `log_format` **nu** poate sta în blocul `http` din `/etc/nginx/nginx.conf`: acel fișier trăiește
  doar în container și **nu e bind-montat**, deci orice editare se pierde la prima recreare. Locul
  corect e la nivel de fișier în `conf.d`, care e inclus exact în contextul `http`
  (`nginx.conf:31`) — exact ca `map $connection_upgrade`, deja prezent în vhost la `:34-37`.
- **O singură declarație.** Un `log_format durate` declarat de două ori face `nginx -t` să pice cu
  „duplicate log_format" și blochează reload-ul pentru **toate cele 10 site-uri** de pe VM.
- Formatul include `$host` chiar dacă jurnalul e per-vhost: costă zero și face seria comparabilă cu
  istoricul din `docker logs`.
- `access_log` declarat în `server{}` **suprascrie** moștenirea din `http`, nu se adaugă la ea.
  Traficul ar dispărea din `docker logs strawboss-nginx-1` și `./administrativo.sh logs:nginx`
  (`ops/07-logs.sh:33`) ar rămâne gol, fără nicio eroare. Se declară **două** directive `access_log`
  în același server block. Dar **nu** se trimite a doua copie în `/dev/stdout`: jurnalul json-file al
  nginx are deja 780 MB, fără `max-size`, pe un disc ocupat 81%.
- Backupul: `<vhost>.anterior.bak` (convenția existentă, `ops/06-nginx.sh:130`). Un `.bak` care s-ar
  termina în `.conf` ar fi încărcat de `include conf.d/*.conf` și ar produce `server_name` și `map`
  duplicate — adică exact reload-ul care dă jos tot VM-ul.
- **Nu edita `conf.d` cu `mv`/`rm`/rsync-cu-redenumire.** Dacă inode-ul directorului e înlocuit cât
  timp containerul rulează, montarea devine stale: înăuntru directorul apare gol, `nginx -t` **trece**
  (un config gol e valid), iar primul reload încarcă zero server-blocks și lasă fără serviciu toate
  site-urile. Scriere in-place, apoi `./administrativo.sh nginx:vhost`, care face backup, `nginx -t`
  și rollback automat (`ops/06-nginx.sh:145-157`).
- Jurnalul nou trăiește la `/var/log/nginx/administrativo.log`, în stratul de scriere al containerului
  — **nu** se adaugă bind-mount, fiindcă ar cere `docker compose up -d nginx`, care recreează edge-ul
  partajat (interzis de `DEPLOY.md:79-81`). Se citește cu
  `docker exec strawboss-nginx-1 tail -n 500 /var/log/nginx/administrativo.log`.
  **Consecință de acceptat:** se pierde la recrearea containerului, deci seria de referință se copiază
  în afara containerului înainte de orice altă schimbare. Și `nginx:alpine` n-are logrotate — fișierul
  crește nelimitat; se trunchiază manual sau se șterge după ce seria e strânsă.

**Care termen contează:** `$request_time` se măsoară de la primul octet citit de la client până la
ultimul trimis, deci include rețeaua clientului. Pentru comparația „înainte/după" a intervențiilor
2–6 termenul onest e `$upstream_response_time`; `$request_time` rămâne util fiindcă e ce simte omul.

### 1 · Feedback la clic — `src/components/data/rand-tabel.tsx`

`gestioneazaClick` la `:34-38` face `router.push(destinatie)` gol. Se înfășoară în `useTransition`,
iar starea de pending merge în **două** locuri: un afordant **local** pe rând, imediat, și voalul
**global** prin `useSemnalIncarcare` din `@/components/incarcare/use-incarcare.ts` (hook existent,
folosit în 11 locuri: 10 chemări de `useSemnalIncarcare` + 1 de `useSemnalPanaLaRuta`).

**De ce două straturi, și nu doar voalul.** `PRAG_VOAL = 400` (`src/lib/incarcare/praguri.ts:24`)
întârzie deliberat afișarea — pragul Doherty, argumentat la `:16-23`: sub 400 ms feedbackul devine
clipire. Deci voalul singur lasă primele 400 ms mute. Mai important, voalul acoperă tot ecranul și
**structural nu poate spune PE CARE rând s-a dat clic** — informația care lipsește de fapt pe o
listă de rânduri identice. Afordantul local o dă: `aria-busy="true"` plus o estompare a rândului
apucat, în același cadru cu clicul.

`PRAG_VOAL` **nu se coboară.** Cu `DURATA_MINIMA_VOAL = 450` (`praguri.ts:35`), un prag mic face
voalul să stea 450 ms peste o navigare de 200 ms — mai lent _perceput_ decât fără voal. Iar după
intervențiile 2–6 navigarea aterizează la ~450 ms, exact în zona aceea.

**Amânat, nu respins:** `SenzorLink` primește deja `pending` de la `useLinkStatus` și îl trimite
doar la voal, fără afordant local. Aceeași jumătate lipsește deci și pentru meniu, paginare și
antetul sortabil (6 locuri de randare, `sidebar-nav.tsx:177,198`, `paginare.tsx:95,113`,
`tabel.tsx:280`, `rand-notificare.tsx:118`). Nu intră în acest lot.

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
crapă exact pe rândurile fără destinație. Rândurile cu `href === null` sunt reale: comentariul de
la `:22` spune că apar când entitatea legată e ascunsă de RLS.

**Suprafața reală: UN fișier.** `RandTabel` nu e importat de nicio pagină — `grep -rln "RandTabel"
src/app` întoarce zero rânduri. Ajunge la ecrane exclusiv prin `Tabel` (`src/components/ui/tabel.tsx:182`),
care îl randează doar când primește prop-ul `href`. O singură editare acoperă **20 de fișiere,
21 de instanțe** (`reges/page.tsx` are două, la `:345` și `:368`) și **22 de rute**
(`concedii/tabel-cereri.tsx` servește `/concedii` și `/concedii/echipa`; `ticketing/tabel-tichete.tsx`
servește `/ticketing` și `/ticketing/coada`).

**Eticheta rămâne generică, deliberat.** `Tabel` trimite azi doar `key` și `href` (`tabel.tsx:182-184`),
deci voalul va scrie „Se încarcă…" (`panou-incarcare.tsx:61`), nu „Se încarcă lista de angajați…".
Refolosirea lui `caption` ar produce „Se încarcă Lista angajaților…" — majusculă și fără articolul
cerut de convenție — deci ar cere normalizarea a 20 de texte. Nu merită: afordantul local răspunde
deja la „care rând", iar voalul la 400 ms trebuie doar să spună „încă lucrez". Amânat.

**Lotul „fișiere cu pending nelegat" nu există.** Prima versiune a spec-ului a spus 13, un inventar
ulterior a spus 10; la verificare fișier cu fișier sunt **zero**. Cei ~106 care declară un pending îl
duc într-un `<Buton inCurs textInCurs>` cu rotiță, `aria-busy` și blocare (`buton.tsx:120-125`), sau
au semn propriu (`concedii/incarcare-document.tsx:139`), sau folosesc `useSemnalPanaLaRuta`
(`formular.tsx:11,104`). `use-actiune-rand.ts` e un hook care nu randează nimic, iar toți cei trei
consumatori ai lui leagă `inCurs` de un buton.

Toate trei estimările au greșit la fel: au numărat **declarații**, nu **efecte**. Aceeași formă a
produs și „19 pagini de listă" (20 de fișiere, dar **un singur** punct de editare) și „lipsesc 36 de
`loading.tsx`" (zero pagini descoperite). `rand-tabel.tsx` era singurul loc real.

**Milisecunde reale salvate: zero.** Ce se schimbă: primul semn vizual pe rândul apucat, de la
**niciodată** la **același cadru cu clicul**; voalul global rămâne la 400 ms, ca peste tot.

### 2 · `getClaims()` — `current-user.ts:20` și `middleware.ts:76`

Sunt exact **9** apeluri `supabase.auth.getUser()` în `src/` și **zero** `auth.getSession()`. Doar
**două** sunt pe calea critică și se schimbă: `middleware.ts:76` și `current-user.ts:20`. Celelalte
șapte sunt pe căi rare de autentificare (login, resetare, invitație, comutare de firmă) și **rămân
neatinse** — acolo se stabilește sau se schimbă sesiunea, nu se citește.

**Trei docblock-uri se rescriu**, nu două: `current-user.ts:18-19`, `middleware.ts:73-75` și
`middleware.ts:67-69` (acesta din urmă spune „`getUser()` de mai jos rulează la FIECARE request care
trece de matcher" și justifică `fetchCuTermen`; motivul rămâne valid — protejează `jwks.json` și
reînnoirea — dar propoziția nu mai e adevărată literal). Se rescriu, nu se șterg: comentariul nou
trebuie să spună de ce verificarea locală e suficientă și care e fereastra acceptată, altfel
următoarea sesiune „repară" înapoi la `getUser()`.

Cinci capcane verificate, fiecare capabilă să rupă schimbarea:

1. **Garda pe eroare nu e suficientă.** `getClaims()` are **trei** variante de retur, nu două: pe
   lângă succes și `{ data: null, error: AuthError }`, există `{ data: null, error: null }` — vizitator
   fără sesiune. Un port mecanic al liniei actuale în `if (error !== null)` lasă `data` null și dă
   TypeError. Garda corectă: `if (error !== null || data === null) return null;`
2. **`JwtPayload` se importă din `@supabase/supabase-js`**, care face `export * from "@supabase/auth-js"`
   (`index.d.mts:7`). **Niciodată** direct din `@supabase/auth-js`: nu e dependință directă și nu e
   hoistat în `node_modules/@supabase/`. Un import direct de acolo e exact clasa de cale inventată
   care a produs istoric 91 de erori de compilare.
3. **`claims.email` e `string | undefined`** (`JwtPayload:1679`), iar `AuthUser.email` e `string`:
   fallback-ul `?? ""` de la `current-user.ts:30` se **păstrează**. La fel, `claims.user_metadata` e
   `UserMetadata | undefined` — accesul cere `?.` înainte de `["full_name"]`. Iar anotarea explicită
   `const numeBrut: unknown` de la `:23` se păstrează: `UserMetadata` e `{ [key: string]: any }`, și
   anotarea e singurul lucru care ține `any` afară din tipul dedus (regulile `no-unsafe-*` nu sunt
   pornite, deci nimic nu ar semnala).
4. **`import type { User }` de la `middleware.ts:5` devine neutilizat** în clipa în care
   `SessionUpdate.user` nu mai e `User | null`. `noUnusedLocals: true` face typecheck-ul să pice pe
   el — se scoate în același edit. Consumatorul unic al valorii, `src/proxy.ts:94`, o compară **doar
   cu null**, nu citește niciun câmp: tipul poate deveni un boolean.
5. **Nu se pasează niciodată jwt-ul explicit.** `getClaims(token)` sare complet peste `getSession()`
   (`GoTrueClient.js:5320-5326`), deci reîmprospătarea **dispare**. Forma corectă e `getClaims()` fără
   argument.

**Neatinse, confirmat:** `src/app/readyz/route.ts` nu folosește deloc clientul Supabase — face `fetch`
brut la `/auth/v1/health`. `/auth/callback` folosește `verifyOtp`/`exchangeCodeForSession`, nu
`getUser`. `src/lib/supabase/optiuni-cookie.ts` n-are nimic de schimbat.

**Câștig: 270 ms → 1,7 ms pe fiecare cerere.** Formulare onestă a porții: `getClaims` nu șterge apelul
de rețea, îl **rărește** — la primul apel după pornirea procesului și la fiecare expirare a TTL-ului
JWKS de 10 minute, `fetchJwk` cere `/.well-known/jwks.json`. Poarta „zero cereri `/auth/v1/user`" e
corectă; una „zero cereri către Supabase" ar fi falsă.

**Risc rezidual, de notat:** `validateExp` din auth-js n-are toleranță de ceas. Marja de 90 s a lui
`getSession()` acoperă cazul normal, dar pe o replică cu ceasul în urmă cu mai mult, `getClaims` ar
respinge un token pe care GoTrue l-ar accepta. Simptomul ar fi deconectări la navigare, nu o eroare
vizibilă.

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

**`undici` NU e dependință a proiectului.** Apare în lockfile doar ca dependință **opțională** a lui
jsdom (`pnpm-lock.yaml:6184-6193`), iar `node_modules/undici` nu există. Intervenția cere deci și
`package.json` **și** `pnpm-lock.yaml` regenerat — altfel `pnpm install --frozen-lockfile`
(`Dockerfile:36`) oprește build-ul înainte să ajungă la `next build`. Se verifică și că modulul e
trasat în `.next/standalone` (`outputFileTracing`) înainte de a declara intervenția livrată.

**Risc:** `ECONNRESET` la reutilizarea unui socket pe care marginea l-a închis. undici reia automat
un `GET`, **nu** un `POST`. De aceea 30 s și nu 60 — și de aceea pragul real al marginii Cloudflare
se măsoară înainte de a alege altă valoare.

### 6 · Paralelizare — `src/lib/actions/create-action.ts`

a. `:133` (`getEnabledFeatures`) și `:145` (`getPermissionMap`) sunt două `await` înlănțuite pe
operații **independente** — ambele au nevoie doar de `tenant`. Se unesc într-un `Promise.all`.
Structura celor 8 straturi și ordinea refuzurilor rămân neschimbate: se paralelizează _citirile_,
nu _deciziile_. Verificarea modulului (`MODUL_DEZACTIVAT`) rămâne înaintea celei de permisiune
(`INTERZIS`), ca mesajul de eroare să nu se schimbe.

b. Auditul de **succes** de la `:233` e `await`-uit pe calea fericită. Se mută în `after()` din
`next/server` — folosit azi de **zero** ori în proiect. Auditul de **refuz** (din `refuza()`,
`:101`) rămâne sincron: un refuz care se pierde e o gaură în urmă, un succes pierdut e o linie
lipsă dintr-un jurnal care are deja rândul de date.

c. Același tipar la preambulul paginilor. **Corecție de scară față de prima versiune: sunt 110 din
117 de pagini, nu 10–15.** Tiparul e identic peste tot: `await requireFeature(...)` urmat pe linia
IMEDIAT următoare de `await getPermissionMap(...)` — două citiri independente, pe tabele diferite
(`organization_features` vs `role_permissions`), amândouă depinzând doar de `tenant`. Transformare
mecanică.

**Se sparge pe subarbori de rute** (pontaj, concedii, angajați, ssm, mentenanță…), niciodată într-un
commit de 110 fișiere: repo-ul are sesiuni concurente, iar o singură sesiune care le atinge pe toate
se ciocnește aproape sigur de altcineva.

**Câștigul e zero la încărcarea completă, și asta trebuie spus.** `(app)/layout.tsx:92-95` cheamă deja
`getEnabledFeatures(tenant.organizationId)`, iar el și `getPermissionMap` sunt amândoi `React.cache()`.
Când layoutul se randează în același request cu pagina, `requireFeature` din pagină e cache hit.
Câștigul apare **exclusiv** acolo unde layoutul NU se re-randează — adică la navigarea pe client,
care e chiar plângerea. Deci poarta empirică se pune pe o navigare client, nu pe un `curl`.

**`requireFeature` nu întoarce boolean — face `notFound()`** (`features.ts:89`). Într-un `Promise.all`
cu `getPermissionMap`, dacă acesta din urmă aruncă primul (organizationId non-UUID la
`permissions.ts:68-70`), rejectul lui câștigă cursa și un 404 devine 500. Practic nereproductibil cu
un tenant valid, dar se scrie. Contra-partea e sigură: `Promise.all` atașează handler pe fiecare
element, deci al doilea reject nu devine unhandled rejection.

**Poarta `can()` rămâne DUPĂ await**, nu între cele două apeluri — altfel ordinea „modul dezactivat
(404) înaintea permisiunii lipsă (`AccesRestrictionat`)" se pierde.

**Condiționalele nu se pierd.** Multe citiri sunt păzite de o permisiune. În `Promise.all` ele rămân
ternare în interiorul array-ului; tiparul există deja în cod:
`scope === "all" ? citesteRezumatDateSensibile(...) : null` (`angajati/[id]:220`) și
`poateAproba ? numarDeAprobat(...) : Promise.resolve(0)` (`concedii/echipa:71`).

**`grep -c "await "` supraevaluează:** `await params`, `await searchParams` și
`await createServerSupabase()` (doar `await cookies()`) nu sunt dus-întorsuri de rețea. Două awaituri
din TOP 8 sunt deja cache hit-uri cu câștig zero: `pontaj/page.tsx:108` și `pontaj/aprobare/page.tsx:217`.

**Ieșirile devreme blochează contopirea:** `pontaj/aprobare:195-214`, `pontaj/page.tsx:370-392`,
`mentenanta/echipamente/[id]:80`, `onboarding/[id]:48`. Mutarea unei citiri deasupra unei astfel de
ieșiri o face plătită degeaba pe ramura scurtă.

Lanțul „listă → nume angajați" e o dependență reală și rămâne serial. Iar `angajatiDupaId` există în
cinci module cu semnătură identică dar tipuri locale (`checklist.ts:666`, `maintenance.ts:901`,
`fleet.ts:678`, `per-diem.ts:525`, `ssm.ts:971`): importul rămâne din modulul paginii, o „unificare"
ar fi exact calea inventată de evitat.

## 5. Ce s-a respins, cu motiv

| Ce                                                                      | De ce                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **„Lipsesc `loading.tsx`”**                                             | Respins prin numărătoare. Un raport intermediar susținea 36 de pagini fără schelet; testul număra pe director propriu, nu pe strămoși. Un `loading.tsx` acoperă tot subarborele: **0 din 112** pagini sunt fără graniță de încărcare.                                                                                                                |
| **Rescrierea celor 929 de apeluri RLS în `(select …)`**                 | Diferență măsurată: **0,08 ms** pe 357 de rânduri. PG 17 le ridică singur în One-Time Filter. 404 de politici atinse pentru zero câștig, cu risc de regresie de izolare.                                                                                                                                                                             |
| **Un RPC de rate-limit în `createAction`**                              | Respins: `rate-limit` nu apare în `create-action.ts`. Trăiește în `public-action.ts` (autentificare, invitație, resetare) și în email/invitații/cursuri.                                                                                                                                                                                             |
| **Indexuri noi, plan Supabase mai mare**                                | Postgres e sub 3% din timpul unui clic.                                                                                                                                                                                                                                                                                                              |
| **Cele 89 de `count: "exact"`**                                         | 1,3–8,7 ms în bază, deja în `Promise.all` alături de interogarea de date. Puse deliberat (vezi comentariile din `employees.ts:226`, `leave.ts:119`).                                                                                                                                                                                                 |
| **`optimizePackageImports`, `lucide-react`, `date-fns`, compresia RSC** | Deja corecte, verificate pe antete: `immutable` + `cf-cache-status: HIT`; RSC comprimat 50 981 → 6 514 octeți; `lucide-react` optimizat implicit; `date-fns` nu e importat niciodată.                                                                                                                                                                |
| **`prefetch={false}` pe meniu, de sine stătător**                       | Ar face primul clic pe fiecare intrare vizibil mai lent — opusul plângerii. Acceptabil doar împreună cu `staleTimes`, și doar după ce preambulul e ieftin.                                                                                                                                                                                           |
| **Scoaterea celor 152 `router.refresh()`** (105 fișiere)                | Fiecare cere verificarea manuală că `revalidate:` acoperă calea afișată. Un ecran învechit după salvare e clasa de defecte cea mai scumpă. După A, sau niciodată.                                                                                                                                                                                    |
| **`keepalive` spre upstream în nginx**                                  | ~8 ms câștig contra riscului ca `nginx -t` să pice și reload-ul să dea jos cele 9 site-uri.                                                                                                                                                                                                                                                          |
| **Mutarea aplicației lângă bază (AWS eu-west-1)**                       | ~8 ms din ~90–130. VM-ul e deja la 7,7 ms de o margine Cloudflare; restul e Kong + PostgREST, nu fir.                                                                                                                                                                                                                                                |
| **Mutarea bazei la Frankfurt**                                          | ~30 ms din ~90–130, cu migrare de proiect, indisponibilitate, URL și chei noi. O treime din câștig pentru cel mai mare risc din listă.                                                                                                                                                                                                               |
| **Conexiune Postgres directă prin pooler, în locul PostgREST**          | Singura idee din familie cu un câștig real (28–30 ms RTT față de 90–130 per apel REST), dar cere rescrierea întregului strat de date și reconstruirea manuală a RLS-prin-JWT — exact suprafața pe care proiectul își ține izolarea. **Amânată**, nu respinsă: se reia doar dacă, după A, interogările proprii ale paginilor rămân termenul dominant. |
| **`cacheComponents` / `partialPrefetching`**                            | Firma activă vine dintr-un **cookie**, iar App Shell-ul s-ar cache-ui per sesiune pe client. Schimbă și semantica lui `force-dynamic` pe toate cele 112 pagini. Respinsă până există o probă de comutare A→B verificată explicit.                                                                                                                    |
| **Redis, acum**                                                         | Nu greșit — **prematur**. Vezi §6.                                                                                                                                                                                                                                                                                                                   |

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
4. Zero cache pe date de rând. Preambulul e cache-uibil fiindcă e _metadată despre chiriaș_.
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

| #   | TDD?        | cum se dovedește                                                                                                                                                                                                      |
| --- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | nu          | `rt=` apare în `/var/log/nginx/administrativo.log`; seria se **copiază în afara containerului** înainte de orice altă schimbare                                                                                       |
| 1   | **da**      | test Vitest pe `RandTabel`: clicul pune sursa în depozitar și `aria-busy` pe `<tr>`                                                                                                                                   |
| 2   | **da**      | test unitar pe maparea claims → `AuthUser`, inclusiv varianta `{data: null, error: null}`; empiric: zero cereri `/auth/v1/user` în `query_logs` pentru o navigare, iar sesiunea supraviețuiește peste ora de expirare |
| 3   | parțial     | `tsc` prinde cheia dacă `NextConfig` o tipizează; empiric: proporția `?_rsc=` din jurnal scade sub 74,7%                                                                                                              |
| 4   | **da**      | test pe `proxy()` cu `NextRequest` construit: `/api/*` și `Next-Router-Prefetch: 1` ies fără `updateSession`; empiric `/icon1` cu cookie revine la ~21 ms                                                             |
| 5   | nu          | două cereri la 6 s distanță: a doua nu mai plătește TLS                                                                                                                                                               |
| 6   | **da** (6a) | test că `getEnabledFeatures` și `getPermissionMap` pornesc în același tick; 6b cere `vi.mock("next/server")` — testul dovedește că auditul e **programat**, nu că e în afara căii critice                             |

**Trei intervenții nu sunt TDD-abile, și planul trebuie s-o spună în loc s-o mascheze:** 0 (nginx, în
afara codului), 5 (`register()` e chemat de runtime; un test ar verifica cel mult că fișierul exportă
o funcție) și 6b în sens strict. Pentru ele poarta e cea empirică, nu vitest.

**Patru capcane de test, verificate:**

1. Proiectul `ui` din `vitest.config.mts:84-102` **nu are aliasul `server-only` și nu are variabile de
   mediu** (spre deosebire de `unit`, `:46-59` și `:70-80`). Orice `.test.tsx` care ajunge prin lanțul
   de importuri la un fișier cu `import "server-only"` sau la `@/config/env` cade cu „Cannot find
   package 'server-only'" — o eroare care **nu** arată spre cauză.
2. `useTransition` cu un `push` mockuit **sincron** nu produce un `pending` observabil: trece
   true→false într-un singur ciclu. Mock-ul trebuie să întoarcă o promisiune care nu se rezolvă:
   `push: vi.fn(() => new Promise(() => {}))`.
3. Starea depozitarului **se scurge între teste** (`surse` și `cronometre` sunt variabile de modul,
   `depozit.ts:37-40`). `goleste()` în `beforeEach` **și** `afterEach`, ca în `zona-incarcare.test.tsx:28-35`.
4. `React.cache()` **nu memoizează în afara unui render**. Nu scrie un test care afirmă „un singur apel
   pentru N invocări" — va pica, și nu pentru că implementarea e greșită.

**Linia de bază, măsurată pe 2026-09-03 la 07:57:** typecheck curat · lint 0 erori / 1 avertisment
preexistent (`panou-membri.tsx:173`, react-hook-form) · **teste 2902 ✓ / 1 ✗**. Eșecul e
`src/content/landing/continut.test.ts` („nicio sedilă turcească în stratul de marketing") și e
**preexistent, din diff-ul necomis al altei sesiuni** în `src/content/landing/contact.ts` — un citat
din Legea 365/2002 lipit cu sedilă turcească (U+015F/U+0163). Implementatorul trebuie să constate roșeața **înainte**
de a scrie primul rând, altfel o va atribui muncii lui.

**Arborele e murdar cu 11 fișiere ale altei sesiuni**, iar build-ul Docker ia întreg directorul ca
context. Un rebuild pentru intervențiile 3 și 5 ar publica munca lor nerevizuită. Se folosește rețeta
de worktree curat din `DEPLOY.md:245-263`. Și: producția rulează azi
`administrativo-web:d191d89-20260903001528` — tag cu marcaj de timp, adică **construit dintr-un arbore
murdar**, deci imaginea live nu corespunde niciunui commit curat. Se notează de la ce imagine se
pornește, altfel comparația `rt=` înainte/după măsoară și diferențe de cod nelegate de intervenții.

**Ordinea obligatorie pentru 3 și 5:** întâi `nginx:vhost` + reload pentru jurnalizare, apoi se strânge
seria de referință, **abia apoi** rebuild. Un rebuild înaintea jurnalizării face câștigul imposibil de
dovedit — adică anulează exact motivul pentru care pasul 0 e primul. `./administrativo.sh prod` nu
atinge nginx și nu reinstalează vhostul, doar avertizează (`ops/01-main.sh:87-90`).

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
