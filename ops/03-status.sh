#!/usr/bin/env bash
# ============================================================================
# ops/03-status.sh — trei unelte de diagnostic, cu roluri distincte:
#   status  → tablou de bord informativ (ce e, unde, de când)
#   health  → verdict pass/fail cu cod de ieșire (pentru scripturi și CI)
#   doctor  → probleme + REPARAȚIA sugerată pentru fiecare
# ============================================================================

# @section "Stare & Diagnostic"

# @cmd status "Tablou de bord: cod, imagine, stack, site"
cmd_status() {
  echo ""
  echo -e "  ${BOLD}${CYAN}▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄${NC}"
  echo -e "  ${BOLD}${WHITE}  ADMINISTRATIVO  ${GRAY}tablou de bord${NC}"
  echo -e "  ${BOLD}${CYAN}▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀${NC}"

  section "Cod"
  local branch dirty
  branch=$(git -C "$ADMINISTRATIVO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
  dirty=$(git -C "$ADMINISTRATIVO_ROOT" status --porcelain 2>/dev/null | wc -l)
  _infol "ramură" "$branch @ $(_git_sha)"
  if [ "$dirty" -gt 0 ]; then _warnl "modificări" "$dirty fișiere necomise"
  else _ok "arbore" "curat"; fi
  [ -d "$ADMINISTRATIVO_ROOT/node_modules" ] \
    && _ok "node_modules" "$(_human_size "$(_dir_bytes "$ADMINISTRATIVO_ROOT/node_modules")")" \
    || _warnl "node_modules" "lipsește (./administrativo.sh install)"

  section "Configurație"
  if [ -f "$(_env_file)" ]; then
    local perms; perms=$(stat -c '%a' "$(_env_file)")
    if [ "$perms" = "600" ]; then _ok ".env.production" "mod $perms"
    else _warnl ".env.production" "mod $perms — ar trebui 600"; fi
  else
    _fail ".env.production" "LIPSEȘTE"
  fi

  section "Imagine"
  if docker images "${ADM_IMAGE}:latest" --format '{{.ID}}' 2>/dev/null | grep -q .; then
    docker images "$ADM_IMAGE" --format '  {{printf "%-14s" .Tag}} {{printf "%-9s" .Size}} {{.CreatedSince}}' | head -4
  else
    _warnl "imagine" "neconstruită (./administrativo.sh docker:build)"
  fi

  section "Stack Swarm"
  if _stack_exists; then
    local reps
    reps=$(docker service ls --filter "name=$(_service_full)" --format '{{.Replicas}}' 2>/dev/null | head -1)
    if [ "${reps%%/*}" = "${reps##*/}" ]; then _ok "replici" "$reps"; else _warnl "replici" "$reps"; fi
    _infol "imagine activă" "$(docker service inspect "$(_service_full)" \
      --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null | sed 's/@sha256.*//')"
  else
    _warnl "stack" "nedeployat"
  fi

  section "Edge partajat"
  if docker ps --format '{{.Names}}' | grep -q "^${ADM_NGINX}$"; then
    _ok "nginx" "$(docker ps --filter "name=^${ADM_NGINX}$" --format '{{.Status}}')"
    _vhost_points_to_app \
      && _ok "vhost ${ADM_DOMAIN}" "→ ${ADM_SERVICE}:${ADM_PORT}" \
      || _warnl "vhost ${ADM_DOMAIN}" "NU trimite spre aplicație"
  else
    _fail "nginx" "nu rulează — toate site-urile sunt jos"
  fi

  section "Site public"
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' -m 10 "https://${ADM_DOMAIN}/" 2>/dev/null || echo "000")
  case "$code" in
    200|307|308) _ok "https://${ADM_DOMAIN}" "HTTP $code" ;;
    502|503)     _fail "https://${ADM_DOMAIN}" "HTTP $code — nginx OK, aplicația jos" ;;
    *)           _warnl "https://${ADM_DOMAIN}" "HTTP $code" ;;
  esac
  echo ""
}

