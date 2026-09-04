# Staging pe subdomeniu, declanșat din git de cineva fără acces la VM

Stare: **design aprobat, neimplementat.** Scris 2026-09-04.
Decizii luate cu utilizatorul: 5 (§3). Probă obligatorie înainte de orice cod: §6.

---

## 1. Problema, în cuvintele utilizatorului

> „Cum aș putea face un sistem de deploy cumva pe un subdomeniu, ca și un coleg
> care lucrează dar nu are acces la VM, să facă deploy pornind de la ultimul
> commit de pe git? Dar să fie ceva destul de șmecher să arate și erorile dacă
> apar, să le poată rezolva și push-ui again."

Și, la jumătatea discuției:

> „Dar de exemplu VM-ul ar mai duce încă un deploy, gen resursele de pe VM, că
> mă gândesc să staging-ul trăiește tot pe VM."

Trei cerințe, în ordinea în care contează:

1. Cineva **fără cont pe VM** declanșează un deploy.
2. Deploy-ul pornește de la **ultimul commit din git**, nu de pe discul cuiva.
3. Când ceva cade, persoana aceea **vede de ce**, repară și împinge din nou —
   fără să întrebe pe nimeni.

---

## 2. Ce s-a măsurat

Nimic din secțiunea asta nu e dedus. Fiecare cifră vine dintr-o comandă rulată
pe VM la 2026-09-04, între 21:19 și 21:36.

### 2.1 Nu există niciun fir între git și VM

Cele patru workflow-uri (`ci.yml`, `revizuire.yml`, `documentatie.yml`,
`vault.yml`) rulează toate pe `runs-on: ubuntu-latest`. Niciunul nu atinge VM-ul.
`systemctl list-units | grep runner` întoarce gol; nu există `~/actions-runner`.

Consecință: firul e piesa centrală de construit, nu un detaliu de configurare.

### 2.2 Lanțul de deploy e cablat pe un singur mediu

`ops/_lib.sh:11-22` — toate `readonly`:

```
ADM_STACK="administrativo"     ADM_SERVICE="administrativo-web"
ADM_IMAGE="administrativo-web" ADM_DOMAIN="administrativo.ro"
ADM_VHOST="30-administrativo.ro.conf"
```

`ops/_lib.sh:154` — `_env_file() { echo "$ADMINISTRATIVO_ROOT/.env.production"; }`

`readonly` nu e o subtilitate de stil: blochează suprascrierea din mediu, deci
un `ADM_DOMAIN=… ./administrativo.sh` de azi nu are niciun efect.

### 2.3 Build-ul citește discul, nu git-ul

`ops/05-docker.sh:69` dă contextul de build ca `"$ADMINISTRATIVO_ROOT"` —
directorul de lucru. `.dockerignore` scoate `.git`, `docs/`, `supabase/`,
`tests/`, dar nu `src/`.

Verificat empiric în aceeași sesiune: la 21:19 arborele avea 5 fișiere
modificate și 2 neurmărite, dintr-o sesiune concurentă care scria chiar atunci
(mtime-uri care avansau între două `git status` la 7 secunde distanță). Un
`./administrativo.sh prod` în acel moment ar fi împachetat o funcționalitate pe
jumătate scrisă.

`ops/05-docker.sh:88` deployează cu `--resolve-image never`: **imaginea trebuie
să existe deja pe mașina care o rulează.** Nu există registry în lanț.

### 2.4 Aliasul de rețea — capcana centrală

`deploy/nginx/30-administrativo.ro.conf:203,209`:

```nginx
set $u administrativo-web:3000;
proxy_pass http://$u;
```

Dar serviciul din Swarm se numește `administrativo_administrativo-web`. Cum se
rezolvă numele scurt? Întrebat, nu dedus:

```
$ docker service inspect administrativo_administrativo-web \
    --format '{{range .Spec.TaskTemplate.Networks}}{{.Aliases}}{{end}}'
Aliasuri: [administrativo-web]

$ docker run --rm --network strawboss-net alpine nslookup administrativo-web
Name: administrativo-web   Address: 10.0.1.241
```

