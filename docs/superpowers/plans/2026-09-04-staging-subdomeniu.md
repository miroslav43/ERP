# Staging pe subdomeniu — plan de implementare

> **Pentru executanți agentici:** SUB-SKILL OBLIGATORIU — folosește
> `superpowers:subagent-driven-development` (recomandat) sau
> `superpowers:executing-plans` ca să execuți planul sarcină cu sarcină. Pașii
> folosesc sintaxa cu casetă (`- [ ]`) ca să poată fi urmăriți.

**Scop:** Un coleg fără cont pe VM împinge în `main` și, câteva minute mai
târziu, vede codul lui rulând pe `staging.administrativo.ro` — sau vede exact de
ce n-a ajuns acolo.

**Arhitectura:** Un runner GitHub instalat ca serviciu systemd pe VM ia sarcina,
face checkout curat, trece porțile (`pnpm verify`, apoi migrările pe baza de
staging), construiește imaginea local și deployează un al doilea stack Swarm.
Același lanț de comenzi ca producția, comutat de o singură variabilă,
`ADM_MEDIU`. Erorile se întorc pe trei suprafețe: rezumatul rulării, un
comentariu pe commit și o pagină de stare servită de un container separat, care
rămâne în picioare tocmai când aplicația nu pornește.

**Stivă:** Bash (`ops/*.sh`), Docker Swarm 29.4.0, nginx partajat, GitHub
Actions cu runner self-hosted, Supabase Postgres 17, Next.js 16.3.

**Spec:** `docs/superpowers/specs/2026-09-04-staging-subdomeniu-design.md`

## Constrângeri globale

Toate se aplică fiecărei sarcini, fără a fi repetate acolo.

- **Limba:** cod, comentarii, mesaje și identificatori de domeniu **în română**,
  cu ș/ț cu virgulă dedesubt (U+0219/U+021B), nu cu sedilă. Mesajele de eroare
  se termină cu punct.
- **NU rula `pnpm build`.** Cerută explicit de utilizator, de două ori. Poarta
  locală e `pnpm typecheck && pnpm lint && pnpm test`. Build-ul îl face runner-ul,
  în `docker build`. Ce scapă local: un fișier `"use server"` care exportă o
  constantă — `tsc` tace, doar build-ul refuză.
- **Producția rămâne neschimbată la literă.** După fiecare sarcină care atinge
  `ops/` sau `docker-stack.yml`, un apel fără `ADM_MEDIU` trebuie să producă
  exact valorile de azi. `scripts/checks/medii.sh` (Sarcina 1) e poarta.
- **Git:** indexul e partajat între sesiuni. `git commit --only -- <căile tale>`,
  niciodată `-A` sau `.`. `git fetch origin main` și `git merge` (nu rebase)
  înainte de push. Munca se termină cu push.
- **Fără fan-out de agenți la implementare** (regula proiectului). Sarcinile se
  execută una câte una.
- **Secretele nu intră niciodată în repo.** Trăiesc în
  `~/.secrete/administrativo/`, cu drepturi `600`.
- **Migrările** se aplică prin `psql`, byte-exact, forward-only.

## Ce e deja făcut (nu reface)

- DNS: `staging.administrativo.ro` → Cloudflare → `62.171.154.194`. Verificat.
- Proiect Supabase de staging: `mjyuonhcltjoxektopcg`. Creat.
- `~/.secrete/administrativo/.env.staging` — scris, `600`, cu cele patru chei
  criptografice generate și verificate la 32 de octeți fiecare.
- Probele din specul §6 — rulate; concluziile sunt încorporate mai jos.

## Ce lipsește ca să treacă Sarcina 7

`DATABASE_URL` din `.env.staging` are o parolă respinsă de server
(`FATAL: password authentication failed`), iar proiectul nu e în regiunea
producției (`tenant/user not found` pe pooler-ul `aws-1-eu-west-1`). Utilizatorul
trebuie să dea șirul de conexiune din *Connect*, sau o parolă nouă din
*Settings → Database → Reset database password*. **Sarcinile 1-6 și 8-10 nu
depind de asta.**

---

## Structura fișierelor

| Fișier | Răspundere |
| --- | --- |
| `ops/_lib.sh` | *modificat* — un singur buton, `ADM_MEDIU`, care derivă toate numele |
| `ops/05-docker.sh` | *modificat* — generarea fișierului de stack + gărzile |
| `ops/06-nginx.sh` | *modificat* — vhost și certificat pe domeniul mediului |
| `ops/08-curatenie.sh` | *nou* — singurul loc care șterge ceva de pe disc |
| `docker-stack.yml` | *modificat* — `name:` la secrete, replici din variabilă |
| `scripts/checks/medii.sh` | *nou* — poarta „producția n-a mișcat" |
| `scripts/checks/stack-generat.sh` | *nou* — poarta „aliasul nu colizionează" |
| `deploy/nginx/32-staging.administrativo.ro.conf` | *nou* — vhost-ul staging |
| `deploy/stare-stack.yml` | *nou* — santinela de stare, stack propriu |
| `deploy/stare/index.html` | *nou* — pagina de stare (șablon) |
| `ops/09-stare.sh` | *nou* — scrierea stării după fiecare încercare |
| `.github/workflows/staging.yml` | *nou* — declanșatorul |

Fișierul `.stack-staging.generat.yml` e produs la fiecare deploy și **nu** e
urmărit de git.

---

## Sarcina 1: Un singur buton — `ADM_MEDIU`

**Fișiere:**
- Modifică: `ops/_lib.sh:11-22` (constantele) și `ops/_lib.sh:154` (`_env_file`)
- Creează: `scripts/checks/medii.sh`

**Interfețe:**
- Produce: variabilele `ADM_MEDIU`, `ADM_STACK`, `ADM_SERVICE`, `ADM_IMAGE`,
  `ADM_DOMAIN`, `ADM_VHOST`, `ADM_SECRET_PREFIX`, `ADM_REPLICI` — toate
  `readonly` după derivare. Consumate de sarcinile 2, 3, 5, 7.
- Produce: `_env_file()` → calea fișierului de mediu, diferită pe medii.

**Abatere de la spec, deliberată.** Specul §5 propunea `: "${X:=v}"` pentru
fiecare variabilă. Asta ar permite suprascrierea individuală din mediu, adică
amestecarea unui `ADM_DOMAIN` de staging cu un `ADM_STACK` de producție. Un
singur buton e mai greu de folosit greșit: `ADM_MEDIU` decide tot, restul rămân
`readonly`.

- [ ] **Pasul 1: Scrie poarta care trebuie să pice**

Creează `scripts/checks/medii.sh`:

