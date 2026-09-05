#!/usr/bin/env bash
# ============================================================================
# ops/09-stare.sh — pagina de stare a deploy-urilor de staging.
#
# DE CE EXISTĂ: la orice eșec, subdomeniul arată perfect și NIMIC nu spune că
# push-ul colegului n-a ajuns. Dacă `pnpm verify` pică, deploy-ul nici nu
# pornește; dacă `next build` pică, la fel; iar dacă containerul nu devine
# sănătos, `docker-stack.yml` face `failure_action: rollback` și subdomeniul
# revine singur la versiunea anterioară. În toate trei cazurile, tăcere.
#
# Starea e servită de un container SEPARAT (deploy/stare-stack.yml), nu de
# aplicație: momentul în care ai nevoie de ea e exact momentul în care aplicația
# nu pornește.
#
# Cele trei comenzi se cheamă din .github/workflows/staging.yml. Logica e în
# scripts/stare/stare.mjs — JSON și HTML se scriu mult mai limpede în node decât
# într-un heredoc de bash.
# ============================================================================

_stare_mjs() { node "$ADMINISTRATIVO_ROOT/scripts/stare/stare.mjs" "$@"; }

# @cmd stare:incepe "Marchează începutul unei rulări [sha] [mesaj] [autor] [url]"
cmd_stare__incepe() {
  _stare_mjs incepe --sha "${1:-}" --mesaj "${2:-}" --autor "${3:-}" --url "${4:-}"
}

# @cmd stare:pas "Marchează începutul unui pas al rulării [nume]"
cmd_stare__pas() {
  _stare_mjs pas "${1:-pas}"
}

# @cmd stare:termina "Închide rularea curentă [success|failure|cancelled] [imagine]"
cmd_stare__termina() {
  local rezultat="${1:-failure}"
  if [ -n "${2:-}" ]; then
    _stare_mjs termina "$rezultat" --imagine "$2"
  else
    _stare_mjs termina "$rezultat"
  fi
}