`docker stack deploy` înregistrează pe rețea un alias egal cu **cheia
serviciului** din fișierul de stack. `strawboss-net` e partajată de tot VM-ul.

**Deci: dacă staging-ul păstrează cheia `administrativo-web`, ambele stack-uri
înregistrează același alias pe aceeași rețea.** DNS-ul Docker le întoarce pe
amândouă, iar nginx trimite o parte din traficul de producție în containerele de
staging — care sunt legate la altă bază de date. Intermitent, fără eroare,
imposibil de reprodus la cerere.

Intuiția „stack-uri diferite ⇒ izolare" e falsă exact aici.

### 2.5 Vhost-urile existente

```
10-nortiauno.com          40-serviceproof.ro        80-serafullautonoma.ro
20-video.tedde-auto.ro    50-upt.scoala-ai.ro       90-n8n.bisericaordotoxasarbadenta.ro
30-administrativo.ro      60-buget.scoala-ai.ro
31-analitice.administrativo.ro   70-steitravel.serviceproof.ro
```

Niciun `server_name` cu wildcard — nimic nu ar umbri `staging.administrativo.ro`.
`31-analitice.administrativo.ro.conf` (Umami) e **precedentul de subdomeniu care
merge deja**: se copiază acela, nu se inventează unul nou. Numărul liber
următor: `32-`.

### 2.6 Resursele VM-ului

| Resursă | Măsurat | Ce cere staging |
| --- | --- | --- |
| CPU | 8 nuclee, load 1,72 / 2,84 / 2,71 | ~0% în repaus |
| RAM | 23 GB, 11 folosiți, **12 liberi** | ~175 MB per replică |
| Containere | 18 pornite, **2,3 GB în total** | +2 (web + santinelă) |
| Disc | 387 GB, 314 folosiți, **73 liberi (82%)** | vezi mai jos |

Cele 18 containere (Strawboss, Umami, n8n, budget, scoala-ai,
serafullautonoma, administrativo) stau practic în repaus; cel mai lacom e Redis,
cu 2,94% CPU. O replică de staging e zgomot de fond.

### 2.7 Discul nu e strâmt — e nemăturat

```
TYPE            TOTAL   ACTIVE   SIZE       RECLAIMABLE
Images            197       27   221.8GB    89.55GB (40%)
Build Cache      2317        0   148.8GB    70.49GB
Local Volumes     245        6    18.0GB    17.80GB (98%)
Containers         39       18   207.9MB    10.13MB
```

Costul real per deploy, din `docker history administrativo-web:711e522`:

```
117 MB   COPY /app/.next/standalone      ◄── se rescrie la fiecare build
7,52 MB  COPY /app/.next/static
0,04 MB  public + entrypoint
         ─────
         ~125 MB unici per tag; restul (node:alpine + dependențe) e strat comun
```

40 de tag-uri `administrativo-web` pe disc, adunate în ~10 zile. Nimic nu a fost
curățat vreodată. La 5 push-uri pe zi, staging ar adăuga ~19 GB pe lună.

Dar recuperabilul (~160 GB) e de peste două ori spațiul liber. Concluzia nu e
„staging umple discul", ci „discul n-a fost măturat niciodată, iar staging
adaugă la grămadă". Un `docker builder prune` întoarce ~70 GB pe loc.

**Volumele nu se ating.** 239 din 245 sunt neatașate, dar pe un VM cu nouă
site-uri un `volume prune` e exact comanda care șterge baza altcuiva.

### 2.8 Nu există bază de dev

`.env.local` și `.env.production` arată amândouă spre **același proiect
Supabase** (`nybmhorn…`). Diferă doar `NEXT_PUBLIC_APP_URL`. Adică azi dev-ul
*este* producția, iar migrările se aplică direct pe singura bază existentă.

---

## 3. Ce s-a decis cu utilizatorul