# @cmd health "Verificări pass/fail (cod de ieșire nenul la eșec)"
cmd_health() {
  header "Verificare de sănătate"
  local pass=0 fail=0 total=0
  _check() {
    total=$(( total + 1 )); local label="$1"; shift
    if "$@" &>/dev/null; then _ok "$label"; pass=$(( pass + 1 ))
    else _fail "$label"; fail=$(( fail + 1 )); fi
  }

  section "Unelte"
  _check "docker disponibil"      command -v docker
  _check "docker răspunde"        docker info
  _check "node ≥ 20"              bash -c '[ "$(node -v | sed "s/^v//" | cut -d. -f1)" -ge 20 ]'

  section "Configurație"
  _check ".env.production există"  test -f "$(_env_file)"
  _check "Dockerfile există"       test -f "$ADMINISTRATIVO_ROOT/Dockerfile"
  _check "docker-stack.yml există" test -f "$ADMINISTRATIVO_ROOT/docker-stack.yml"

  section "Infrastructură"
  _check "nod Swarm activ"    bash -c '[ "$(docker info --format "{{.Swarm.LocalNodeState}}")" = "active" ]'
  _check "overlay ${ADM_OVERLAY}"  docker network inspect "$ADM_OVERLAY"
  _check "nginx rulează"      bash -c "docker ps --format '{{.Names}}' | grep -q '^${ADM_NGINX}\$'"
  _check "montare conf.d live" _nginx_mount_live
  _check "certificat ${ADM_DOMAIN}" docker exec "$ADM_NGINX" test -f "/etc/letsencrypt/live/${ADM_DOMAIN}/fullchain.pem"

  section "Aplicație"
  _check "stack deployat"     _stack_exists
  _check "replici complete"   bash -c 'r=$(docker service ls --filter "name='"$(_service_full)"'" --format "{{.Replicas}}" | head -1); [ -n "$r" ] && [ "${r%%/*}" = "${r##*/}" ]'
  _check "healthz prin overlay" bash -c "[ \"\$(docker run --rm --network $ADM_OVERLAY curlimages/curl:latest -sS -m 10 -o /dev/null -w '%{http_code}' http://${ADM_SERVICE}:${ADM_PORT}/healthz 2>/dev/null)\" = 200 ]"

  echo ""; divider; echo ""
  if [ "$fail" -eq 0 ]; then
    echo -e "  ${GREEN}${BOLD}✓  Toate cele $total verificări au trecut${NC}"; echo ""
    return 0
  else
    echo -e "  ${RED}${BOLD}✗  $fail/$total verificări au eșuat${NC}  ${DIM}($pass trecute)${NC}"; echo ""
    return 1
  fi
}

