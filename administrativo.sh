#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# administrativo.sh — centrul de comandă al aplicației Administrativo (ERP)
#
# Router subțire: sursează ops/_lib.sh + ops/*.sh, apoi dispecerizează comanda
# cerută către funcția cmd_*() corespunzătoare.
#
# Cum adaugi o comandă nouă:
#   1. Deschide (sau creează) ops/<categorie>.sh
#   2. Adaugă o funcție cu adnotarea @cmd:
#        # @cmd comanda-mea "Descrierea afișată în help"
#        cmd_comanda__mea() { ... }
#   3. Gata — apare automat în help și în rutare, fără nicio înregistrare.
#
# Convenție de nume: comanda "foo:bar-baz" → funcția cmd_foo__bar__baz()
#                    („:" și „-" devin „__")
#
# DE CE ops/ ȘI NU scripts/
# scripts/ conține deja utilitare ale proiectului (reset-test-db.sh, gen-types.mjs,
# demo/seed-demo.mjs). Un glob peste scripts/*.sh le-ar SURSA — adică le-ar
# EXECUTA — la fiecare invocare. ops/ ține fișierele de comenzi separate.
# ============================================================================

export ADMINISTRATIVO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ADMINISTRATIVO_ROOT"

# shellcheck source=ops/_lib.sh
source "$ADMINISTRATIVO_ROOT/ops/_lib.sh"

for _f in "$ADMINISTRATIVO_ROOT"/ops/[!_]*.sh; do
  # shellcheck disable=SC1090
  source "$_f"
done
unset _f

# ---------------------------------------------------------------------------
# Help generat automat din adnotările @cmd / @section
# ---------------------------------------------------------------------------
_auto_help() {
  echo ""
  echo -e "  ${BOLD}${GREEN}"
  echo '     _       _           _       _     _             _   _'
  echo '    /_\   __| |_ __ ___ (_)_ __ (_)___| |_ _ __ __ _| |_(_)_   ______'
  echo '   //_\\ / _` | `_ ` _ \| | `_ \| / __| __| `__/ _` | __| \ \ / / _ \'
  echo '  /  _  \ (_| | | | | | | | | | | \__ \ |_| | | (_| | |_| |\ V / (_) |'
  echo '  \_/ \_/\__,_|_| |_| |_|_|_| |_|_|___/\__|_|  \__,_|\__|_| \_/ \___/'
  echo -e "  ${NC}"
  echo -e "  ${DIM}ERP — centru de comandă  ${NC}${GRAY}·${NC}${DIM}  https://infomeditatii.ro${NC}"
  echo ""

  local current_section=""
  for f in "$ADMINISTRATIVO_ROOT"/ops/[!_]*.sh; do
    while IFS= read -r line; do
      if [[ "$line" =~ ^#[[:space:]]*@section[[:space:]]+\"(.+)\" ]]; then
        current_section="${BASH_REMATCH[1]}"
        echo -e "  ${BOLD}${WHITE}${current_section}${NC}"
      elif [[ "$line" =~ ^#[[:space:]]*@cmd[[:space:]]+([^[:space:]]+)[[:space:]]+\"(.+)\" ]]; then
        printf "    ${CYAN}%-24s${NC} %s\\n" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
      fi
    done < "$f"
    if [ -n "$current_section" ]; then echo ""; current_section=""; fi
  done

  divider
  echo ""
  echo -e "  ${DIM}Prima dată:  ${NC}${BOLD}./administrativo.sh setup${NC}${DIM}   apoi  ${NC}${BOLD}./administrativo.sh dev${NC}"
  echo -e "  ${DIM}Producție:   ${NC}${BOLD}./administrativo.sh prod${NC}${DIM}     stare  ${NC}${BOLD}./administrativo.sh status${NC}"
  echo -e "  ${DIM}Probleme:    ${NC}${BOLD}./administrativo.sh doctor${NC}"
  echo ""
}

# ---------------------------------------------------------------------------
# Dispecer
# ---------------------------------------------------------------------------
COMMAND="${1:-help}"
shift 2>/dev/null || true

if [ "$COMMAND" = "help" ] || [ "$COMMAND" = "--help" ] || [ "$COMMAND" = "-h" ]; then
  _auto_help
  exit 0
fi

FUNC_NAME="cmd_$(echo "$COMMAND" | sed 's/[-:]/__/g')"

if declare -f "$FUNC_NAME" &>/dev/null; then
  "$FUNC_NAME" "$@"
else
  error "Comandă necunoscută: ${BOLD}$COMMAND${NC}"
  echo ""
  echo -e "  Rulează ${BOLD}./administrativo.sh help${NC} pentru toate comenzile."
  echo -e "  ${DIM}Sau ./administrativo.sh status pentru un tablou rapid.${NC}"
  exit 1
fi