| # | Întrebare | Decizie |
| --- | --- | --- |
| 1 | Spre ce bază scrie staging? | **Al doilea proiect Supabase, izolat** |
| 2 | Unde rulează build-ul? | **Runner GitHub pe VM** (systemd) |
| 3 | Ce suprafețe de feedback? | Rezumat în pagina rulării · pagină de stare pe subdomeniu · comentariu pe commit. **Fără WhatsApp.** |
| 4 | Cât se împarte cu producția? | **Parametrizare: un lanț, două configurații** |
| 5 | Migrări noi în commit? | **Se aplică automat pe baza de staging**, înaintea deploy-ului |

### 3.1 Ce câștigă fiecare decizie, dincolo de scopul ei

- **(1)** scoate constrângerea `HR_ENCRYPTION_KEYS` identice între medii. Cu
  proiecte separate, o cheie scăpată din staging nu descifrează niciun CNP real.
- **(2)** inversează sensul conexiunii: agentul *iese* spre GitHub. Zero chei SSH
  în secretele GitHub, zero porturi noi deschise. În plus, cache-ul Docker local
  e deja cald, iar pe `ubuntu-latest` ar porni gol la fiecare rulare.
- **(4)** face ca staging să probeze **calea de deploy**, nu doar codul: o
  greșeală în `ops/` se vede pe staging înainte de producție.
- **(5)** transformă staging în repetiția migrărilor — lucru care azi nu există
  deloc (§2.8).

---

## 4. Arhitectura — matricea de izolare

Un singur lanț, comutat de `ADM_MEDIU`. Implicit `productie`, deci un apel
neparametrizat se comportă **exact** ca azi.

| | producție | staging |
| --- | --- | --- |
| `ADM_MEDIU` | `productie` (implicit) | `staging` |
| Domeniu | `administrativo.ro` | `staging.administrativo.ro` |
| Stack Swarm | `administrativo` | `administrativo-staging` |
| **Cheia serviciului** | `administrativo-web` | **`administrativo-web-staging`** |
| Imagine | `administrativo-web:<sha>` | `administrativo-web-staging:<sha>` |
| vhost | `30-administrativo.ro.conf` | `32-staging.administrativo.ro.conf` |
| Fișier env | `.env.production` | `.env.staging` |
| Secrete Docker | `hr_encryption_keys` … | `staging_hr_encryption_keys` … |
| Replici | 2 | 1 |
| Supabase | `nybmhorn…` | proiect nou |

Două rânduri din tabel nu sunt cosmetice și, dacă se ratează, defectul e tăcut:

- **Cheia serviciului** — §2.4. Nu numele stack-ului: *cheia*.
- **Secretele** — `docker-stack.yml:171-184` le declară `external: true` cu nume
  globale. Fără prefix, staging montează cheia `service_role` a producției, adică
  exact cheia care ocolește complet RLS.

---

## 5. Parametrizarea lanțului

| Fișier | Ce se schimbă |
| --- | --- |
| `ops/_lib.sh:11-22` | `readonly X="v"` → `: "${X:=v}"`, derivate din `ADM_MEDIU` |
| `ops/_lib.sh:154` | `_env_file()` → `.env.${ADM_MEDIU}` (producția păstrează numele `.env.production`) |
| `ops/05-docker.sh` | numele imaginii și al stack-ului din variabile |
| `ops/06-nginx.sh` | vhost și domeniu din variabile; `ssl:issue` pe domeniul cerut |
| `docker-stack.yml` | numărul de replici și `name:` la secrete (nu cheia serviciului — vezi §6) |
| `.stack-staging.generat.yml` | **generat la fiecare deploy**, adăugat în `.gitignore`, niciodată editat de mână |
| `deploy/nginx/32-staging.administrativo.ro.conf` | **nou**, copiat după `31-analitice…` |
| `.github/workflows/staging.yml` | **nou** |
| `ops/08-curatenie.sh` | **nou** (§11) |

Regula peste tot: implicitul este producția de azi, la byte. Un `git diff` pe
`ops/` trebuie să arate doar `readonly X="v"` → `: "${X:=v}"`, nicio schimbare de
valoare.

---

## 6. Cum se obține o cheie de serviciu diferită — RULAT, nu dedus

Patru variante, probate pe stack-uri de unică folosință și pe rețele overlay
efemere, 2026-09-04 la 22:0x. Trei au căzut.

