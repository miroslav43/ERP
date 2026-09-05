#!/usr/bin/env bash
# ============================================================================
# ops/_lib.sh — bibliotecă partajată: culori, formatare, verificări, mediu.
# Sursat de administrativo.sh înaintea tuturor fișierelor de comenzi.
# Numele începe cu „_", deci globul ops/[!_]*.sh nu îl prinde a doua oară.
# ============================================================================

# ---------------------------------------------------------------------------
# Mediul — SINGURUL buton. Tot ce urmează se derivă din el.
#
# DE CE UN SINGUR BUTON, și nu o variabilă suprascriptibilă per nume: un
# `ADM_DOMAIN` de staging combinat din greșeală cu un `ADM_STACK` de producție ar
# instala vhost-ul de probă peste serviciul viu. Cu un singur comutator,
# combinația aia nu se poate exprima.
#
# Implicit „productie", deci fiecare apel existent se comportă EXACT ca înainte
# de introducerea staging-ului. Poarta care apără asta:
# `bash scripts/checks/medii.sh`.
# ---------------------------------------------------------------------------
ADM_MEDIU="${ADM_MEDIU:-productie}"

case "$ADM_MEDIU" in
  productie)
    ADM_STACK="administrativo"                   # numele stack-ului Swarm
    ADM_SERVICE="administrativo-web"             # cheia serviciului din stack
    ADM_IMAGE="administrativo-web"               # numele imaginii
    ADM_DOMAIN="administrativo.ro"
    ADM_VHOST="30-administrativo.ro.conf"
    ADM_SECRET_PREFIX=""
    ADM_REPLICI=2
    ;;
  staging)
    # Cheia serviciului DIFERĂ, nu doar numele stack-ului. `docker stack deploy`
    # înregistrează pe rețea un alias egal cu CHEIA serviciului, iar
    # `strawboss-net` e partajată de toate site-urile VM-ului: cu aceeași cheie,
    # nginx ar trimite intermitent trafic de producție în staging — care e legat
    # la altă bază de date. Verificat empiric cu `docker service inspect` și
    # `nslookup` pe 2026-09-04.
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

# EXPORT, nu doar `readonly`. `docker stack deploy` interpolează `${VAR}` din
# docker-stack.yml folosind MEDIUL procesului, nu variabilele shell-ului care îl
# lansează. O variabilă neexportată se evaluează la implicitul din `${VAR:-…}`.
#
# Prima rulare reală (2026-09-05, rularea 33955571598) a deployat staging-ul cu:
#   secrete: supabase_service_role_key   ← ale PRODUCȚIEI, nu staging_*
#   replici: 2                            ← implicitul, nu 1
# Cheia `service_role` ocolește complet RLS. Containerul n-a pornit doar fiindcă
# imaginea cerută nu exista — noroc, nu proiectare.
export ADM_IMAGE ADM_SECRET_PREFIX ADM_REPLICI

# ---------------------------------------------------------------------------
# Constante comune tuturor mediilor — nu depind de comutator
# ---------------------------------------------------------------------------
readonly ADM_PORT=3000
readonly ADM_OVERLAY="strawboss-net"             # overlay-ul partajat cu nginx

# Edge-ul partajat al VM-ului. Deservește TOATE cele ~9 site-uri de aici.
readonly ADM_NGINX="strawboss-nginx-1"
readonly ADM_NGINX_CONFD="/srv/apps/Strawboss/nginx/conf.d"
readonly ADM_STRAWBOSS_ROOT="/srv/apps/Strawboss"

# ---------------------------------------------------------------------------
# Detectare OS
# ---------------------------------------------------------------------------
case "$(uname -s)" in
  Darwin*) ADM_OS="macos" ;;
  *)       ADM_OS="linux" ;;
esac

