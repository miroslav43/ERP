# Deploy — Administrativo (ERP)

Aplicația rulează containerizat pe VM-ul `62.171.154.194`, la **https://administrativo.ro**.
Tot ce ține de operare trece prin `./administrativo.sh`.

```bash
./administrativo.sh help      # toate comenzile
./administrativo.sh status    # unde suntem
./administrativo.sh doctor    # ce e stricat și cum se repară
```

---

## Arhitectură

Aplicația e Next.js 16 App Router integral: 42 de fișiere `"use server"` (Server Actions) și
doar 2 route handlers. **Nu există proces de backend separat** — rolul lui îl joacă Supabase Cloud
(Postgres + Auth + PostgREST + Storage). Containerul are nevoie doar de HTTPS spre exterior.

VM-ul e organizat pe două niveluri, model preluat de la StrawBoss:

| Nivel                              | Orchestrator | Unde trăiește         | Ce conține                                                   |
| ---------------------------------- | ------------ | --------------------- | ------------------------------------------------------------ |
| **Edge** — partajat de ~9 site-uri | Compose      | `/srv/apps/Strawboss` | `strawboss-nginx-1` + `certbot` — singurele legate pe 80/443 |
| **App** — doar ERP                 | **Swarm**    | `/srv/apps/ERP`       | stack `administrativo` → `administrativo-web` ×2             |

```
Cloudflare → 62.171.154.194:443 → strawboss-nginx-1
           → overlay strawboss-net → administrativo-web:3000 → Supabase Cloud
```

IPv6 funcționează prin `ipv6-forward-{80,443}.service` (socat), care existau deja pe VM.

**De ce două replici:** rolling update `start-first` cu rollback automat. Replica nouă primește
trafic abia după ce trece healthcheck-ul, apoi se retrage cea veche — deci deploy fără downtime.

---

## Deploy normal

```bash
./administrativo.sh prod
```

Lanțul complet:

1. încarcă `.env.production` și verifică cele 8 variabile obligatorii;
2. confirmă că nodul e manager Swarm și că overlay-ul `strawboss-net` există;
3. construiește imaginea, taguită cu **git short-sha** + `:latest`;
4. `docker stack deploy --resolve-image never`;
5. așteaptă convergența, cu detecție de rollback și de update blocat;
6. verifică `/healthz` printr-un sidecar **de pe rețeaua overlay**.

Pasul 6 nu e decorativ: din shell-ul host-ului nu se poate verifica nimic — e izolat de rețea, iar
IP-urile Docker nu sunt accesibile. Un sidecar pe overlay e singurul test onest.

Doar imaginea, fără deploy: `./administrativo.sh docker:build`.

---

## Rollback

```bash
./administrativo.sh stack:rollback    # revine la imaginea anterioară (~15s)
./administrativo.sh nginx:restore     # revine la vhost-ul Eduvora
```

Rollback-ul funcționează pentru că imaginile sunt taguite pe sha: Swarm păstrează spec-ul anterior
și revine la imaginea exactă. Cu doar `:latest`, „anterioara" ar fi un tag mutabil care între timp
arată spre altceva.

Swarm dă rollback **singur** dacă replica nouă nu trece healthcheck-ul în 30s
(`failure_action: rollback`, `max_failure_ratio: 0`).

---

## Reguli care nu se încalcă

**1. Edge-ul nu se repornește la un deploy normal.**
`strawboss-nginx-1` deservește toate site-urile de pe VM. `cmd_prod` refuză să îl atingă dacă
rulează deja. Singurul motiv legitim de repornire e o montare `conf.d` devenită stale.

**2. Reload de nginx doar prin `nginx:reload`.**
Comanda verifică întâi că montarea `conf.d` e vie — comparând numărul de fișiere `.conf` de pe host
cu cel din container. Dacă inode-ul directorului de pe host a fost înlocuit cât timp containerul
rula, înăuntru directorul apare **gol**; nginx servește mai departe din memorie, dar primul reload
încarcă zero server-blocks și lasă fără serviciu fiecare site de pe mașină. `nginx -t` **trece** în
situația asta, fiindcă un config gol e valid — de aceea garda obișnuită nu ajunge.