**(a) Variabilă pe poziția cheii — RESPINSĂ.**

```yaml
services:
  ${ADM_SERVICE:-administrativo-web}:      # ← ce părea evident
```
```
services  Additional property ${ADM_SERVICIU:-nume-implicit} is not allowed
```

Schema Compose se validează **înaintea** interpolării. Cheile nu se
parametrizează. (Designul inițial pornise de la presupunerea contrară.)

**(b) Alias explicit pe rețea, cheie identică — RESPINSĂ.**

```yaml
    networks:
      strawboss-net:
        aliases: [administrativo-web-staging]
```
```
Aliasuri: [administrativo-web-staging administrativo-web]
```

Aliasul scurt implicit se **adaugă**, nu se înlocuiește. Coliziunea din §2.4
rămâne întreagă.

**(c) `extends` — RESPINSĂ.**

```
extends: Support for `extends` is not implemented yet.
```

**(d) Fișier de stack generat, cu o singură substituție ancorată — REȚINUTĂ.**

```bash
sed 's/^  administrativo-web:$/  administrativo-web-staging:/' \
    docker-stack.yml > .stack-staging.generat.yml
grep -q '^  administrativo-web-staging:$' … || moarte "redenumirea nu a avut loc."
grep -q '^  administrativo-web:$'         … && moarte "cheia veche a rămas."
```
```
Aliasuri: [administrativo-web-staging]        ← singurul alias înregistrat
```

Cele două gărzi nu sunt decorative: dacă cineva redenumește serviciul în fișierul
de bază, `sed` nu mai potrivește nimic și ar produce **tăcut** un fișier cu cheia
de producție, adică exact coliziunea. Gărzile transformă asta într-o oprire
zgomotoasă. Fișierul generat e efemer și intră în `.gitignore` — nu se editează
niciodată de mână.

**Ce NU rezolvă generarea, și se rezolvă prin interpolare normală:** numele
secretelor. `name:` e o valoare, deci acceptă variabile — probat în aceeași
rulare:

```yaml
secrets:
  supabase_service_role_key:
    external: true
    name: ${ADM_SECRET_PREFIX:-}supabase_service_role_key
```
```
Secret montat: staging_proba_cheie -> /run/secrets/proba_cheie
```

Secretul extern al staging-ului se montează pe **calea logică** pe care o
așteaptă `deploy/entrypoint.sh`. Codul aplicației rămâne neatins.

**Variantă respinsă din alt motiv (nu probată, respinsă prin structură):** un
singur stack cu ambele servicii, partajând configurația prin ancore YAML. Ar fi
curat, dar `docker stack deploy` deployează *toate* serviciile din fișier — deci
fiecare deploy de staging ar reevalua și serviciul de producție. Cuplează exact
ce separăm.

---

## 7. Rețeaua

**DNS** — făcut de utilizator pe 2026-09-04. Verificat:

```
staging.administrativo.ro → 188.114.96.3, 188.114.97.3
administrativo.ro         → 188.114.97.2, 188.114.96.2
NS: bryce.ns.cloudflare.com, meera.ns.cloudflare.com
```

### 7.1 Cloudflare stă în față — la fel ca producția

Adresele returnate sunt ale Cloudflare, nu `62.171.154.194`: înregistrarea e
proxată (norul portocaliu), exact ca domeniul principal. Nu e o problemă, e
aceeași topologie care merge azi — dar are două urmări.

**Emiterea certificatului.** Provocarea HTTP-01 trebuie să treacă prin Cloudflare
până la origine. Că merge e dovedit pe această mașină: volumul nginx conține deja
11 certificate Let's Encrypt, printre care `analitice.administrativo.ro` — un
subdomeniu al aceluiași domeniu, în aceleași condiții. Dacă totuși pică (tipic:
„Always Use HTTPS" redirecționează provocarea spre un HTTPS pe care originea
încă nu-l poate servi pentru acest nume), leacul e să treci înregistrarea pe
„DNS only" cât durează emiterea, apoi să repui proxy-ul.

