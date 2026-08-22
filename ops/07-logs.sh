#!/usr/bin/env bash
# ============================================================================
# ops/07-logs.sh — loguri.
#
# Aplicația scrie pe stdout/stderr, iar Docker le colectează: nu există fișiere
# de log de montat. Un container fără stare e și mai ușor de repornit.
# ============================================================================

# @section "Loguri"

# @cmd logs "Urmărește logurile aplicației [număr-linii]"
cmd_logs() {
  require_cmd docker
  _service_exists || { error "Serviciul nu rulează."; exit 1; }
  docker service logs -f --tail "${1:-100}" "$(_service_full)"
}

# @cmd logs:error "Doar liniile de eroare din ultimele N linii [N]"
cmd_logs__error() {
  require_cmd docker
  _service_exists || { error "Serviciul nu rulează."; exit 1; }
  # `|| true`: grep iese cu 1 când nu găsește nimic, iar sub `set -e` asta ar
  # face comanda să pară eșuată exact în cazul bun (zero erori).
  docker service logs --tail "${1:-500}" "$(_service_full)" 2>&1 \
    | grep -iE 'error|exception|fatal|unhandled|ECONNREFUSED' || {
        success "Nicio eroare în ultimele ${1:-500} linii."
      }
}

# @cmd logs:nginx "Logurile edge-ului partajat, filtrate pe domeniul nostru"
cmd_logs__nginx() {
  require_cmd docker
  docker logs --tail "${1:-200}" "$ADM_NGINX" 2>&1 | grep -i "$ADM_DOMAIN" || {
    info "Nicio linie pentru ${ADM_DOMAIN} în ultimele ${1:-200}."
  }
}