```bash
#!/usr/bin/env bash
# ============================================================================
# Poarta „producția n-a mișcat".
#
# Invarianta pe care o apără: un apel FĂRĂ `ADM_MEDIU` trebuie să producă exact
# numele de azi. Dacă cineva schimbă implicitul, deploy-ul următor de producție
# ar merge într-un stack greșit — tăcut, fiindcă Swarm ar crea bucuros un stack
# nou în loc să-l actualizeze pe cel viu.
# ============================================================================
set -uo pipefail

RADACINA="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
esecuri=0

# Citește o variabilă dintr-un shell PROASPĂT, ca `readonly` să nu se ciocnească
# între verificări.
citeste() { # $1 = mediu ("" pentru implicit), $2 = numele variabilei
  if [ -z "$1" ]; then
    bash -c "source '$RADACINA/ops/_lib.sh' >/dev/null 2>&1; printf '%s' \"\$$2\""
  else
    ADM_MEDIU="$1" bash -c "source '$RADACINA/ops/_lib.sh' >/dev/null 2>&1; printf '%s' \"\$$2\""
  fi
}

verifica() { # $1 = mediu, $2 = variabilă, $3 = valoare așteptată
  local got; got="$(citeste "$1" "$2")"
  if [ "$got" = "$3" ]; then
    printf '  ✓ %-12s %-18s = %s\n' "${1:-implicit}" "$2" "$got"
  else
    printf '  ✗ %-12s %-18s = %-28s (așteptat: %s)\n' "${1:-implicit}" "$2" "$got" "$3"
    esecuri=$((esecuri + 1))
  fi
}

echo "Implicitul trebuie să fie producția de azi:"
verifica "" ADM_MEDIU         productie
verifica "" ADM_STACK         administrativo
verifica "" ADM_SERVICE       administrativo-web
verifica "" ADM_IMAGE         administrativo-web
verifica "" ADM_DOMAIN        administrativo.ro
verifica "" ADM_VHOST         30-administrativo.ro.conf
verifica "" ADM_SECRET_PREFIX ""
verifica "" ADM_REPLICI       2

echo "Explicit „productie" trebuie să dea același lucru:"
verifica productie ADM_STACK  administrativo
verifica productie ADM_DOMAIN administrativo.ro

echo "Staging trebuie să difere pe FIECARE nume care atinge rețeaua sau discul:"
verifica staging ADM_STACK         administrativo-staging
verifica staging ADM_SERVICE       administrativo-web-staging
verifica staging ADM_IMAGE         administrativo-web-staging
verifica staging ADM_DOMAIN        staging.administrativo.ro
verifica staging ADM_VHOST         32-staging.administrativo.ro.conf
verifica staging ADM_SECRET_PREFIX staging_
verifica staging ADM_REPLICI       1

echo "Un mediu necunoscut trebuie să OPREASCĂ, nu să cadă pe implicit:"
if ADM_MEDIU=tipsit bash -c "source '$RADACINA/ops/_lib.sh'" >/dev/null 2>&1; then
  echo "  ✗ mediul „tipsit\" a fost acceptat"
  esecuri=$((esecuri + 1))
else
  echo "  ✓ mediul „tipsit\" a fost respins"
fi

echo ""
if [ "$esecuri" -gt 0 ]; then
  echo "$esecuri verificări au picat."
  exit 1
fi
echo "Toate verificările au trecut."
```

- [ ] **Pasul 2: Rulează poarta și confirmă că pică**

```bash
chmod +x scripts/checks/medii.sh && bash scripts/checks/medii.sh
```

Așteptat: FAIL. `ADM_MEDIU` nu există încă, `ADM_SECRET_PREFIX` și `ADM_REPLICI`
nici atât, iar `ADM_MEDIU=tipsit` e acceptat fiindcă nimic nu-l citește.

- [ ] **Pasul 3: Înlocuiește blocul de constante din `ops/_lib.sh:11-22`**

Șterge cele zece linii `readonly ADM_*` și pune în locul lor:

```bash
# ---------------------------------------------------------------------------
# Mediul — SINGURUL buton. Tot ce urmează se derivă din el.
#
# DE CE UN SINGUR BUTON și nu o variabilă suprascriptibilă per nume: un
# `ADM_DOMAIN` de staging combinat din greșeală cu un `ADM_STACK` de producție
# ar instala vhost-ul staging peste serviciul viu. Cu un singur comutator,
# combinația aia nu se poate exprima.
#
# Implicit „productie", deci fiecare apel existent se comportă EXACT ca înainte.
# Poarta care apără asta: scripts/checks/medii.sh.
# ---------------------------------------------------------------------------
ADM_MEDIU="${ADM_MEDIU:-productie}"

case "$ADM_MEDIU" in
  productie)
    ADM_STACK="administrativo"
    ADM_SERVICE="administrativo-web"
    ADM_IMAGE="administrativo-web"
    ADM_DOMAIN="administrativo.ro"
    ADM_VHOST="30-administrativo.ro.conf"
    ADM_SECRET_PREFIX=""
    ADM_REPLICI=2
    ;;
  staging)
    # Cheia serviciului DIFERĂ, nu doar numele stack-ului. `docker stack deploy`
    # înregistrează pe rețea un alias egal cu cheia serviciului, iar
    # `strawboss-net` e partajată de toate site-urile VM-ului: cu aceeași cheie,
    # nginx ar trimite intermitent trafic de producție în staging. Verificat cu
    # `docker service inspect` și `nslookup` pe 2026-09-04.
    ADM_STACK="administrativo-staging"
    ADM_SERVICE="administrativo-web-staging"
    ADM_IMAGE="administrativo-web-staging"
    ADM_DOMAIN="staging.administrativo.ro"
    ADM_VHOST="32-staging.administrativo.ro.conf"
    # Secretele Docker sunt `external: true` cu nume GLOBALE. Fără prefix,
    # staging ar monta cheia `service_role` a producției — cea care ocolește
    # complet RLS.
    ADM_SECRET_PREFIX="staging_"
    ADM_REPLICI=1
    ;;
  *)
    echo "Mediu necunoscut: ${ADM_MEDIU}. Valori acceptate: productie, staging." >&2
    exit 1
    ;;
esac

readonly ADM_MEDIU ADM_STACK ADM_SERVICE ADM_IMAGE ADM_DOMAIN ADM_VHOST
readonly ADM_SECRET_PREFIX ADM_REPLICI

# Comune tuturor mediilor — nu depind de comutator.
readonly ADM_PORT=3000
readonly ADM_OVERLAY="strawboss-net"                # overlay-ul partajat cu nginx
readonly ADM_NGINX="strawboss-nginx-1"              # edge-ul partajat al VM-ului
readonly ADM_NGINX_CONFD="/srv/apps/Strawboss/nginx/conf.d"
readonly ADM_STRAWBOSS_ROOT="/srv/apps/Strawboss"
```

- [ ] **Pasul 4: Înlocuiește `_env_file()` (linia 154 din fișierul original)**

```bash
# Producția își ține mediul în repo (fișier ignorat de git). Staging-ul NU:
# secretele lui stau în afara arborelui, fiindcă spațiul de lucru al runner-ului
# se rescrie la fiecare checkout, iar un fișier de secrete în repo ar fi la un
# `git add` distanță de a ajunge pe GitHub.
_env_file() {
  if [ "$ADM_MEDIU" = "productie" ]; then
    echo "$ADMINISTRATIVO_ROOT/.env.production"
  else
    echo "${ADM_SECRETE_DIR:-$HOME/.secrete/administrativo}/.env.${ADM_MEDIU}"
  fi
}
```

Și în `_load_env`, mesajul de eroare care spunea „Lipsește .env.production"
devine:

```bash
    error "Lipsește $(basename "$f") pentru mediul ${ADM_MEDIU}."
```