**Adresa reală a vizitatorului.** Traficul ajunge la nginx cu IP-ul Cloudflare;
adresa clientului vine în `CF-Connecting-IP`. Contează pentru limitarea de rată
și pentru jurnale, nu pentru deploy.

**Certificat** — fluxul ACME existent, parametrizat pe domeniu. Ordinea contează
și e deja impusă de cod: `ops/06-nginx.sh:113` refuză să instaleze un vhost cu
`listen 443 ssl` dacă certificatul lipsește, fiindcă un `ssl_certificate` absent
face nginx să nu mai **pornească** — adică ar dărâma toate cele nouă site-uri,
nu doar staging-ul. Deci: vhost pe :80 → certbot → vhost complet.

**Vhost** — copiat după `31-analitice.administrativo.ro.conf`, cu tiparul
obligatoriu din `30-administrativo.ro.conf:127-131`:

```nginx
resolver 127.0.0.11 valid=10s ipv6=off;
set $u administrativo-web-staging:3000;
proxy_pass http://$u;
```

Upstream-ul într-o **variabilă**, nu direct. Comentariul din cod explică de ce:
cu `proxy_pass` direct, un serviciu oprit face `nginx -t` să pice și reload-ul
dă jos toate site-urile de pe VM. Cu variabilă, un upstream absent înseamnă doar
502 pe acest domeniu. Un staging căzut nu trebuie să poată bloca reload-ul
întregului VM.

Instalarea folosește `cmd_nginx__vhost` existent, care are deja: backup al
fișierului, snapshot al întregului `conf.d`, `nginx -t` înainte de reload și
revenire automată la eșec. Scrierea e in-place (`cat >`), fiindcă `mv`/`rm` ar
atinge inode-ul directorului și ar face montarea stale pentru tot VM-ul.

**Două adaosuri față de producție:**

- `add_header X-Robots-Tag "noindex, nofollow" always;` — altfel Google
  indexează staging-ul, iar el concurează cu vitrina reală pe exact același
  conținut.
- Autentificare de bază (`auth_basic`), ca subdomeniul să nu fie deschis
  oricui. Colegul lucrează de oriunde, deci restricția pe IP nu e potrivită.

---

## 8. Baza de staging

Proiect Supabase nou, creat de utilizator pe 2026-09-04:
`mjyuonhcltjoxektopcg.supabase.co`. `db:migrate` îl construiește de la zero fără
cod special: `internal.migrari_aplicate` e goală pe un proiect nou, deci „aplică
doar ce lipsește" înseamnă „aplică tot".

Cele opt variabile cerute de `ADM_REQUIRED_ENV` (`ops/_lib.sh:143-152`), cu
proveniența fiecăreia:

| Variabilă | De unde vine |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | proiectul de staging ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cheia publicabilă a proiectului ✅ (`env.ts:31` cere doar `min(1)`, deci formatul nou `sb_publishable_…` trece) |
| `NEXT_PUBLIC_APP_URL` | `https://staging.administrativo.ro` ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | **cheia secretă a proiectului — de furnizat** |
| `HR_ENCRYPTION_KEYS` | generată pentru staging, JSON `{"1":"<base64>"}` |
| `HR_ENCRYPTION_ACTIVE_KEY` | `1`, trebuie să existe în cheia de mai sus (`env.ts:130`) |
| `HR_HASH_KEY` | generată, base64 de 32 de octeți (`env.ts:85`) |
| `TENANT_COOKIE_SECRET` | generată, base64 de 32 de octeți (`env.ts:74`) |

Cele patru generate sunt **diferite** de ale producției, intenționat (§3.1).

- Chei de criptare **proprii**, diferite de producție (§3.1).
- Secrete Docker proprii, prefixate `staging_`.
- Seed cu `scripts/demo/seed-demo.mjs`.
- Migrările se aplică automat la fiecare deploy, înaintea build-ului (decizia 5).
  Dacă `db:migrate` pică, deploy-ul se oprește acolo și eroarea `psql` ajunge în
  rezumat; subdomeniul rămâne pe versiunea anterioară.

---

## 9. Workflow-ul

```yaml
on:
  push: { branches: [main] }
  workflow_dispatch:
concurrency:
  group: administrativo-staging
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: [self-hosted, administrativo]
```

