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
echo "4. Randarea prin CALEA REALĂ de cod (fără variabile puse de mână):"
# DE CE CONTEAZĂ NUANȚA: prima versiune a verificării rula
#   ADM_SECRET_PREFIX=staging_ ADM_REPLICI=1 docker stack config …
# adică punea singură variabilele pe care voia să le vadă. Trecea, dar testa
# fișierul, nu codul. În realitate `_lib.sh` le declara `readonly` FĂRĂ `export`,
# iar `docker stack deploy` interpolează din mediul procesului — deci staging a
# fost deployat cu secretele PRODUCȚIEI și cu 2 replici.
#
# Verificarea de acum sursează exact ce sursează `administrativo.sh` și nu
# setează nimic. Dacă `export` dispare, pică.
randeaza() { # $1 = mediu
  ADM_MEDIU="$1" ADMINISTRATIVO_ROOT="$RADACINA" bash -c '
    source "$ADMINISTRATIVO_ROOT/ops/_lib.sh" >/dev/null 2>&1
    source "$ADMINISTRATIVO_ROOT/ops/05-docker.sh" >/dev/null 2>&1
    _load_env >/dev/null 2>&1
    f=$(_genereaza_stack) || exit 1
    IMAGE_TAG=proba docker stack config -c "$f" 2>/dev/null
  '
}

verifica_randare() { # $1 = mediu, $2 = prefix imagine, $3 = tipar secrete, $4 = replici
  local out; out="$(randeaza "$1")"
  if [ -z "$out" ]; then
    echo "  ⚠ $1: randarea n-a produs nimic (mediu neconfigurat aici) — sar"
    return
  fi
  local img rep sec_gresite
  img=$(printf '%s' "$out" | sed -n 's/^ *image: \(.*\)$/\1/p' | head -1)
  rep=$(printf '%s' "$out" | sed -n 's/^ *replicas: \([0-9]*\)$/\1/p' | head -1)
  # Doar `name:`-urile din secțiunea `secrets:`. `networks:` are și el unul
  # (`strawboss-net`), iar un sed lacom peste tot fișierul îl număra ca secret
  # cu nume greșit.
  sec_gresite=$(printf '%s' "$out" | awk '
    /^secrets:/        { in_sec = 1; next }
    /^[a-zA-Z]/        { in_sec = 0 }
    in_sec && /^ *name:/ { print $2 }
  ' | grep -Ecv "$3" || true)

  case "$img" in
    "$2"*) echo "  ✓ $1: imagine $img" ;;
    *) echo "  ✗ $1: imagine „$img\" (așteptat prefix $2)"; esecuri=$((esecuri + 1)) ;;
  esac
  if [ "$rep" = "$4" ]; then
    echo "  ✓ $1: $rep replici"
  else
    echo "  ✗ $1: $rep replici (așteptat $4)"; esecuri=$((esecuri + 1))
  fi
  if [ "$sec_gresite" = "0" ]; then
    echo "  ✓ $1: toate secretele se potrivesc cu «$3»"
  else
    echo "  ✗ $1: $sec_gresite secrete NU se potrivesc cu «$3»"; esecuri=$((esecuri + 1))
  fi
}

verifica_randare staging   "administrativo-web-staging:" "^staging_" 1
# Producția: numele EXACTE, nu „orice literă mică" — un tipar larg ar fi acceptat
# și `staging_supabase_service_role_key`, adică exact scurgerea de verificat.
verifica_randare productie "administrativo-web:" \
  "^(supabase_service_role_key|hr_encryption_keys|hr_hash_key|tenant_cookie_secret)$" 2

echo ""
if [ "$esecuri" -gt 0 ]; then
  echo "$esecuri verificări au picat."
  exit 1
fi
echo "Toate verificările au trecut."
