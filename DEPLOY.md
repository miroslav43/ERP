# Deploy — Administrativo (ERP)

Aplicația rulează containerizat pe VM-ul `62.171.154.194`, la **https://infomeditatii.ro**.
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
valorile ca fișiere în `/run/secrets/`, nu în mediu. `docker-stack.yml` n-are azi niciun bloc
`secrets:`.

**Regula care nu se încalcă niciodată**: un secret NU se pasează ca argument de linie de comandă.
S-a întâmplat o dată — un container de diagnostic pornit manual în timpul deploy-ului căuta prin
sistemul de fișiere după valoarea literală a `HR_ENCRYPTION_KEYS`, ca să verifice că nu s-a scurs
în straturile imaginii. Verificarea era corectă; metoda a lăsat cheia în `.Config.Cmd`, unde a stat
25 de ore. Pentru astfel de scanări, pasează valoarea prin `--env-file` sau prin stdin, niciodată
în `Cmd`.

---

## Configurări din afara repo-ului

**Supabase Dashboard → Authentication → URL Configuration**
`Site URL` și `Redirect URLs` trebuie să conțină `https://infomeditatii.ro` și
`https://infomeditatii.ro/auth/callback`. Fără ele, login-ul redirecționează greșit.

**Cloudflare** — zona `infomeditatii.ro` e proxied (188.114.x). Modul SSL/TLS trebuie să fie
**Full (strict)**; certificatul Let's Encrypt de pe origine îl face valid.

---

## Certificate

Emise de containerul `certbot` partajat, stocate în volumul `strawboss_letsencrypt`.
Reînnoirea e automată (buclă la 12h). Certificatul pentru `infomeditatii.ro` a fost **refolosit** de
la Eduvora — același domeniu, aceeași filiație; nu s-a rulat certbot la migrare.

```bash
./administrativo.sh ssl:status    # ce certificate există și când expiră
./administrativo.sh ssl:issue     # emite/reînnoiește (cere confirmare)
```

`ssl:issue` folosește `--entrypoint certbot`. Fără suprascriere, entrypoint-ul serviciului e o buclă
`certbot renew; sleep 12h`: argumentele `certonly` sunt ignorate, comanda atârnă și nu emite nimic.

---

## Probleme cunoscute

**Migrarea `0035_reguli_concediu.sql` nu e aplicată pe baza live.**
0036 e aplicată, 0035 nu — a fost sărită. Lipsesc din bază două funcții
(`aplica_drepturi_concediu`, `seteaza_zile_concediu_implicit`) și șase coloane din
`leave_entitlement_rules` (`tip_criteriu`, `vechime_ani_min`, `valoare_text`, `department_id`,
`job_position_id`, `activ`). Codul de la HEAD le folosește.

_Efect:_ ecranul **Concedii → Setări** (grile de drepturi) dă eroare la rulare. Restul aplicației
funcționează. Tot de aici vin cele 9 erori de tip care au impus `DOCKER_BUILD=1` în `next.config.ts`.

_Reparație_ (necesită `DATABASE_URL` în `.env.production`):

```bash
./administrativo.sh db:migrate     # aplică 0035 + 0037
pnpm db:types                      # regenerează src/types/database.ts
./administrativo.sh prod           # rebuild + redeploy, fără downtime
```

După asta, `typescript.ignoreBuildErrors` din `next.config.ts` poate dispărea complet.

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
`infomeditatii.service:8000`). Vechiul vhost e păstrat ca
`/srv/apps/Strawboss/nginx/conf.d/30-infomeditatii.ro.conf.eduvora.bak`.
Revenire completă: `./administrativo.sh nginx:restore` + `sudo systemctl start infomeditatii`.
Domeniul e provizoriu — la mutare, singura modificare e `NEXT_PUBLIC_APP_URL` + rebuild + vhost nou.