Pașii, în ordine:

```
1. checkout la sha-ul împins        ← spațiu de lucru propriu, arbore CURAT
2. .env.staging  ←  /srv/secrete/administrativo/.env.staging
3. pnpm install --frozen-lockfile
4. pnpm verify                      ← POARTĂ: typecheck + lint + format + teste
5. db:migrate      (ADM_MEDIU=staging)  ← POARTĂ
6. stack:deploy    (ADM_MEDIU=staging)  ← docker build + rolling update
7. scrie starea    (§10)            ← după FIECARE încercare, inclusiv la eșec
8. curățenie       (§11)
9. rezumat + comentariu pe commit
```

Două lucruri de reținut:

- **Secretele nu urcă niciodată pe GitHub.** `.env.staging` stă pe VM, în afara
  repo-ului, și e citit de runner la fiecare rulare. Spațiul de lucru se
  reîmprospătează la checkout, deci fișierul nu persistă acolo.
- **Efect secundar câștigat gratis:** runner-ul face checkout în spațiul lui, deci
  build-ul pornește dintr-un arbore curat la exact acel sha. Staging nu suferă de
  problema din §2.3.

**Securitate:** un runner pe VM execută ce scrie în workflow, iar workflow-ul
vine din repo. Limitarea la `main` + declanșare manuală e singurul lucru care
stă între un PR dintr-un fork și shell-ul VM-ului, dacă repo-ul se deschide
vreodată.

---

## 10. Feedback — cele trei suprafețe

**Rezumatul rulării** (`$GITHUB_STEP_SUMMARY`) — tabel randat în capul rulării:
sha, pasul care a căzut, primele erori de `tsc` / `eslint` / `vitest` extrase și
formatate cu `fișier:linie`. Colegul nu derulează log-ul.

**Comentariu pe commit** — verdictul lipit de commit-ul vinovat, vizibil în
istoric mult după ce log-ul rulării expiră.

**Pagina de stare** — un container-santinelă separat în stack-ul de staging
(`nginx:alpine`, ~5 MB), care servește un director bind-montat de pe gazdă.
Runner-ul scrie acolo după fiecare încercare: sha viu, sha care a eșuat, pasul,
coada erorii, ora.

De ce santinelă și nu o rută în aplicație: **momentul în care ai nevoie de
pagina de stare e exact momentul în care aplicația nu pornește.** O rută servită
de aplicație ar fi jos fix atunci. Santinela e un serviciu separat în stack; un
rolling update eșuat al serviciului web nu o atinge, iar dacă `pnpm verify`
pică, deploy-ul nici nu pornește și santinela continuă să servească ultima stare
scrisă.

Asta acoperă golul real: azi, la orice eșec, subdomeniul arată bine și **nimic
nu spune că push-ul n-a ajuns** — `docker-stack.yml:155` face
`failure_action: rollback`, deci site-ul revine singur la versiunea veche, tăcut.

---

## 11. Curățenia

Nu e o rafinare; după §2.7 e condiția ca planul să fie sigur pe termen lung.

- Păstrează ultimele N tag-uri per mediu (implicit 5), șterge restul.
- `docker builder prune --filter until=168h` — sigur, costă doar un build mai
  lent.
- **Volumele nu se ating niciodată**, din script (§2.7).

Rulează la finalul fiecărui deploy de staging. Reparația se câștigă și pentru
producție, unde problema există deja.

---

## 12. Ordinea de livrare

1. ~~Proba aliasului~~ — **făcută 2026-09-04, rezultatul e în §6.** Varianta
   reținută: fișier de stack generat, cu două gărzi.
2. Parametrizarea `ops/` + `docker-stack.yml`, cu producția neschimbată la byte.
   Poartă: un `./administrativo.sh status` și un `docker:build` fără `ADM_MEDIU`
   dau exact ce dau azi.
3. Curățenia (§11) — independentă, se poate livra prima dacă discul presează.
4. DNS + certificat + vhost, în ordinea din §7.
5. Proiectul Supabase de staging, migrări, seed, secrete. Tot aici se creează
   `/srv/secrete/administrativo/.env.staging` — directorul nu există încă.