- [ ] **Pasul 5: Rulează poarta și confirmă că trece**

```bash
bash scripts/checks/medii.sh
```

Așteptat: „Toate verificările au trecut."

- [ ] **Pasul 6: Confirmă că producția chiar n-a mișcat**

```bash
./administrativo.sh status
```

Așteptat: aceeași ieșire ca înainte de modificare — stack `administrativo`,
domeniu `administrativo.ro`, serviciul viu găsit. Dacă apare „stack inexistent",
derivarea e greșită; **oprește-te aici**.

- [ ] **Pasul 7: Comite**

```bash
git status --short -- ops/_lib.sh scripts/checks/medii.sh
git add -- ops/_lib.sh scripts/checks/medii.sh
git commit --only -m "feat(ops): ADM_MEDIU — un singur buton pentru două medii" \
  -- ops/_lib.sh scripts/checks/medii.sh
```

---

## Sarcina 2: Fișierul de stack generat, cu gărzi

**Fișiere:**
- Modifică: `ops/05-docker.sh` (adaugă `_genereaza_stack`, folosește-o în
  `cmd_stack__deploy`)
- Creează: `scripts/checks/stack-generat.sh`
- Modifică: `.gitignore`

**Interfețe:**
- Consumă: `ADM_MEDIU`, `ADM_SERVICE` din Sarcina 1.
- Produce: `_genereaza_stack()` → scrie pe stdout calea fișierului de stack de
  folosit. Pentru producție întoarce `docker-stack.yml` neatins.

**De ce generare și nu parametrizare** — probat 2026-09-04, detaliile în specul
§6: o variabilă pe poziția unei chei YAML e respinsă de schema Compose
(`Additional property ${…} is not allowed`), un alias explicit se *adaugă* peste
cel implicit (`[administrativo-web-staging administrativo-web]` — coliziunea
rămâne), iar `extends` nu e implementat în `docker stack deploy`.

- [ ] **Pasul 1: Scrie poarta care trebuie să pice**

Creează `scripts/checks/stack-generat.sh`:

```bash
#!/usr/bin/env bash
# ============================================================================
# Poarta „aliasul nu colizionează".
#
# Fișierul de stack al staging-ului se obține redenumind O cheie din
# docker-stack.yml. Dacă redenumirea nu se aplică — fiindcă serviciul a fost
# redenumit între timp în fișierul de bază — rezultatul ar fi un stack de
# staging cu cheia de producție, adică două servicii cu ACELAȘI alias pe
# `strawboss-net`. nginx ar împărți traficul de producție între ele.
#
# Defectul e tăcut: deploy verde, site funcțional, date greșite intermitent.
# Verificarea de aici e singura care îl prinde înainte.
# ============================================================================
set -uo pipefail

RADACINA="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
esecuri=0

ruleaza() { # rulează _genereaza_stack cu o rădăcină dată
  ADM_MEDIU=staging ADMINISTRATIVO_ROOT="$1" bash -c '
    source "$ADMINISTRATIVO_ROOT/ops/_lib.sh" >/dev/null 2>&1
    source "$ADMINISTRATIVO_ROOT/ops/05-docker.sh" >/dev/null 2>&1
    _genereaza_stack
  ' 2>&1
}

# --- 1. Cazul bun: fișierul real ---
cale="$(ruleaza "$RADACINA")" && cod=0 || cod=$?
if [ "$cod" -ne 0 ]; then
  echo "  ✗ generarea a eșuat pe docker-stack.yml real: $cale"
  esecuri=$((esecuri + 1))
else
  if grep -q '^  administrativo-web-staging:$' "$cale"; then
    echo "  ✓ cheia de staging e prezentă"
  else
    echo "  ✗ cheia de staging LIPSEȘTE din $cale"; esecuri=$((esecuri + 1))
  fi
  if grep -q '^  administrativo-web:$' "$cale"; then
    echo "  ✗ cheia de PRODUCȚIE a rămas în fișierul generat"; esecuri=$((esecuri + 1))
  else
    echo "  ✓ cheia de producție a dispărut"
  fi
fi

# --- 2. Cazul rău: serviciul a fost redenumit în fișierul de bază ---
cp -r "$RADACINA/ops" "$TMP/ops"
sed 's/^  administrativo-web:$/  alt-nume-web:/' \
    "$RADACINA/docker-stack.yml" > "$TMP/docker-stack.yml"
if ruleaza "$TMP" >/dev/null 2>&1; then
  echo "  ✗ garda NU a oprit un fișier de bază redenumit"
  esecuri=$((esecuri + 1))
else
  echo "  ✓ garda a oprit un fișier de bază redenumit"
fi

# --- 3. Producția primește fișierul original, neatins ---
prod="$(ADM_MEDIU=productie ADMINISTRATIVO_ROOT="$RADACINA" bash -c '
  source "$ADMINISTRATIVO_ROOT/ops/_lib.sh" >/dev/null 2>&1
  source "$ADMINISTRATIVO_ROOT/ops/05-docker.sh" >/dev/null 2>&1
  _genereaza_stack')"
if [ "$prod" = "$RADACINA/docker-stack.yml" ]; then
  echo "  ✓ producția folosește docker-stack.yml neatins"
else
  echo "  ✗ producția a primit „$prod\" în loc de docker-stack.yml"
  esecuri=$((esecuri + 1))
fi

echo ""
if [ "$esecuri" -gt 0 ]; then echo "$esecuri verificări au picat."; exit 1; fi
echo "Toate verificările au trecut."
```

- [ ] **Pasul 2: Rulează poarta și confirmă că pică**

```bash
chmod +x scripts/checks/stack-generat.sh && bash scripts/checks/stack-generat.sh
```

Așteptat: FAIL — `_genereaza_stack` nu există.

- [ ] **Pasul 3: Adaugă `_genereaza_stack` în `ops/05-docker.sh`**

Pune funcția înaintea lui `cmd_stack__deploy`:

```bash
# ---------------------------------------------------------------------------
# Fișierul de stack al mediului.
#
# Producția folosește docker-stack.yml direct. Staging-ul are nevoie de o CHEIE
# de serviciu diferită, fiindcă `docker stack deploy` înregistrează pe rețea un
# alias egal cu cheia, iar `strawboss-net` e partajată de tot VM-ul.
#
# Cheia nu se poate parametriza: schema Compose se validează înaintea
# interpolării. Un alias explicit nu ajută: cel implicit se adaugă oricum.
# `extends` nu e implementat. Rămâne redenumirea — o substituție ancorată, cu
# două gărzi, fiindcă un `sed` care nu potrivește nimic ar produce TĂCUT exact
# coliziunea pe care o evităm.
# ---------------------------------------------------------------------------
_genereaza_stack() {
  local sursa="$ADMINISTRATIVO_ROOT/docker-stack.yml"

  if [ "$ADM_MEDIU" = "productie" ]; then
    echo "$sursa"
    return 0
  fi

  local dest="$ADMINISTRATIVO_ROOT/.stack-${ADM_MEDIU}.generat.yml"
  sed "s|^  administrativo-web:\$|  ${ADM_SERVICE}:|" "$sursa" > "$dest"

  if ! grep -q "^  ${ADM_SERVICE}:\$" "$dest"; then
    error "Generarea stack-ului a eșuat: cheia ${ADM_SERVICE} nu apare în fișierul generat."
    error "Cel mai probabil serviciul a fost redenumit în docker-stack.yml."
    rm -f "$dest"
    exit 1
  fi

  if grep -q '^  administrativo-web:$' "$dest"; then
    error "Generarea stack-ului a eșuat: cheia de producție a rămas în fișierul generat."
    error "Ar înregistra un alias de rețea în coliziune cu producția."
    rm -f "$dest"
    exit 1
  fi

  echo "$dest"
}
```

