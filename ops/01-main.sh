#!/usr/bin/env bash
# ============================================================================
# ops/01-main.sh — ciclul de viață: setup / dev / prod / stop
# ============================================================================

# @section "Principale"

# @cmd setup "Prima instalare: verifică unelte, dependențe, .env"
cmd_setup() {
  header "Instalare Administrativo"
  require_cmd node
  require_cmd docker

  local nodev; nodev=$(node -v | sed 's/^v//' | cut -d. -f1)
  if [ "$nodev" -lt 20 ]; then
    error "node $(node -v) — Next.js 16 cere cel puțin 20."
    exit 1
  fi
  _ok "node" "$(node -v)"

  # pnpm 9 moare pe pnpm-workspace.yaml-ul acestui repo („packages field missing
  # or empty"), fiindcă fișierul conține doar setări, fără cheia `packages:`.
  # Formatul cere pnpm 10, iar `packageManager` fixează 10.33.0.
  if ! command -v pnpm &>/dev/null; then
    warn "pnpm lipsește — îl activez prin corepack."
    corepack enable && corepack prepare pnpm@10.33.0 --activate
  fi
  local pnpmv; pnpmv=$(pnpm -v 2>/dev/null || echo "0.0.0")
  if [ "${pnpmv%%.*}" -lt 10 ]; then
    warn "pnpm $pnpmv e prea vechi pentru acest repo — activez 10.33.0."
    corepack prepare pnpm@10.33.0 --activate
    pnpmv=$(pnpm -v)
  fi
  _ok "pnpm" "$pnpmv"

  if [ ! -f "$ADMINISTRATIVO_ROOT/.env.local" ]; then
    warn ".env.local lipsește — copiez din .env.example (trebuie completat)."
    cp "$ADMINISTRATIVO_ROOT/.env.example" "$ADMINISTRATIVO_ROOT/.env.local"
  fi
  _ok ".env.local" "prezent"

  info "Instalez dependențele..."
  pnpm install
  success "Dependențe instalate."

  echo ""
  success "Gata. ${BOLD}./administrativo.sh dev${NC} pentru dezvoltare locală."
  echo -e "  ${DIM}Migrările NU se aplică automat — vezi ./administrativo.sh db:migrate.${NC}"
}

# @cmd dev "Pornește serverul de dezvoltare (localhost:3000)"
cmd_dev() {
  header "Dezvoltare"
  require_cmd pnpm
  if [ ! -d "$ADMINISTRATIVO_ROOT/node_modules" ]; then
    warn "node_modules lipsește — rulez întâi install."
    pnpm install
  fi
  _kill_port 3000
  echo ""
  echo -e "  ${CYAN}┌────────────────────────────────────────┐${NC}"
  echo -e "  ${CYAN}│${NC}  ${BOLD}Aplicație${NC}   http://localhost:3000   ${CYAN}│${NC}"
  echo -e "  ${CYAN}└────────────────────────────────────────┘${NC}"
  echo ""
  pnpm dev
}

# @cmd prod "Build + deploy rolling în producție (Swarm + nginx partajat)"
cmd_prod() {
  header "Producție — https://${ADM_DOMAIN}"
  require_cmd docker

  # stack:deploy face tot lanțul: încarcă și validează mediul, verifică Swarm-ul
  # și overlay-ul, construiește imaginea taguită și aplică rolling update-ul.
  cmd_stack__deploy

  # Edge-ul partajat NU se recreează niciodată la un deploy normal. nginx-ul ăsta
  # servește toate cele ~9 domenii de pe VM; un `docker compose up -d nginx` le-ar
  # face pe toate să clipească pentru a repune în funcțiune un singur site.
  if ! docker ps --format '{{.Names}}' | grep -q "^${ADM_NGINX}$"; then
    error "${ADM_NGINX} nu rulează — edge-ul partajat e jos, ceea ce afectează TOATE site-urile."
    error "Nu îl pornesc automat. Verifică: cd ${ADM_STRAWBOSS_ROOT} && docker compose ps"
    exit 1
  fi
  _infol "nginx partajat" "rulează — lăsat neatins"

  if ! _vhost_points_to_app; then
    warn "vhost-ul ${ADM_VHOST} nu trimite încă spre ${ADM_SERVICE}."
    echo -e "     ${DIM}Rulează: ./administrativo.sh nginx:vhost${NC}"
  fi

  echo ""
  success "Producția e activă la ${BOLD}https://${ADM_DOMAIN}${NC}"
  info "Verifică rollout-ul: ${BOLD}./administrativo.sh stack:status${NC}"
}

# @cmd stop "Oprește stack-ul de producție (nginx partajat rămâne pornit)"
cmd_stop() {
  header "Oprire Administrativo"
  require_cmd docker

  _kill_port 3000

  if _stack_exists; then
    # Doar stack-ul aplicației. nginx + certbot și celelalte site-uri de pe VM
    # rămân neatinse intenționat — un `docker compose down` aici ar scoate din
    # aer toate domeniile de pe mașină.
    info "Șterg stack-ul Swarm '${ADM_STACK}' (edge-ul partajat rămâne)..."
    docker stack rm "$ADM_STACK"
    success "Stack oprit. Site-ul va da 502 până la următorul deploy."
  else
    _infol "stack ${ADM_STACK}" "nu rulează"
  fi
}