6. Runner-ul ca serviciu systemd.
7. Workflow-ul, întâi cu deploy-ul comentat (doar porțile), apoi complet.
8. Santinela de stare și cele trei suprafețe de feedback.

---

## 13. Ce se rupe și cum îl prindem

| Defect | Simptom | Poarta |
| --- | --- | --- |
| Alias colizionat (§2.4) | trafic de producție ajunge în staging, intermitent | proba din §6, apoi `nslookup administrativo-web` după primul deploy de staging |
| Secrete nepresfixate | staging scrie cu `service_role`-ul producției | `docker service inspect` pe secretele montate |
| Vhost cu `proxy_pass` direct | `nginx -t` pică, reload-ul dă jos 9 site-uri | `nginx -t` din `cmd_nginx__vhost`, deja acolo |
| Certificat lipsă la instalare | nginx nu mai pornește deloc | verificarea din `ops/06-nginx.sh:113`, deja acolo |
| Staging indexat de Google | vitrina reală pierde poziții pe propriul conținut | `X-Robots-Tag` în vhost |
| Disc plin | cad toate site-urile care scriu pe `/` | §11 + prag de avertizare în `doctor` |
| Două builduri simultane | vârf de CPU/RAM peste ce s-a măsurat | `concurrency` cu `cancel-in-progress` |

---

## 14. Ce NU s-a verificat

- **Vârful de la `docker build`.** Nemăsurat: utilizatorul a cerut de două ori să
  nu rulez build. Mărginit prin argument — VM-ul face deja exact acest build la
  fiecare deploy de producție, cu cele două replici pornite lângă el. Staging nu
  adaugă un vârf nou, ci o a doua ocazie pentru unul cunoscut. Se măsoară la
  primul build de staging.
- **Emiterea certificatului cu Cloudflare în față** (§7.1). Două subdomenii au
  deja certificate Let's Encrypt în aceleași condiții, deci calea e dovedită în
  practică pe acest VM — dar nu de mine, în sesiunea asta.
- **Dacă `strawboss-nginx-1` are `conf.d` montat citibil-scriibil** pentru un
  fișier nou: `cmd_nginx__vhost` verifică montarea, dar n-a fost exercitat
  niciodată cu un nume de fișier nou.
- **Comportamentul runner-ului la sesiuni concurente** — repo-ul e lucrat în
  paralel de mai multe sesiuni; `cancel-in-progress` presupune că anularea la
  mijlocul unui `docker build` lasă Docker într-o stare curată. De confirmat.

---

## 15. Abordările respinse

**Build pe GitHub + imagine în GHCR.** Ar cere renunțarea la
`--resolve-image never` — adică o schimbare în calea care duce azi în producție,
plus un registry și o cheie SSH cu drept de deploy în secretele GitHub. Costul
cade pe producție ca să câștige staging.

**Ascultător de webhook scris de mână.** Ar însemna reconstruit de la zero ce dă
GitHub gratis: coadă, jurnale, istoric, reluare, autentificare.

**Lanț paralel pentru staging.** Risc imediat zero pentru producție, dar drift
garantat: peste două luni staging probează altceva decât ce rulează în producție.
Exact tiparul care a produs backup-ul înghețat descris în `ops/06-nginx.sh:126`.

**Staging fără Swarm, pe Compose simplu.** Cel mai puțin de construit, dar
mecanismele care contează — `start-first`, `failure_action: rollback`,
healthcheck-ul dublu `/healthz` + `/readyz` — nu s-ar proba niciodată înainte să
fie nevoie de ele.

**Aceeași bază ca producția, cu o firmă-client de test.** RLS izolează citirile
între organizații, dar Server Actions au `SUPABASE_SERVICE_ROLE_KEY`, care
ocolește complet RLS. O acțiune greșită din staging ar atinge datele reale.

**Notificare WhatsApp la eșec.** CallMeBot e deja configurat și ar fi mers, dar
utilizatorul a preferat ca feedback-ul să rămână pe canalele unde e și codul.