# ---------------------------------------------------------------------------
# Culori & simboluri — dezactivate când ieșirea nu e terminal, ca să nu
# polueze log-uri, pipe-uri sau journalctl cu secvențe ANSI.
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
  MAGENTA='\033[0;35m'; CYAN='\033[0;36m'; WHITE='\033[1;37m'; GRAY='\033[0;90m'
  BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
else
  RED='' GREEN='' YELLOW='' BLUE='' MAGENTA='' CYAN=''
  WHITE='' GRAY='' BOLD='' DIM='' NC=''
fi

# Literale UTF-8: `echo -e` din bash nu interpretează escape-uri \uXXXX.
OK="${GREEN}✓${NC}"; FAIL="${RED}✗${NC}"; WARN_S="${YELLOW}⚠${NC}"
ARROW="${CYAN}▶${NC}"; DOT="${GRAY}•${NC}"

# ---------------------------------------------------------------------------
# Ieșire
# ---------------------------------------------------------------------------
info()    { echo -e "  ${BLUE}●${NC}  $*"; }
success() { echo -e "  ${GREEN}✓${NC}  $*"; }
warn()    { echo -e "  ${YELLOW}⚠${NC}  $*"; }
error()   { echo -e "  ${RED}✗${NC}  $*" >&2; }

header()  { echo ""; echo -e "  ${BOLD}${CYAN}┌── $* ──────────────────────────────────${NC}"; echo ""; }
divider() { echo -e "  ${GRAY}────────────────────────────────────────────────────────${NC}"; }
section() { echo ""; echo -e "  ${BOLD}${WHITE}$*${NC}"; echo ""; }

_ok()    { printf "  ${OK}  %-30s %s\\n" "$1" "${2:-}"; }
_fail()  { printf "  ${FAIL}  %-30s %s\\n" "$1" "${2:-}"; }
_warnl() { printf "  ${WARN_S}  %-30s %s\\n" "$1" "${2:-}"; }
_infol() { printf "  ${DOT}  %-30s %s\\n" "$1" "${2:-}"; }

require_cmd() {
  if ! command -v "$1" &>/dev/null; then
    error "$1 este necesar dar nu e instalat."
    exit 1
  fi
}

# Confirmare explicită pentru operațiuni ireversibile sau care ating alte
# site-uri. Într-un shell neinteractiv răspunde „nu" — un deploy automat nu
# trebuie să poată aplica migrări din greșeală.
confirm() {
  local prompt="$1"
  if [ ! -t 0 ]; then
    warn "Neinteractiv — refuz implicit: $prompt"
    return 1
  fi
  local raspuns
  read -r -p "$(echo -e "  ${YELLOW}?${NC}  ${prompt} [scrie ${BOLD}da${NC} pentru a continua]: ")" raspuns
  [ "$raspuns" = "da" ]
}

# ---------------------------------------------------------------------------
# Utilitare
# ---------------------------------------------------------------------------
_human_size() {
  echo "${1:-0}" | awk '{
    if      ($1 >= 1073741824) printf "%.1f GB", $1/1073741824
    else if ($1 >= 1048576)    printf "%.0f MB", $1/1048576
    else if ($1 >= 1024)       printf "%.0f KB", $1/1024
    else                       printf "%d B", $1
  }'
}

_dir_bytes() { du -sb "$1" 2>/dev/null | awk '{print $1}' || echo 0; }

_port_open() {
  local port="$1"
  if command -v ss &>/dev/null; then
    ss -tlnH 2>/dev/null | grep -qE "[:.]${port}[[:space:]]" && return 0
  fi
  if command -v lsof &>/dev/null; then
    lsof -iTCP:"$port" -sTCP:LISTEN -P -n &>/dev/null && return 0
  fi
  return 1
}

_kill_port() {
  local port="$1" pids
  # `|| true`: lsof iese cu 1 când nu găsește nimic, iar sub `set -e` asta ar
  # opri scriptul exact în cazul normal (portul e liber).
  pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs -r kill -9 2>/dev/null || true
    info "Am eliberat portul $port."
  fi
}