**3. Migrările nu se aplică automat.**
Nicăieri: nici din entrypoint, nici din deploy. Sunt forward-only, pe o bază partajată cu dezvoltarea.
`db:migrate` cere confirmare scrisă și refuză implicit în shell neinteractiv.

**4. `HR_ENCRYPTION_KEYS` și `HR_HASH_KEY` nu se rotesc.**
CNP-urile și IBAN-urile din bază sunt deja criptate cu ele. O cheie nouă nu recriptează nimic — face
datele existente imposibil de citit, definitiv. Trebuie să fie identice cu cele din `.env.local`.
`TENANT_COOKIE_SECRET` **se poate** roti; efectul e doar delogarea tuturor.

**5. `NEXT_PUBLIC_APP_URL` cere rebuild, nu redeploy.**
Se coace în bundle-ul de client la build (`--build-arg`). `src/app/auth/callback/route.ts` îl
folosește intenționat în locul lui `request.url`, fiindcă antetul `Host` e controlat de client.
Schimbarea domeniului = imagine nouă.

---

## Secrete

`.env.production`, mod `600`, gitignorat prin `.env*`, exclus din imagine prin `.dockerignore`.
Se citește la deploy și se injectează ca mediu de runtime prin `docker-stack.yml`.

Build-ul primește **doar** cele trei `NEXT_PUBLIC_*` reale, ca build args. Variabilele de server
primesc placeholdere (aceleași ca în `.github/workflows/ci.yml`), suficiente cât să treacă validarea
Zod din `src/config/env.ts` — care rulează la _import de modul_, iar `next build` importă fiecare
rută. În timpul build-ului nu se execută nicio interogare și nicio decriptare, deci **niciun secret
real nu intră în vreun layer**, nici măcar în cel aruncat.

> **Fă o copie a `HR_ENCRYPTION_KEYS` în afara acestui VM.** Pierderea ei înseamnă pierderea
> definitivă a tuturor CNP-urilor și IBAN-urilor din bază.

### Ce vede `docker inspect`

Injectarea prin `environment:` face secretele vizibile în `docker inspect <container>` →
`.Config.Env`, pentru oricine e în grupul `docker` pe VM. E comportamentul normal al variabilelor
de mediu, nu o scurgere — dar înseamnă că **accesul la Docker pe acest VM echivalează cu accesul la
cheia de criptare a CNP-urilor**. Grupul `docker` are azi un singur membru (`miro`); dacă mai apare
unul, ăsta e pragul care trebuie recitit.

Întărirea, când merită efortul: `docker secret create` + `secrets:` în `docker-stack.yml` montează
valorile ca fișiere în `/run/secrets/`, nu în mediu.

**Suportul e deja în imagine** (`deploy/entrypoint.sh`), inert până când îl folosești: fără o
variabilă `<NUME>_FILE` setată, scriptul nu face nimic și pornirea e identică cu cea de azi.
Traducerea fișier → variabilă de mediu se face în entrypoint, nu în `src/config/env.ts`: acolo ar
fi însemnat un import de `node:fs` într-un fișier pe care îl importă și bundle-ul de client.

Migrarea se face **o cheie pe rând** — `<NUME>_FILE` are prioritate, restul rămân pe mediu:

```bash
# 1. creezi secretul din valoarea existentă, FĂRĂ să treacă prin shell history
printf '%s' "$HR_ENCRYPTION_KEYS" | docker secret create hr_encryption_keys -

# 2. în docker-stack.yml, la serviciu:
#      environment:
#        - HR_ENCRYPTION_KEYS_FILE=/run/secrets/hr_encryption_keys   # în loc de HR_ENCRYPTION_KEYS=...
#      secrets:
#        - hr_encryption_keys
#    și la nivel de stack:
#      secrets:
#        hr_encryption_keys:
#          external: true

# 3. deploy normal; verifici că replica nouă trece healthcheck-ul ÎNAINTE de a continua
./administrativo.sh prod
./administrativo.sh health

# 4. confirmi că valoarea a dispărut din inspect
docker inspect "$(docker ps -q -f name=administrativo-web | head -1)" --format '{{.Config.Env}}' | grep -c HR_ENCRYPTION_KEYS=
#    → 0 (mai apare doar HR_ENCRYPTION_KEYS_FILE, care e o cale, nu o valoare)
```

