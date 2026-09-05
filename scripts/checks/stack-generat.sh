#!/usr/bin/env bash
# ============================================================================
# Poarta „aliasul nu colizionează".
#
# Fișierul de stack al staging-ului se obține redenumind O cheie din
# docker-stack.yml. Dacă redenumirea nu se aplică — fiindcă serviciul a fost
# redenumit între timp în fișierul de bază — rezultatul ar fi un stack de
# staging cu cheia de producție, adică două servicii cu ACELAȘI alias pe
# `strawboss-net`. nginx ar împărți traficul de producție între ele, iar
# jumătate din cereri ar ajunge în containere legate la altă bază de date.
#
# Defectul e complet tăcut: deploy verde, site funcțional, date greșite
# intermitent. Verificarea de aici e singura care îl prinde înainte să se
# întâmple.
#
# Rulare: bash scripts/checks/stack-generat.sh
# ============================================================================
set -uo pipefail

RADACINA="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
esecuri=0

ruleaza() { # $1 = rădăcina de folosit ca ADMINISTRATIVO_ROOT
  ADM_MEDIU=staging ADMINISTRATIVO_ROOT="$1" bash -c '
    source "$ADMINISTRATIVO_ROOT/ops/_lib.sh" >/dev/null 2>&1
    source "$ADMINISTRATIVO_ROOT/ops/05-docker.sh" >/dev/null 2>&1
    _genereaza_stack
  ' 2>&1
}

echo ""
echo "1. Cazul bun — docker-stack.yml real:"
if cale="$(ruleaza "$RADACINA")"; then
  if grep -q '^  administrativo-web-staging:$' "$cale" 2>/dev/null; then
    echo "  ✓ cheia de staging e prezentă"
  else
    echo "  ✗ cheia de staging LIPSEȘTE din $cale"
    esecuri=$((esecuri + 1))
  fi
  if grep -q '^  administrativo-web:$' "$cale" 2>/dev/null; then
    echo "  ✗ cheia de PRODUCȚIE a rămas în fișierul generat"
    esecuri=$((esecuri + 1))
  else
    echo "  ✓ cheia de producție a dispărut"
  fi
else
  echo "  ✗ generarea a eșuat pe fișierul real: $cale"
  esecuri=$((esecuri + 1))
fi

echo ""
echo "2. Cazul rău — serviciul a fost redenumit în fișierul de bază:"
cp -r "$RADACINA/ops" "$TMP/ops"
sed 's/^  administrativo-web:$/  alt-nume-web:/' \
    "$RADACINA/docker-stack.yml" > "$TMP/docker-stack.yml"
if ruleaza "$TMP" >/dev/null 2>&1; then
  echo "  ✗ garda NU a oprit un fișier de bază redenumit"
  esecuri=$((esecuri + 1))
else
  echo "  ✓ garda a oprit un fișier de bază redenumit"
fi

echo ""
echo "3. Producția primește fișierul original, neatins:"
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
if [ "$esecuri" -gt 0 ]; then
  echo "$esecuri verificări au picat."
  exit 1
fi
echo "Toate verificările au trecut."