_time_ago() {
  local ts="$1" now delta
  now=$(date +%s); delta=$(( now - ts ))
  if   [ "$delta" -lt 60 ]    ; then echo "acum ${delta}s"
  elif [ "$delta" -lt 3600 ]  ; then echo "acum $(( delta / 60 ))m"
  elif [ "$delta" -lt 86400 ] ; then echo "acum $(( delta / 3600 ))h"
  else                               echo "acum $(( delta / 86400 ))z"
  fi
}

_git_sha() { git -C "$ADMINISTRATIVO_ROOT" rev-parse --short HEAD 2>/dev/null || echo latest; }

# ---------------------------------------------------------------------------
# Mediu
# ---------------------------------------------------------------------------
# Cele opt variabile fără de care `next build` nu pornește: src/config/env.ts
# validează cu Zod la IMPORT de modul, nu la primul request. Regula e voită —
# o configurație greșită trebuie să oprească aplicația la boot, nu să producă o
# eroare obscură la primul utilizator — dar înseamnă că toate trebuie să existe
# și la BUILD, nu doar la runtime.
readonly ADM_REQUIRED_ENV=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  NEXT_PUBLIC_APP_URL
  SUPABASE_SERVICE_ROLE_KEY
  HR_ENCRYPTION_KEYS
  HR_ENCRYPTION_ACTIVE_KEY
  HR_HASH_KEY
  TENANT_COOKIE_SECRET
)

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

_load_env() {
  local f; f="$(_env_file)"
  if [ ! -f "$f" ]; then
    error "Lipsește $(basename "$f") pentru mediul ${ADM_MEDIU}."
    echo -e "     ${DIM}Căutat la: ${f}${NC}"
    echo -e "     ${DIM}HR_ENCRYPTION_KEYS și HR_HASH_KEY trebuie să fie EXACT cele din dev.${NC}"
    exit 1
  fi
  # `set -a` exportă tot ce se definește până la `set +a`, ca `docker stack
  # deploy` să poată interpola ${VAR} din docker-stack.yml.
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
}

_validate_prod_env() {
  local missing=()
  for var in "${ADM_REQUIRED_ENV[@]}"; do
    [ -z "${!var:-}" ] && missing+=("$var")
  done
  if [ ${#missing[@]} -gt 0 ]; then
    error "Variabile lipsă din .env.production: ${missing[*]}"
    exit 1
  fi
  # Domeniul e copt în bundle-ul de client la build; o nepotrivire aici înseamnă
  # că imaginea trimite utilizatorii pe alt host după login.
  case "${NEXT_PUBLIC_APP_URL}" in
    https://${ADM_DOMAIN}|https://${ADM_DOMAIN}/) ;;
    *) warn "NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} — nu e https://${ADM_DOMAIN}."
       warn "Valoarea se coace în bundle la build: redirecturile de login o vor folosi pe asta." ;;
  esac

  # Secretele de timer NU intră în ADM_REQUIRED_ENV: aplicația pornește și
  # funcționează fără ele, doar că ramura pe care o păzesc tace. Ar fi însă
  # greșit să tacă și scriptul — lipsa lor e INDISTINCTĂ de „rută inexistentă"
  # (ruta răspunde 404 la un secret gol), iar asta a costat deja o depanare.
  for var in PUSH_CRON_SECRET REGES_CRON_SECRET; do
    if [ -z "${!var:-}" ]; then
      warn "${var} e gol în .env.production — ramura păzită de el e OPRITĂ."
      case "$var" in
        PUSH_CRON_SECRET)
          warn "  Coada push_livrari nu se golește: nicio notificare pe telefoane." ;;
        REGES_CRON_SECRET)
          warn "  Ciclul de reconciliere REGES-Online nu pornește." ;;
      esac
      warn "  Vezi .env.production.example — aceeași valoare în TREI locuri."
    fi
  done
}