- [ ] **Pasul 4: Folosește-o în `cmd_stack__deploy`**

Înlocuiește linia care dă `-c "$ADMINISTRATIVO_ROOT/docker-stack.yml"`:

```bash
  local fisier_stack; fisier_stack="$(_genereaza_stack)"
  info "Stack: ${ADM_STACK}  ·  fișier: $(basename "$fisier_stack")"

  IMAGE_TAG="$ADM_IMAGE_TAG" docker stack deploy \
    -c "$fisier_stack" \
    --resolve-image never \
    "$ADM_STACK"
```

- [ ] **Pasul 5: Adaugă fișierul generat în `.gitignore`**

```
# Fișierul de stack al mediilor non-producție, generat la fiecare deploy din
# docker-stack.yml (vezi _genereaza_stack). Nu se editează niciodată de mână:
# o modificare aici s-ar pierde tăcut la următorul deploy.
/.stack-*.generat.yml
```

- [ ] **Pasul 6: Rulează ambele porți**

```bash
bash scripts/checks/stack-generat.sh && bash scripts/checks/medii.sh
```

Așteptat: ambele „Toate verificările au trecut."

- [ ] **Pasul 7: Confirmă că fișierul generat chiar e valid pentru Swarm**

```bash
ADM_MEDIU=staging ADM_SECRET_PREFIX=staging_ ADM_REPLICI=1 IMAGE_TAG=proba \
NEXT_PUBLIC_SUPABASE_URL=https://exemplu.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=proba NEXT_PUBLIC_APP_URL=https://exemplu.ro \
HR_ENCRYPTION_ACTIVE_KEY=1 \
docker stack config -c .stack-staging.generat.yml | grep -E "^  administrativo|name:"
```

Așteptat: apare `administrativo-web-staging:`, **nu** apare `administrativo-web:`.

- [ ] **Pasul 8: Comite**

```bash
git add -- ops/05-docker.sh scripts/checks/stack-generat.sh .gitignore
git commit --only -m "feat(ops): fișier de stack generat, cu gărzi împotriva coliziunii de alias" \
  -- ops/05-docker.sh scripts/checks/stack-generat.sh .gitignore
```

---

## Sarcina 3: `docker-stack.yml` — secrete prefixate și replici variabile

**Fișiere:**
- Modifică: `docker-stack.yml` (blocul `secrets:` de la linia 171 și
  `deploy.replicas` de la linia 147)

**Interfețe:**
- Consumă: `ADM_SECRET_PREFIX`, `ADM_REPLICI` din Sarcina 1.
- Produce: un fișier de stack care, cu prefix gol, dă exact secretele de azi.

`name:` e o **valoare**, deci acceptă interpolare — probat 2026-09-04:
`staging_proba_cheie -> /run/secrets/proba_cheie`. Serviciul cere secretul pe
numele lui logic, iar `name:` spune care secret extern se montează acolo. Codul
aplicației și `deploy/entrypoint.sh` rămân neatinse.

- [ ] **Pasul 1: Modifică blocul `secrets:`**

```yaml
secrets:
  # `external: true`: secretele sunt create O SINGURĂ DATĂ, în afara stack-ului
  # (`docker secret create <nume> -`), și supraviețuiesc unui `stack rm`.
  #
  # `name:` separă numele LOGIC (calea din /run/secrets/, pe care o citește
  # deploy/entrypoint.sh) de numele REAL al secretului din Swarm. Fără el, ambele
  # medii ar cere aceleași secrete globale, iar staging ar monta cheia
  # `service_role` a producției — cea care ocolește complet RLS.
  # Prefixul e gol pentru producție, deci numele rămân exact cele de azi.
  supabase_service_role_key:
    external: true
    name: ${ADM_SECRET_PREFIX:-}supabase_service_role_key
  hr_encryption_keys:
    external: true
    name: ${ADM_SECRET_PREFIX:-}hr_encryption_keys
  hr_hash_key:
    external: true
    name: ${ADM_SECRET_PREFIX:-}hr_hash_key
  tenant_cookie_secret:
    external: true
    name: ${ADM_SECRET_PREFIX:-}tenant_cookie_secret
```

- [ ] **Pasul 2: Fă numărul de replici variabil**

```yaml
    deploy:
      # 2 în producție (rolling update fără fereastră cu zero replici), 1 în
      # staging — unde o cădere nu costă nimic, iar a doua replică ar dubla
      # degeaba memoria pe un VM cu nouă site-uri.
      replicas: ${ADM_REPLICI:-2}
```

- [ ] **Pasul 3: Verifică randarea pentru PRODUCȚIE — numele nu trebuie să se schimbe**

```bash
set -a; . .env.production; set +a
IMAGE_TAG=proba docker stack config -c docker-stack.yml | grep -A2 "^secrets:" -A20 | grep "name:"
```

Așteptat: exact `supabase_service_role_key`, `hr_encryption_keys`,
`hr_hash_key`, `tenant_cookie_secret` — fără prefix. Și:

```bash
IMAGE_TAG=proba docker stack config -c docker-stack.yml | grep -A2 "replicas:"
```

Așteptat: `replicas: 2`.

- [ ] **Pasul 4: Verifică randarea pentru STAGING**

```bash
ADM_SECRET_PREFIX=staging_ ADM_REPLICI=1 IMAGE_TAG=proba \
docker stack config -c docker-stack.yml | grep "name:\|replicas:"
```

Așteptat: cele patru nume cu `staging_` în față, `replicas: 1`.

- [ ] **Pasul 5: Comite**

```bash
git add -- docker-stack.yml
git commit --only -m "feat(deploy): secrete per mediu prin name:, replici din variabilă" \
  -- docker-stack.yml
```

---

## Sarcina 4: Curățenia — livrabilă singură, utilă imediat

**Fișiere:**
- Creează: `ops/08-curatenie.sh`

**Interfețe:**
- Consumă: `ADM_IMAGE` din Sarcina 1.
- Produce: comanda `./administrativo.sh curata [câte_păstrez]`.

Măsurat pe VM la 2026-09-04: 197 de imagini (89,55 GB recuperabili), 2317 intrări
de cache de build (70,49 GB recuperabili), 40 de tag-uri `administrativo-web`
adunate în zece zile. Fiecare deploy lasă ~125 MB (stratul
`COPY .next/standalone`). Nimic nu a curățat vreodată.

- [ ] **Pasul 1: Scrie comanda**

