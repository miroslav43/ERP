#!/usr/bin/env bash
# ============================================================================
# Poarta „producția n-a mișcat".
#
# Invarianta pe care o apără: un apel FĂRĂ `ADM_MEDIU` trebuie să producă exact
# numele de azi. Dacă cineva schimbă implicitul, deploy-ul următor de producție
# ar merge într-un stack greșit — tăcut, fiindcă Swarm ar crea bucuros un stack
# nou în loc să-l actualizeze pe cel viu, iar vhost-ul ar rămâne să arate spre
# serviciul vechi. Site-ul ar da 502 fără ca nimic din lanț să fi eșuat.
#
# Rulare: bash scripts/checks/medii.sh
# ============================================================================
set -uo pipefail

RADACINA="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
esecuri=0

# Citește o variabilă dintr-un shell PROASPĂT. `ops/_lib.sh` face `readonly` pe
# tot ce derivă, deci două verificări în același shell s-ar ciocni la a doua
# sursare.
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
    printf '  ✓ %-10s %-18s = %s\n' "${1:-implicit}" "$2" "$got"
  else
    printf '  ✗ %-10s %-18s = %-30s (așteptat: %s)\n' "${1:-implicit}" "$2" "$got" "$3"
    esecuri=$((esecuri + 1))
  fi
}

echo ""
echo "Implicitul trebuie să fie producția de azi:"
verifica "" ADM_MEDIU         productie
verifica "" ADM_STACK         administrativo
verifica "" ADM_SERVICE       administrativo-web
verifica "" ADM_IMAGE         administrativo-web
verifica "" ADM_DOMAIN        administrativo.ro
verifica "" ADM_VHOST         30-administrativo.ro.conf
verifica "" ADM_SECRET_PREFIX ""
verifica "" ADM_REPLICI       2

echo ""
echo "Explicit „productie\" trebuie să dea exact același lucru:"
verifica productie ADM_STACK  administrativo
verifica productie ADM_DOMAIN administrativo.ro
verifica productie ADM_VHOST  30-administrativo.ro.conf

echo ""
echo "Staging trebuie să difere pe FIECARE nume care atinge rețeaua sau discul:"
verifica staging ADM_STACK         administrativo-staging
verifica staging ADM_SERVICE       administrativo-web-staging
verifica staging ADM_IMAGE         administrativo-web-staging
verifica staging ADM_DOMAIN        staging.administrativo.ro
verifica staging ADM_VHOST         32-staging.administrativo.ro.conf
verifica staging ADM_SECRET_PREFIX staging_
verifica staging ADM_REPLICI       1

echo ""
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