⚠️ `docker secret` e **imuabil**: rotația înseamnă secret nou + update de serviciu. Pentru
`HR_ENCRYPTION_KEYS` asta nu e o problemă — regula 4 spune că oricum nu se rotește. Pentru
`TENANT_COOKIE_SECRET`, care se poate roti, ține minte pasul în plus.

Entrypoint-ul taie newline-ul final al fișierului: `docker secret create` îl adaugă aproape mereu
când valoarea vine dintr-un `echo`, iar o cheie AES cu `\n` la capăt devine invalidă și decriptarea
eșuează cu un mesaj care nu spune de ce.

**Regula care nu se încalcă niciodată**: un secret NU se pasează ca argument de linie de comandă.
S-a întâmplat o dată — un container de diagnostic pornit manual în timpul deploy-ului căuta prin
sistemul de fișiere după valoarea literală a `HR_ENCRYPTION_KEYS`, ca să verifice că nu s-a scurs
în straturile imaginii. Verificarea era corectă; metoda a lăsat cheia în `.Config.Cmd`, unde a stat
25 de ore. Pentru astfel de scanări, pasează valoarea prin `--env-file` sau prin stdin, niciodată
în `Cmd`.

---

## Configurări din afara repo-ului

**Supabase Dashboard → Authentication → URL Configuration**
`Site URL` și `Redirect URLs`: `https://administrativo.ro` și
`https://administrativo.ro/auth/callback`.