```bash
#!/usr/bin/env bash
# ============================================================================
# ops/08-curatenie.sh — singurul loc din proiect care șterge ceva de pe disc.
# ============================================================================

# @section "Întreținere"

# @cmd curata "Șterge imaginile vechi și cache-ul de build [câte tag-uri păstrez]"
cmd_curata() {
  local pastrez="${1:-5}"
  header "Curățenie — păstrez ultimele ${pastrez} tag-uri per imagine"
  require_cmd docker

  # DE CE NU `docker volume prune`, NICIODATĂ, nici cu confirmare:
  # măsurat pe acest VM, 239 din 245 de volume sunt neatașate — dar mașina
  # servește nouă site-uri, ale mai multor proiecte. Un volum „neatașat" poate
  # fi baza unui serviciu oprit temporar. Ștergerea e ireversibilă și n-ar fi
  # a noastră.
  local inainte; inainte=$(df --output=avail -BG / | tail -1 | tr -dc '0-9')

  local sters=0
  for imagine in "administrativo-web" "administrativo-web-staging"; do
    # Ordonate descrescător după data creării; sar peste primele $pastrez.
    # `latest` se exclude explicit: e un alias spre tagul viu, iar ștergerea lui
    # ar lăsa `docker-stack.yml` fără implicitul din `${IMAGE_TAG:-latest}`.
    local vechi
    vechi=$(docker images "$imagine" --format '{{.CreatedAt}}\t{{.Tag}}' 2>/dev/null \
            | grep -v $'\tlatest$' | sort -r | tail -n "+$((pastrez + 1))" | cut -f2)
    for tag in $vechi; do
      if docker rmi "${imagine}:${tag}" >/dev/null 2>&1; then
        sters=$((sters + 1))
      else
        # Imaginea e folosită de un serviciu viu (tipic: tagul aflat în rulare).
        # Nu e o eroare, e exact protecția pe care o vrem.
        _infol "sar peste" "${imagine}:${tag} — în uz"
      fi
    done
  done
  _ok "imagini șterse" "$sters"

  # Cache-ul de build e sigur de șters: costă doar un build mai lent data
  # viitoare. Peste o săptămână, straturile oricum nu se mai potrivesc.
  info "Curăț cache-ul de build mai vechi de 7 zile..."
  docker builder prune --force --filter until=168h 2>&1 | tail -1

  local dupa; dupa=$(df --output=avail -BG / | tail -1 | tr -dc '0-9')
  echo ""
  success "Spațiu liber: ${inainte} GB → ${dupa} GB (+$((dupa - inainte)) GB)"
}
```

- [ ] **Pasul 2: Confirmă că apare în help fără nicio înregistrare**

```bash
./administrativo.sh help | grep curata
```

Așteptat: linia apare — `administrativo.sh` sursează `ops/[!_]*.sh` și citește
adnotările `@cmd`.

- [ ] **Pasul 3: Rulează în gol, cu un prag care nu șterge nimic**

```bash
./administrativo.sh curata 999
```

Așteptat: „imagini șterse 0", cache-ul curățat, spațiul crescut. Producția
trebuie să rămână sus:

```bash
./administrativo.sh stack:status
```

- [ ] **Pasul 4: Rulează în serios**

```bash
./administrativo.sh curata 5
docker images administrativo-web -q | wc -l
```

Așteptat: cel mult 6 (cele 5 păstrate + `latest`). Site-ul trebuie să răspundă:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://administrativo.ro
```

Așteptat: `200` sau `307`.

- [ ] **Pasul 5: Adaugă pragul de disc în `doctor`**

Cerut de specul §13: curățenia repară, dar nimeni nu e avertizat că se apropie
pragul. În `ops/03-status.sh`, în `cmd_doctor`, adaugă:

```bash
  # Un VM cu Docker rămas fără disc nu doboară doar aplicația noastră: cade tot
  # ce scrie pe `/`, adică toate cele nouă site-uri de aici.
  local ocupat; ocupat=$(df --output=pcent / | tail -1 | tr -dc '0-9')
  if [ "$ocupat" -ge 90 ]; then
    _fail "disc" "${ocupat}% ocupat — rulează ./administrativo.sh curata"
  elif [ "$ocupat" -ge 80 ]; then
    warn "Disc ${ocupat}% ocupat. ./administrativo.sh curata întoarce zeci de GB."
  else
    _ok "disc" "${ocupat}% ocupat"
  fi
```

Verifică: `./administrativo.sh doctor | grep -i disc` — la 82% trebuie să apară
avertismentul, nu eșecul.

- [ ] **Pasul 6: Comite**

```bash
git add -- ops/08-curatenie.sh ops/03-status.sh
git commit --only -m "feat(ops): comanda curata + prag de disc în doctor" \
  -- ops/08-curatenie.sh ops/03-status.sh
```

---

## Sarcina 5: Vhost-ul de staging

**Fișiere:**
- Creează: `deploy/nginx/32-staging.administrativo.ro.conf`
- Modifică: `ops/06-nginx.sh` — **o singură schimbare**, la `ssl:issue`

**Interfețe:**
- Consumă: `ADM_DOMAIN`, `ADM_VHOST`, `ADM_SERVICE`, `ADM_MEDIU` din Sarcina 1.

**`cmd_nginx__vhost` nu are nevoie de nicio modificare** — verificat: folosește
deja `${ADM_NGINX_CONFD}/${ADM_VHOST}`,
`${ADMINISTRATIVO_ROOT}/deploy/nginx/${ADM_VHOST}` și verifică certificatul pe
`${ADM_DOMAIN}`. După Sarcina 1 e parametrizată gratis. `ssl:issue` însă **nu**:
cere mereu și `www.${ADM_DOMAIN}` (linia 211), iar `www.staging.administrativo.ro`
nu are înregistrare DNS.

- [ ] **Pasul 1: Pornește de la vhost-ul de producție, nu de la zero**

```bash
cp deploy/nginx/30-administrativo.ro.conf \
   deploy/nginx/32-staging.administrativo.ro.conf
```

- [ ] **Pasul 2: Schimbă cele cinci locuri care privesc numele**

În fișierul nou:

1. Blocul `listen 80` — `server_name staging.administrativo.ro;` (fără `www.`).
2. Șterge complet blocul `listen 443` al lui `www.` — staging n-are `www`.
3. Blocul `listen 443` principal — `server_name staging.administrativo.ro;`.
4. Căile certificatului —
   `/etc/letsencrypt/live/staging.administrativo.ro/fullchain.pem` și `privkey.pem`.
5. Ambele `set $u` — `set $u administrativo-web-staging:3000;`.

Jurnalul separat: `access_log /var/log/nginx/staging.administrativo.log durate;`.

- [ ] **Pasul 3: Adaugă cele două lucruri pe care producția nu le are**

În blocul `listen 443` principal, înaintea lui `location /`:

```nginx
    # Staging servește ACELAȘI conținut de vitrină ca situl real. Fără asta,
    # Google îl indexează și cele două domenii concurează pe exact aceleași
    # pagini — iar cel de test câștigă uneori, fiindcă e mai nou.
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;

    # Mediul de probă nu e public. Fișierul e citit din interiorul
    # containerului nginx, de aceea calea e cea montată, nu cea de pe gazdă.
    auth_basic           "Administrativo — mediu de probă";
    auth_basic_user_file /etc/nginx/conf.d/.htpasswd-staging;