# ---------------------------------------------------------------------------
# Swarm
# ---------------------------------------------------------------------------
# Idempotent — se poate rula la fiecare deploy.
_ensure_swarm() {
  if [ "$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null)" != "active" ]; then
    error "Nodul nu e manager Swarm. StrawBoss l-a inițializat deja pe acest VM;"
    error "dacă nu mai e activ, ceva major s-a schimbat — verifică înainte de a reinițializa."
    exit 1
  fi
  if ! docker network inspect "$ADM_OVERLAY" >/dev/null 2>&1; then
    error "Overlay-ul '$ADM_OVERLAY' nu există. E creat și folosit de StrawBoss;"
    error "absența lui înseamnă că edge-ul partajat e stricat. Nu îl recreez automat."
    exit 1
  fi
  # nginx trebuie să fie pe overlay ca să rezolve numele serviciului. StrawBoss
  # îl declară în docker-compose.yml, deci în mod normal e deja atașat.
  if docker ps --format '{{.Names}}' | grep -q "^${ADM_NGINX}$" \
     && ! docker inspect "$ADM_NGINX" \
          --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' \
          | grep -q "$ADM_OVERLAY"; then
    warn "nginx nu e atașat la '$ADM_OVERLAY' — îl atașez (fără repornire)."
    docker network connect "$ADM_OVERLAY" "$ADM_NGINX" || true
  fi
}

_stack_exists()   { docker stack ls --format '{{.Name}}' 2>/dev/null | grep -q "^${ADM_STACK}$"; }
_service_full()   { echo "${ADM_STACK}_${ADM_SERVICE}"; }
_service_exists() { docker service inspect "$(_service_full)" >/dev/null 2>&1; }

# Așteaptă convergența rolling update-ului. Fără asta, `deploy` pare reușit
# instant, iar o replică ce nu trece healthcheck-ul se descoperă abia mai târziu.
_wait_converged() {
  local timeout="${1:-180}" waited=0 state
  info "Aștept convergența (max ${timeout}s)..."
  while [ "$waited" -lt "$timeout" ]; do
    state=$(docker service inspect "$(_service_full)" \
      --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{else}}none{{end}}' 2>/dev/null || echo "?")
    local running desired
    running=$(docker service ls --filter "name=$(_service_full)" --format '{{.Replicas}}' 2>/dev/null | head -1)
    case "$state" in
      completed|none)
        if [ "${running%%/*}" = "${running##*/}" ] && [ -n "$running" ]; then
          # Replici complete NU înseamnă cod nou. Dacă specificația n-a fost
          # schimbată, Swarm nu repornește nimic și raportează fericit 2/2 pe
          # imaginea veche. Singura dovadă onestă e imaginea din spec.
          local activa
          activa=$(docker service inspect "$(_service_full)" \
            --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null | sed 's/@sha256.*//')
          if [ -n "${ADM_IMAGE_TAG:-}" ] && [ "$activa" != "${ADM_IMAGE}:${ADM_IMAGE_TAG}" ]; then
            echo ""
            error "Serviciul rulează '$activa', dar am construit '${ADM_IMAGE}:${ADM_IMAGE_TAG}'."
            error "Swarm nu a preluat imaginea nouă — deploy-ul NU a avut efect."
            return 1
          fi
          echo ""
          success "Convergent: $running replici active pe $activa"
          return 0
        fi ;;
      rollback_completed)
        error "Deploy eșuat — Swarm a dat ROLLBACK automat la imaginea anterioară."
        error "Vezi de ce: docker service ps $(_service_full) --no-trunc"
        return 1 ;;
      paused)
        error "Update-ul e blocat (paused): replica nouă nu trece healthcheck-ul."
        return 1 ;;
    esac
    sleep 3; waited=$(( waited + 3 ))
    printf "\r  ${DOT}  %ss — %s (%s)          " "$waited" "${running:-?}" "$state"
  done
  echo ""
  warn "Nu a convers în ${timeout}s. Verifică: ./administrativo.sh stack:status"
  return 1
}