De corectat o afirmație care a stat aici până la 2026-09-03 („fără ele, login-ul redirecționează
greșit"): **nu mai e adevărată**. Aplicația nu mai lasă Supabase să compună niciun link.
`src/app/(auth)/autentificare/actions.ts` cheamă `auth.admin.generateLink()`, care produce doar
`hashed_token`, fără să trimită nimic; e-mailul îl compune șablonul nostru din
`NEXT_PUBLIC_APP_URL` și pleacă prin Resend, iar `src/app/auth/callback/route.ts` îl consumă cu
`verifyOtp({ token_hash })`. Nicăieri în `src/` nu se pasează `redirectTo` sau `emailRedirectTo`,
deci lista de redirecturi din Supabase nu e consultată pe acest drum. Schimbarea a fost făcută
tocmai fiindcă `Site URL` producea linkuri către `localhost:3000`.

Rămâne de aliniat pentru corectitudine și pentru orice flux viitor care ar trece prin GoTrue —
dar nu blochează o mutare de domeniu și nu poate strica login-ul dacă întârzie.

**Resend → Domains / Webhooks** — domeniul din `EMAIL_FROM` trebuie validat (SPF + DKIM),
iar endpoint-ul de webhook e un URL absolut: `https://administrativo.ro/api/webhooks/resend`.
Webhook-ul rămas pe un domeniu vechi nu dă nicio eroare — doar îngheață starea fiecărui email
pe „trimis", fiindcă evenimentele `delivered`/`bounced` nu mai ajung niciodată.

**Cloudflare** — zona `administrativo.ro` e proxied (188.114.x). Modul SSL/TLS trebuie să fie
**Full (strict)**; certificatul Let's Encrypt de pe origine îl face valid.

---

## Certificate

Emise de containerul `certbot` partajat, stocate în volumul `strawboss_letsencrypt`.
Reînnoirea e automată (buclă la 12h). Certificatul pentru `administrativo.ro` acoperă și
`www.administrativo.ro` — o singură filiație, emisă la mutarea din 3 septembrie 2026. Numele
filiației e PRIMUL domeniu dat lui certbot, iar `ssl_certificate` din vhost trebuie să arate spre
`/etc/letsencrypt/live/administrativo.ro/`, nu spre subdomeniu.

```bash
./administrativo.sh ssl:status    # ce certificate există și când expiră
./administrativo.sh ssl:issue     # emite/reînnoiește (cere confirmare)
```

`ssl:issue` folosește `--entrypoint certbot`. Fără suprascriere, entrypoint-ul serviciului e o buclă
`certbot renew; sleep 12h`: argumentele `certonly` sunt ignorate, comanda atârnă și nu emite nimic.

---

## Probleme cunoscute

**Migrarea `0035` — rezolvată (2026-08-22).** Aplicată pe baza live împreună cu 0037 și 0045;
`database.ts` regenerat; ocolul `DOCKER_BUILD=1` scos din `next.config.ts` și `Dockerfile`.
Verifică starea reală prin MCP (`execute_sql`) înainte de a presupune drift — repo-ul e lucrat
în paralel, iar o migrare poate fi aplicată de altcineva între timp.

**Modulul `ticketing` există în bază, dar nu în cod.**
`features` are 14 rânduri, `FEATURE_KEYS` din `src/config/features.ts` are 13 — lipsește
`ticketing` („Ticketing IT", seedat manual pe 2026-08-21 22:44, nu printr-o migrare).

Nu mai e o cădere: `getEnabledFeatures` taie cheile necunoscute și scrie un `console.warn`
(vezi `imparteCheiDeModul`). Până când modulul e implementat în cod, el pur și simplu nu apare
în meniu. Când se implementează: adaugă cheia în `FEATURE_KEYS`, metadatele în `FEATURES`,
intrarea în `src/config/navigation.ts` — și transformă seed-ul manual într-o migrare.

**`/preturi` întoarce 404.** E declarată rută publică în `src/proxy.ts`, dar pagina nu există.
Preexistent, fără legătură cu deploy-ul.

---

## Publicare când altcineva lucrează în repo

Build-ul Docker ia ÎNTREG directorul ca context, nu doar fișierele comise. Cu o sesiune paralelă
care are muncă necomisă, `./administrativo.sh prod` din `/srv/apps/ERP` publică și munca ei
neterminată — inclusiv cod care cheamă funcții dintr-o migrare încă neaplicată.

Soluția, folosită pe 2026-08-22: publică dintr-un worktree curat pe `HEAD`, care conține exact
commit-urile, fără fișierele în lucru ale nimănui.

```bash
W=/tmp/erp-deploy
git worktree add --detach "$W" HEAD
cp .env.production "$W/.env.production" && chmod 600 "$W/.env.production"
cd "$W" && ./administrativo.sh prod
cd - && shred -u "$W/.env.production" && git worktree remove --force "$W"
```

Verifică înainte de build că fișierele lor chiar lipsesc din worktree — e diferența dintre a
publica ce ai vrut și a publica ce s-a nimerit.

---

## Istoric

**2026-08-21** — `infomeditatii.ro` a fost preluat de la „Eduvora" (FastAPI/uvicorn pe host, systemd
`infomeditatii.service:8000`), ca domeniu provizoriu.

**2026-09-03** — mutare pe domeniul definitiv **`administrativo.ro`**. Ce a cerut, în ordine:

1. `ops/_lib.sh` — `ADM_DOMAIN` + `ADM_VHOST` (de aici se alimentează toate comenzile).
2. `.env.production` — `NEXT_PUBLIC_APP_URL` și `EMAIL_FROM`.
3. Vhost temporar doar `:80`, pentru provocarea ACME, **înainte** de certbot: fără el, o cerere
   pentru un `server_name` necunoscut cade pe primul server block încărcat (`10-nortiauno.com`),
   care nu servește `/.well-known/`, iar HTTP-01 eșuează fără să spună de ce.
4. `ssl:issue` pentru apex + `www`.
5. Vhost complet. Cele două vhost-uri au coexistat câteva minute, ca niciun domeniu să nu cadă —
   posibil doar fiindcă maparea `$connection_upgrade` a fost scoasă din cel vechi: două declarații
   cu același nume fac `nginx -t` să pice cu „duplicate map name" și blochează reload-ul pentru
   TOATE site-urile de pe VM, nu doar pentru al nostru.
6. Rebuild + `stack:deploy` — `NEXT_PUBLIC_APP_URL` e copt în bundle, deci un redeploy pe imaginea
   veche ar fi lăsat login-ul să arunce utilizatorii pe domeniul vechi.
7. Ștergerea vhost-ului vechi și a backup-ului `.eduvora.bak`; oprirea `infomeditatii.service`.
8. În afara repo-ului: Supabase URL Configuration, Resend (domeniu + webhook), Cloudflare.

Domeniul vechi e retras complet — nu mai există vhost, nici serviciu systemd pe :8000.