```

Excepție necesară, altfel certbot nu poate reînnoi certificatul — se pune în
blocul `listen 80`, care oricum nu are `auth_basic`:

```nginx
    location /.well-known/acme-challenge/ {
        auth_basic off;
        root /var/www/certbot;
    }
```

- [ ] **Pasul 4: Repară `ssl:issue` pentru subdomenii**

În `ops/06-nginx.sh`, înlocuiește linia `-d "$ADM_DOMAIN" -d "www.${ADM_DOMAIN}" \`
cu o listă construită:

```bash
  # `www.` există în DNS doar pentru domeniul principal. Un `-d
  # www.staging.administrativo.ro` ar face certbot să pice pe validarea unui nume
  # fără înregistrare — iar eșecul e pe TOT certificatul, nu doar pe numele lipsă,
  # deci nici domeniul care există n-ar primi certificat.
  local domenii=(-d "$ADM_DOMAIN")
  if [ "$ADM_MEDIU" = "productie" ]; then
    domenii+=(-d "www.${ADM_DOMAIN}")
  fi
```

și folosește `"${domenii[@]}"` în apelul certbot. Actualizează și textul
confirmării, care spune „+ www":

```bash
  confirm "Emit certificat pentru ${ADM_DOMAIN}$([ "$ADM_MEDIU" = productie ] && echo " + www")?" \
    || { info "Anulat."; return 0; }
```

- [ ] **Pasul 5: Generează fișierul de parole**

```bash
UTILIZATOR=coleg
PAROLA=$(openssl rand -base64 18)
CONFD=/srv/apps/Strawboss/nginx/conf.d
printf '%s:%s\n' "$UTILIZATOR" "$(openssl passwd -apr1 "$PAROLA")" \
  > "$CONFD/.htpasswd-staging"
chmod 644 "$CONFD/.htpasswd-staging"
echo "Utilizator: $UTILIZATOR   Parolă: $PAROLA"
```

Notează parola — `openssl passwd` e ireversibil. Fișierul stă în `conf.d`,
fiindcă ăla e singurul director deja montat în containerul nginx; un montaj nou
ar cere recrearea nginx-ului, adică o clipire pe toate cele nouă site-uri.

- [ ] **Pasul 6: Verifică sintaxa fără să instalezi nimic**

```bash
docker exec -i strawboss-nginx-1 sh -c 'cat > /tmp/proba.conf' \
  < deploy/nginx/32-staging.administrativo.ro.conf
docker exec strawboss-nginx-1 nginx -t -c /etc/nginx/nginx.conf
```

Așteptat: `syntax is ok` / `test is successful`. Verificarea reală vine în
Sarcina 6, după certificat — `nginx -t` pică pe un `ssl_certificate` inexistent.

- [ ] **Pasul 7: Confirmă că producția n-a pierdut `www`**

```bash
bash scripts/checks/medii.sh
grep -n 'domenii+=' ops/06-nginx.sh
```

Așteptat: poarta trece, iar `www` se adaugă doar pe ramura `productie`.

- [ ] **Pasul 8: Comite**

```bash
git add -- deploy/nginx/32-staging.administrativo.ro.conf ops/06-nginx.sh
git commit --only -m "feat(nginx): vhost staging cu noindex și autentificare de bază" \
  -- deploy/nginx/32-staging.administrativo.ro.conf ops/06-nginx.sh
```

---

## Sarcina 6: Certificat și instalarea vhost-ului

**Fișiere:** niciunul — sarcină operațională, se rulează o dată.

**Ordinea e impusă de cod**, nu de preferință: `ops/06-nginx.sh:113` refuză să
instaleze un vhost cu `listen 443 ssl` dacă certificatul lipsește, fiindcă un
`ssl_certificate` inexistent face nginx să nu mai **pornească** — ar cădea toate
cele nouă site-uri, nu doar staging.

- [ ] **Pasul 1: Emite certificatul**

```bash
ADM_MEDIU=staging ./administrativo.sh ssl:issue
```

- [ ] **Pasul 2: Dacă pică, treci temporar norul Cloudflare pe gri**

Provocarea HTTP-01 trece prin Cloudflare. Dacă „Always Use HTTPS" o
redirecționează spre un HTTPS pe care originea încă nu-l poate servi pentru acest
nume, comută înregistrarea `staging` pe *DNS only* în panoul Cloudflare, reia
pasul 1, apoi repune proxy-ul. Pe VM există deja 11 certificate Let's Encrypt,
printre care `analitice.administrativo.ro` — deci calea funcționează.

- [ ] **Pasul 3: Confirmă certificatul în volum**

```bash
docker exec strawboss-nginx-1 ls /etc/letsencrypt/live/staging.administrativo.ro/
```

Așteptat: `fullchain.pem`, `privkey.pem`.

- [ ] **Pasul 4: Instalează vhost-ul**

```bash
ADM_MEDIU=staging ./administrativo.sh nginx:vhost
```

Comanda face singură: backup, snapshot `conf.d`, scriere in-place, `nginx -t`,
reload — și revenire automată dacă testul pică.

- [ ] **Pasul 5: Confirmă că celelalte site-uri n-au pățit nimic**

```bash
for d in administrativo.ro analitice.administrativo.ro serviceproof.ro \
         nortiauno.com serafullautonoma.ro; do
  printf '%-34s %s\n' "$d" "$(curl -s -o /dev/null -w '%{http_code}' "https://$d")"
done
```

Așteptat: fiecare răspunde 200/301/307. Un `000` înseamnă că nginx a căzut —
`./administrativo.sh nginx:restore` imediat.

- [ ] **Pasul 6: Confirmă staging-ul**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://staging.administrativo.ro
```

Așteptat: `401` — autentificarea de bază răspunde, deci vhost-ul e viu, iar
upstream-ul încă nu există (normal, stack-ul nu e deployat).

---

## Sarcina 7: Baza de staging