# @cmd doctor "Diagnostic cu reparația sugerată pentru fiecare problemă"
cmd_doctor() {
  header "Doctor"
  local issues=0
  _diagnose() {
    local label="$1" check="$2" fix="$3"
    printf "  ${ARROW}  %-34s" "$label"
    if eval "$check" &>/dev/null; then echo -e "${GREEN}ok${NC}"
    else
      echo -e "${RED}problemă${NC}"
      echo -e "     ${YELLOW}Reparație:${NC} $fix"
      issues=$(( issues + 1 ))
    fi
  }

  _diagnose ".env.production" \
    "test -f '$(_env_file)'" \
    "copiază .env.production.example și completează cheile din dev"
  _diagnose "permisiuni .env.production" \
    "[ \"\$(stat -c '%a' '$(_env_file)' 2>/dev/null)\" = 600 ]" \
    "chmod 600 .env.production"
  _diagnose "node_modules" \
    "test -d '$ADMINISTRATIVO_ROOT/node_modules'" \
    "./administrativo.sh install"
  _diagnose "pnpm ≥ 10" \
    "[ \"\$(pnpm -v 2>/dev/null | cut -d. -f1)\" -ge 10 ]" \
    "corepack prepare pnpm@10.33.0 --activate  ${DIM}(pnpm 9 nu citește acest pnpm-workspace.yaml)${NC}"
  _diagnose "daemon docker" \
    "docker info" \
    "sudo systemctl start docker"
  _diagnose "nod Swarm" \
    "[ \"\$(docker info --format '{{.Swarm.LocalNodeState}}')\" = active ]" \
    "verifică de ce s-a dezactivat Swarm — StrawBoss depinde de el"
  _diagnose "overlay ${ADM_OVERLAY}" \
    "docker network inspect $ADM_OVERLAY" \
    "overlay-ul e al StrawBoss; absența lui înseamnă edge stricat"
  _diagnose "imagine construită" \
    "docker images ${ADM_IMAGE}:latest --format '{{.ID}}' | grep -q ." \
    "./administrativo.sh docker:build"
  _diagnose "stack deployat" \
    "_stack_exists" \
    "./administrativo.sh stack:deploy"
  _diagnose "nginx partajat" \
    "docker ps --format '{{.Names}}' | grep -q '^${ADM_NGINX}\$'" \
    "cd ${ADM_STRAWBOSS_ROOT} && docker compose up -d nginx  ${DIM}(afectează TOATE site-urile)${NC}"
  _diagnose "montare conf.d" \
    "_nginx_mount_live" \
    "docker restart ${ADM_NGINX}  ${DIM}(verifică întâi că toate certificatele există)${NC}"
  _diagnose "vhost → aplicație" \
    "_vhost_points_to_app" \
    "./administrativo.sh nginx:vhost"

  # Spațiu pe disc. Un VM cu Docker rămas fără disc nu doboară doar aplicația
  # noastră: cade tot ce scrie pe `/`, adică toate cele ~9 site-uri de aici.
  #
  # Pragul de avertizare la 80% e adăugat fiindcă între 82% și 90% nu spunea
  # nimeni nimic, iar fiecare deploy lasă ~125 MB pe care nu-i ștergea nimeni.
  # `docker image prune -f` de dinainte ștergea doar imaginile fără tag — zero,
  # măsurat — deci reparația sugerată nu repara nimic. `curata` șterge tagurile
  # vechi și cache-ul de build, care sunt tot spațiul.
  local use; use=$(df --output=pcent / | tail -1 | tr -dc '0-9')
  printf "  ${ARROW}  %-34s" "spațiu pe disc"
  if [ "$use" -lt 80 ]; then
    echo -e "${GREEN}ok${NC} ${DIM}(${use}% folosit)${NC}"
  elif [ "$use" -lt 90 ]; then
    echo -e "${YELLOW}atenție${NC} ${DIM}(${use}% folosit)${NC}"
    echo -e "     ${YELLOW}Recomandat:${NC} ./administrativo.sh curata  ${DIM}(întoarce zeci de GB)${NC}"
  else
    echo -e "${RED}problemă${NC} ${DIM}(${use}% folosit)${NC}"
    echo -e "     ${YELLOW}Reparație:${NC} ./administrativo.sh curata"
    issues=$(( issues + 1 ))
  fi

  echo ""; divider; echo ""
  if [ "$issues" -eq 0 ]; then echo -e "  ${GREEN}${BOLD}✓  Nicio problemă${NC}"
  else echo -e "  ${YELLOW}${BOLD}⚠  $issues probleme de rezolvat${NC}"; fi
  echo ""
}

# @cmd info "Sumar al arhitecturii și al fluxului de deploy"
cmd_info() {
  header "Arhitectură"
  cat <<INFO
  ${BOLD}Aplicație${NC}     Next.js 16 App Router (Server Actions), fără backend separat.
                „Backend"-ul e Supabase Cloud: Postgres + Auth + PostgREST + Storage.

  ${BOLD}Două niveluri${NC}
    Edge   ${DIM}(partajat de ~9 site-uri)${NC}  Compose  ${ADM_STRAWBOSS_ROOT}
           ${ADM_NGINX} + certbot — singurele legate pe 80/443
    App    ${DIM}(doar ERP)${NC}                Swarm    ${ADMINISTRATIVO_ROOT}
           stack ${ADM_STACK} → ${ADM_SERVICE} ×2 replici

  ${BOLD}Traseu request${NC}
    Cloudflare → 62.171.154.194:443 → ${ADM_NGINX}
      → overlay ${ADM_OVERLAY} → ${ADM_SERVICE}:${ADM_PORT} → Supabase Cloud

  ${BOLD}Deploy${NC}       ./administrativo.sh prod
                build (tag = git sha) → rolling start-first → healthcheck → rollback la eșec
  ${BOLD}Rollback${NC}     ./administrativo.sh stack:rollback     ${DIM}(doar aplicația)${NC}
                ./administrativo.sh nginx:restore      ${DIM}(revine la Eduvora)${NC}

  ${BOLD}Reguli${NC}       Edge-ul nu se repornește la un deploy normal — ar clipi toate site-urile.
                Migrările nu se aplică automat (bază de producție partajată).
                HR_ENCRYPTION_KEYS nu se rotește: datele existente devin ilizibile.
INFO
  echo ""
}

# @cmd ports "Ce ascultă pe mașină"
cmd_ports() {
  header "Porturi"
  for p in 80 443 3000; do
    _port_open "$p" && _ok "port $p" "ocupat" || _infol "port $p" "liber"
  done
  section "Containere cu porturi publicate"
  docker ps --format '  {{printf "%-34s" .Names}} {{.Ports}}' | grep -v '^\s*$'
}