**Blocată** până când `DATABASE_URL` din `~/.secrete/administrativo/.env.staging`
conține credențiale valide (vezi „Ce lipsește").

- [ ] **Pasul 1: Confirmă conexiunea**

```bash
set -a; . ~/.secrete/administrativo/.env.staging; set +a
psql "$DATABASE_URL" -tAc 'select current_database();'
```

Așteptat: `postgres`.

- [ ] **Pasul 2: Confirmă că baza e goală**

```bash
psql "$DATABASE_URL" -tAc \
  "select count(*) from information_schema.tables where table_schema='public';"
```

Așteptat: `0`. Dacă nu e 0, **oprește-te** — nu e proiectul de staging.

- [ ] **Pasul 3: Aplică toate migrările**

```bash
ADM_MEDIU=staging ./administrativo.sh db:migrate
```

`internal.migrari_aplicate` e goală pe un proiect nou, deci „aplică doar ce
lipsește" înseamnă „aplică tot", în ordine, fiecare în tranzacția ei.

- [ ] **Pasul 4: Confirmă**

```bash
ADM_MEDIU=staging ./administrativo.sh db:status
ADM_MEDIU=staging ./administrativo.sh db:check-rls
```

Așteptat: toate migrările aplicate, zero tabele publice fără RLS.

- [ ] **Pasul 5: Creează cele patru secrete Docker prefixate**

```bash
set -a; . ~/.secrete/administrativo/.env.staging; set +a
printf '%s' "$SUPABASE_SERVICE_ROLE_KEY" | docker secret create staging_supabase_service_role_key -
printf '%s' "$HR_ENCRYPTION_KEYS"        | docker secret create staging_hr_encryption_keys -
printf '%s' "$HR_HASH_KEY"               | docker secret create staging_hr_hash_key -
printf '%s' "$TENANT_COOKIE_SECRET"      | docker secret create staging_tenant_cookie_secret -
docker secret ls --format '{{.Name}}' | grep staging_
```

Așteptat: patru nume. `printf '%s'` fără `\n` — `entrypoint.sh` taie newline-ul
final, dar e mai curat să nu existe.

- [ ] **Pasul 6: Primul deploy, manual**

```bash
ADM_MEDIU=staging ./administrativo.sh stack:deploy
```

- [ ] **Pasul 7: Verificarea care contează cel mai mult**

```bash
docker run --rm --network strawboss-net alpine nslookup administrativo-web | tail -3
docker service inspect administrativo-staging_administrativo-web-staging \
  --format '{{range .Spec.TaskTemplate.Networks}}{{.Aliases}}{{end}}'
```

Așteptat: prima comandă întoarce **o singură** adresă, aceeași ca înainte de
deploy-ul de staging; a doua întoarce `[administrativo-web-staging]`. Dacă
`administrativo-web` întoarce acum două adrese, **oprește tot imediat**
(`docker stack rm administrativo-staging`) — traficul de producție se împarte.

- [ ] **Pasul 8: Confirmă că staging răspunde**

```bash
curl -s -u coleg:<parola> -o /dev/null -w '%{http_code}\n' https://staging.administrativo.ro
```

Așteptat: `200` sau `307`.

---

## Sarcina 8: Runner-ul GitHub, ca serviciu systemd

**Fișiere:** niciunul în repo — instalare pe gazdă.

- [ ] **Pasul 1: Ia jetonul de înregistrare**

Din GitHub: `Settings → Actions → Runners → New self-hosted runner`, Linux x64.
Jetonul expiră în o oră.

- [ ] **Pasul 2: Instalează în directorul propriu al utilizatorului**

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o runner.tar.gz -L https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-linux-x64-2.319.1.tar.gz
tar xzf runner.tar.gz && rm runner.tar.gz
./config.sh --url https://github.com/miroslav43/ERP \
            --token <JETON> \
            --name administrativo-vm \
            --labels self-hosted,administrativo \
            --work _work --unattended
```

Eticheta `administrativo` e cea pe care o cere workflow-ul din Sarcina 9.

- [ ] **Pasul 3: Instalează ca serviciu**

```bash
sudo ./svc.sh install miro
sudo ./svc.sh start
sudo ./svc.sh status
```

Rulează ca `miro`, nu ca root: are nevoie de grupul `docker` (îl are deja,
altfel comenzile de până acum n-ar fi mers) și de citirea din
`~/.secrete/administrativo/`.

- [ ] **Pasul 4: Confirmă din GitHub**

Runner-ul apare „Idle" în lista de runners.

- [ ] **Pasul 5: Confirmă că vede uneltele**

```bash
cd ~/actions-runner && ./run.sh --once   # dacă serviciul e oprit
```

Sau, mai simplu, un workflow de probă cu `runs-on: [self-hosted, administrativo]`
care rulează `docker version && pnpm --version && psql --version`.

---

## Sarcina 9: Workflow-ul

**Fișiere:**
- Creează: `.github/workflows/staging.yml`

- [ ] **Pasul 1: Scrie workflow-ul**

```yaml
name: Staging

# DE CE `push` pe main și nu pe orice ramură: runner-ul rulează pe VM și execută
# ce scrie în workflow, iar workflow-ul vine din repo. Limitarea la main e
# singurul lucru care stă între un PR dintr-un fork și shell-ul mașinii.
on:
  push:
    branches: [main]
    paths-ignore:
      - "docs/**"
      - "**.md"
      - ".claude/**"
  workflow_dispatch:

# Sesiunile concurente împing des. Fără asta, deploy-urile s-ar aduna la coadă
# și ar construi versiuni deja depășite.
concurrency:
  group: administrativo-staging
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: [self-hosted, administrativo]
    timeout-minutes: 30
    permissions:
      contents: write   # pentru comentariul pe commit

    steps:
      - uses: actions/checkout@v4

      - name: Mediul de staging
        run: cp ~/.secrete/administrativo/.env.staging .env.staging

      - name: Dependențe
        run: pnpm install --frozen-lockfile

      - name: Poarta — verify
        id: verify
        run: pnpm verify 2>&1 | tee /tmp/verify.log

      - name: Poarta — migrări pe baza de staging
        id: migrari
        env:
          ADM_MEDIU: staging
        run: ./administrativo.sh db:migrate 2>&1 | tee /tmp/migrari.log

      - name: Deploy
        id: deploy
        env:
          ADM_MEDIU: staging
        run: ./administrativo.sh stack:deploy 2>&1 | tee /tmp/deploy.log

      - name: Curățenie
        if: always()
        run: ./administrativo.sh curata 5

      - name: Starea, pe pagina de stare
        if: always()
        run: |
          ./administrativo.sh stare:scrie \
            "${{ job.status }}" "${{ github.sha }}" \
            "${{ steps.verify.outcome }}/${{ steps.migrari.outcome }}/${{ steps.deploy.outcome }}"

      - name: Rezumat
        if: always()
        env:
          # Scriptul citește `JOB_STATUS`. GitHub NU îl expune automat ca
          # variabilă de mediu — `job.status` există doar în context de expresie.
          JOB_STATUS: ${{ job.status }}
        run: bash .github/scripts/rezumat-staging.sh >> "$GITHUB_STEP_SUMMARY"

      - name: Comentariu pe commit
        if: always()
        env:
          GH_TOKEN: ${{ github.token }}
          JOB_STATUS: ${{ job.status }}
        run: |
          gh api "repos/${{ github.repository }}/commits/${{ github.sha }}/comments" \
            -f body="$(bash .github/scripts/rezumat-staging.sh)"
```

- [ ] **Pasul 2: Scrie extractorul de erori**

Creează `.github/scripts/rezumat-staging.sh`:

```bash
#!/usr/bin/env bash
# Transformă log-urile în rezumatul pe care îl citește colegul. Scopul e ca
# primele cinci rânduri să spună ce s-a stricat și unde — fără derulat 4000 de
# linii de log.
set -uo pipefail

stare="${JOB_STATUS:-necunoscut}"
echo "## Staging — \`${GITHUB_SHA:0:8}\`"
echo ""
if [ "$stare" = "success" ]; then
  echo "✅ **Viu la** https://staging.administrativo.ro"
  exit 0
fi
echo "❌ **Nu a ajuns pe staging.** Site-ul a rămas pe versiunea anterioară."
echo ""

# tsc: „src/fis.ts(12,5): error TS2304: …"
if grep -qE '\.tsx?\([0-9]+,[0-9]+\): error' /tmp/verify.log 2>/dev/null; then
  echo "### Erori de tipuri"; echo '```'
  grep -E '\.tsx?\([0-9]+,[0-9]+\): error' /tmp/verify.log | head -10
  echo '```'
fi

# eslint: calea pe o linie, apoi „  12:5  error  …"
if grep -qE '^\s+[0-9]+:[0-9]+\s+error' /tmp/verify.log 2>/dev/null; then
  echo "### Erori de lint"; echo '```'
  grep -B3 -E '^\s+[0-9]+:[0-9]+\s+error' /tmp/verify.log | head -15
  echo '```'
fi

# vitest
if grep -qE '(FAIL|✗|×)' /tmp/verify.log 2>/dev/null; then
  echo "### Teste picate"; echo '```'
  grep -E '(FAIL|✗|×)' /tmp/verify.log | head -10
  echo '```'
fi

# psql: „psql:supabase/migrations/0130_x.sql:42: ERROR: …"
if [ -f /tmp/migrari.log ] && grep -q 'ERROR:' /tmp/migrari.log; then
  echo "### Migrarea a picat"; echo '```'
  grep -B2 -A2 'ERROR:' /tmp/migrari.log | head -20
  echo '```'
fi

if [ -f /tmp/deploy.log ] && grep -qiE 'error|eșuat|failed' /tmp/deploy.log; then
  echo "### Deploy"; echo '```'
  tail -25 /tmp/deploy.log
  echo '```'
fi
```

- [ ] **Pasul 3: Probează pe gol**

Împinge o schimbare inofensivă în `src/` și urmărește rularea. Așteptat: verde,
staging actualizat.

- [ ] **Pasul 4: Probează pe roșu**

Într-o ramură de unică folosință, introdu intenționat o eroare de tipuri și
declanșează manual. Așteptat: rularea pică la `verify`, rezumatul arată linia
`fișier(linie,coloană): error TS…`, staging rămâne pe versiunea veche, iar
comentariul apare pe commit.

- [ ] **Pasul 5: Comite**

```bash
git add -- .github/workflows/staging.yml .github/scripts/rezumat-staging.sh
git commit --only -m "feat(ci): deploy staging din main, cu erorile aduse înapoi" \
  -- .github/workflows/staging.yml .github/scripts/rezumat-staging.sh
```

---

## Sarcina 10: Santinela de stare

**Fișiere:**
- Creează: `deploy/stare-stack.yml`, `deploy/stare/index.html`, `ops/09-stare.sh`

**De ce un stack separat, nu un serviciu în stack-ul de staging:** momentul în
care ai nevoie de pagina de stare e exact momentul în care aplicația nu pornește
— sau în care deploy-ul nici n-a început, fiindcă `verify` a picat. O santinelă
în același stack ar fi rotită de același rolling update. Una separată nu e
atinsă de nimic.

- [ ] **Pasul 1: Stack-ul santinelei**

```yaml
# Santinela stării de deploy pentru staging. Deployată O SINGURĂ DATĂ, complet
# independent de ciclul de deploy al aplicației — de asta poate raporta un
# deploy eșuat.
services:
  stare:
    image: nginx:alpine
    volumes:
      - /home/miro/.stare-staging:/usr/share/nginx/html:ro
    networks:
      - strawboss-net
    deploy:
      replicas: 1
      resources:
        limits:
          memory: 32M

networks:
  strawboss-net:
    external: true
```

- [ ] **Pasul 2: Comanda care scrie starea**

Creează `ops/09-stare.sh`:

```bash
# @cmd stare:scrie "Scrie starea ultimei încercări de deploy [stare] [sha] [pași]"
cmd_stare__scrie() {
  local stare="${1:-necunoscut}" sha="${2:-necunoscut}" pasi="${3:-}"
  local dir="${ADM_STARE_DIR:-$HOME/.stare-staging}"
  mkdir -p "$dir"

  local culoare text
  case "$stare" in
    success) culoare="#0a7"; text="a ajuns pe staging" ;;
    *)       culoare="#c33"; text="NU a ajuns — staging e pe versiunea anterioară" ;;
  esac

  cat > "$dir/index.html" <<HTML
<!doctype html><meta charset="utf-8"><title>Staging — stare</title>
<style>body{font:15px system-ui;margin:3rem auto;max-width:40rem;color:#222}
.p{color:${culoare};font-weight:600}code{background:#f4f4f4;padding:.1em .3em}</style>
<h1>Administrativo — staging</h1>
<p class="p">${sha:0:8} ${text}.</p>
<p>Pași (verify/migrări/deploy): <code>${pasi}</code></p>
<p>Ultima încercare: $(date '+%Y-%m-%d %H:%M:%S %Z')</p>
<p><a href="https://github.com/miroslav43/ERP/commit/${sha}">commit-ul</a></p>
HTML

  printf '{"stare":"%s","sha":"%s","pasi":"%s","cand":"%s"}\n' \
    "$stare" "$sha" "$pasi" "$(date -Iseconds)" > "$dir/stare.json"
  _ok "stare scrisă" "$dir"
}
```

- [ ] **Pasul 3: Ruta în vhost-ul de staging**

În `deploy/nginx/32-staging.administrativo.ro.conf`, înaintea lui `location /`:

```nginx
    # Pagina de stare e servită de un container SEPARAT, care rămâne în picioare
    # când aplicația nu pornește. Fără autentificare: e exact pagina de care ai
    # nevoie când nu poți intra.
    location /_stare {
        auth_basic off;
        set $s stare:80;
        proxy_pass http://$s/;
    }
```

- [ ] **Pasul 4: Deployează santinela**

```bash
mkdir -p ~/.stare-staging
./administrativo.sh stare:scrie necunoscut 0000000 "niciun deploy încă"
docker stack deploy -c deploy/stare-stack.yml --resolve-image never administrativo-stare
ADM_MEDIU=staging ./administrativo.sh nginx:vhost
```

- [ ] **Pasul 5: Verifică**

```bash
curl -s https://staging.administrativo.ro/_stare | head -5
```

Așteptat: HTML-ul, **fără** să ceară parolă.

- [ ] **Pasul 6: Verifică ce contează — că raportează un eșec**

Declanșează manual workflow-ul pe un commit cu o eroare de tipuri. Așteptat:
`/_stare` arată roșu, cu sha-ul și `failure` la pasul `verify`, în timp ce
`https://staging.administrativo.ro` servește liniștit versiunea anterioară.

- [ ] **Pasul 7: Comite**

```bash
git add -- deploy/stare-stack.yml ops/09-stare.sh \
           deploy/nginx/32-staging.administrativo.ro.conf
git commit --only -m "feat(staging): santinelă de stare, vie când aplicația nu e" \
  -- deploy/stare-stack.yml ops/09-stare.sh deploy/nginx/32-staging.administrativo.ro.conf
```

---

## Ordinea și ce se poate livra separat

```
 1 ─ 2 ─ 3 ─────────────┐
                        ├─ 7 ─ 9 ─ 10
 5 ─ 6 ─────────────────┘     │
                          8 ──┘
 4  (independentă, livrabilă prima)
```

Sarcina 4 nu depinde de nimic și repară o problemă care există deja în producție
— dacă discul presează, se livrează prima. Sarcina 7 e blocată pe credențialele
bazei; 1-6 și 8-9 pot merge înainte fără ea.
