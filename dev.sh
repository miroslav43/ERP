#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# dev.sh — pornește Administrativo local, cu verificările făcute înainte.
#
# Rostul lui nu e să scrie `pnpm dev` în locul tău, ci să prindă din timp cele
# patru feluri în care pornirea eșuează confuz: dependențe neinstalate, o cheie
# lipsă din .env.local (Zod aruncă la boot, cu un mesaj despre variabile de
# mediu, nu despre ce ai uitat), portul ocupat de o rulare anterioară, și baza
# de date la care aplicația chiar se conectează fiind alta decât cea la care te
# gândeai.
#
#   ./dev.sh              verifică și pornește
#   ./dev.sh --seed       + (re)creează conturile de demonstrație
#   ./dev.sh --reset-demo + șterge și recreează demonstrația de la zero
#   ./dev.sh --check      doar verificările, fără să pornească nimic
#   ./dev.sh --kill       oprește serverul care rulează deja și pornește curat
#   ./dev.sh --port 3001  alt port
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

PORT=3000
SEED=0
RESET_DEMO=0
DOAR_VERIFIC=0
OMOARA=0

while [ $# -gt 0 ]; do
  case "$1" in
    --seed)       SEED=1 ;;
    --reset-demo) SEED=1; RESET_DEMO=1 ;;
    --check)      DOAR_VERIFIC=1 ;;
    --kill)       OMOARA=1 ;;
    --port)       PORT="${2:?--port cere un număr}"; shift ;;
    -h|--help)    sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)            echo "Argument necunoscut: $1. Încearcă --help." >&2; exit 2 ;;
  esac
  shift
done

VERDE=$'\033[32m'; GALBEN=$'\033[33m'; ROSU=$'\033[31m'; GRI=$'\033[90m'; STOP=$'\033[0m'
ok()    { printf '  %s✓%s %s\n' "$VERDE" "$STOP" "$1"; }
atent() { printf '  %s!%s %s\n' "$GALBEN" "$STOP" "$1"; }
rau()   { printf '  %s✗%s %s\n' "$ROSU" "$STOP" "$1" >&2; }
titlu() { printf '\n%s── %s%s\n' "$GRI" "$1" "$STOP"; }

ESECURI=0
esec() { rau "$1"; ESECURI=$((ESECURI + 1)); }

# ── 1. Unelte ────────────────────────────────────────────────────────────────
titlu "Unelte"

if ! command -v node >/dev/null 2>&1; then
  esec "node nu este instalat."
else
  NODE_MAJOR="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
  if [ "$NODE_MAJOR" -lt 20 ]; then
    esec "node $(node -v) — Next.js 16 cere cel puțin 20."
  else
    ok "node $(node -v)"
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  esec "pnpm nu este instalat: npm install -g pnpm"
else
  ok "pnpm $(pnpm -v)"
fi

# ── 2. Dependențe ────────────────────────────────────────────────────────────
titlu "Dependențe"

if [ ! -d node_modules ]; then
  atent "node_modules lipsește — instalez."
  pnpm install
  ok "instalate"
elif [ pnpm-lock.yaml -nt node_modules ]; then
  # Lockfile mai nou decât instalarea: cineva a tras modificări de pe altă ramură.
  atent "pnpm-lock.yaml e mai nou decât node_modules — reinstalez."
  pnpm install
  ok "actualizate"
else
  ok "la zi"
fi

# ── 3. Configurare ───────────────────────────────────────────────────────────
titlu "Configurare"

if [ ! -f .env.local ]; then
  esec ".env.local lipsește. Pornește de la .env.example și completează-l."
else
  # Chei fără de care `src/config/env.ts` aruncă la BOOT, nu la prima cerere —
  # adică serverul pare că pornește și moare imediat, cu un stack de Zod.
  NECESARE=(
    NEXT_PUBLIC_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY
    NEXT_PUBLIC_APP_URL
    SUPABASE_SERVICE_ROLE_KEY
    HR_ENCRYPTION_KEYS
    HR_ENCRYPTION_ACTIVE_KEY
    HR_HASH_KEY
    TENANT_COOKIE_SECRET
  )
  LIPSA=()
  for cheie in "${NECESARE[@]}"; do
    grep -qE "^[[:space:]]*${cheie}[[:space:]]*=[[:space:]]*[^[:space:]]" .env.local || LIPSA+=("$cheie")
  done
  if [ ${#LIPSA[@]} -gt 0 ]; then
    esec "Lipsesc din .env.local: ${LIPSA[*]}"
  else
    ok "toate cele ${#NECESARE[@]} chei sunt prezente"
  fi

  # O cheie definită de mai multe ori nu e o eroare — ultima câștigă, și în shell,
  # și în Next. Dar dacă valorile diferă, aplicația folosește alta decât crezi.
  DUPLICATE="$(grep -oE '^[[:space:]]*[A-Z0-9_]+[[:space:]]*=' .env.local \
    | tr -d ' =' | sort | uniq -d | tr '\n' ' ' || true)"
  if [ -n "${DUPLICATE// /}" ]; then
    atent "Chei definite de mai multe ori în .env.local: ${DUPLICATE}"
    atent "Ultima definiție câștigă. Curăță-le ca să nu urmărești o valoare fantomă."
  fi

  URL_SUPABASE="$(grep -E '^[[:space:]]*NEXT_PUBLIC_SUPABASE_URL[[:space:]]*=' .env.local \
    | tail -1 | cut -d= -f2- | tr -d ' "'"'" || true)"
  [ -n "$URL_SUPABASE" ] && ok "Supabase: ${URL_SUPABASE}"
fi

if [ "$ESECURI" -gt 0 ]; then
  printf '\n%s%d problemă(e) de rezolvat înainte de pornire.%s\n' "$ROSU" "$ESECURI" "$STOP" >&2
  exit 1
fi

# ── 4. Migrări neaplicate ────────────────────────────────────────────────────
titlu "Migrări"

NR_MIGRARI="$(find supabase/migrations -name '*.sql' | wc -l | tr -d ' ')"
ok "${NR_MIGRARI} fișiere în supabase/migrations/"
atent "Scriptul NU le aplică singur — o migrare aplicată din greșeală pe proiectul"
atent "greșit nu se poate da înapoi. Aplicarea rămâne o decizie explicită."

# ── 5. Un alt `next dev` pe același proiect ─────────────────────────────────
#
# Next 16 permite UN SINGUR server de dezvoltare per director, indiferent de port,
# și refuză al doilea DUPĂ ce a afișat deja „Ready in 351ms" — deci pare că a
# pornit, iar mesajul adevărat trece neobservat sub bannerul verde. Alegerea unui
# alt port nu ajută cu nimic.
#
# Serverul își scrie starea în .next/dev/lock. O citim de acolo, nu ghicim.
titlu "Server de dezvoltare"

LOCK=".next/dev/lock"
LOCK_PID=""
LOCK_URL=""

if [ -f "$LOCK" ]; then
  LOCK_PID="$(sed -n 's/.*"pid":[[:space:]]*\([0-9]*\).*/\1/p' "$LOCK")"
  LOCK_URL="$(sed -n 's/.*"appUrl":[[:space:]]*"\([^"]*\)".*/\1/p' "$LOCK")"
  # Un lock rămas de la un proces mort nu înseamnă nimic.
  if [ -n "$LOCK_PID" ] && ! kill -0 "$LOCK_PID" 2>/dev/null; then
    LOCK_PID=""
  fi
fi

if [ -n "$LOCK_PID" ]; then
  DE_CAND="$(ps -p "$LOCK_PID" -o lstart= 2>/dev/null | sed 's/^ *//' || echo '?')"
  if [ "$OMOARA" -eq 1 ]; then
    atent "Opresc serverul existent (PID ${LOCK_PID}, pornit ${DE_CAND})."
    kill "$LOCK_PID" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 "$LOCK_PID" 2>/dev/null || break
      sleep 0.5
    done
    if kill -0 "$LOCK_PID" 2>/dev/null; then
      esec "Nu s-a oprit. Încearcă: kill -9 ${LOCK_PID}"
      exit 1
    fi
    ok "oprit"
  else
    atent "Rulează deja un server pentru acest proiect: ${LOCK_URL:-?}"
    atent "PID ${LOCK_PID}, pornit ${DE_CAND}."
    printf '\n'
    printf '  Next permite unul singur per director, deci un alt port NU ajută.\n'
    printf '  Ai două variante:\n'
    printf '    · folosește-l pe cel existent  → %s\n' "${LOCK_URL:-http://localhost:3000}"
    printf '    · repornește-l curat           → ./dev.sh --kill%s\n' \
      "$([ "$SEED" -eq 1 ] && echo ' --seed' || echo '')"
    printf '\n'
    exit 0
  fi
else
  ok "niciun server pornit pentru acest proiect"
fi

# Portul poate fi ocupat de altceva decât Next — un tunel, alt proiect.
if command -v lsof >/dev/null 2>&1 && lsof -ti :"$PORT" >/dev/null 2>&1; then
  PID_PORT="$(lsof -ti :"$PORT" | head -1)"
  CINE="$(ps -p "$PID_PORT" -o comm= 2>/dev/null || echo necunoscut)"
  atent "Portul ${PORT} e ocupat de ${CINE} (PID ${PID_PORT}) — alt proces, nu Next."
  atent "Oprește-l cu: kill ${PID_PORT}   — sau alege alt port: ./dev.sh --port 3001"
  # Nu îl omorâm noi: nu e al nostru.
else
  ok "portul ${PORT} e liber"
fi

# ── 6. Demonstrație ──────────────────────────────────────────────────────────
if [ "$SEED" -eq 1 ]; then
  titlu "Date de demonstrație"
  if [ "$RESET_DEMO" -eq 1 ]; then
    node scripts/demo/seed-demo.mjs --reset
  else
    node scripts/demo/seed-demo.mjs
  fi
fi

if [ "$DOAR_VERIFIC" -eq 1 ]; then
  printf '\n%sVerificările au trecut.%s\n' "$VERDE" "$STOP"
  exit 0
fi

# ── 7. Pornire ───────────────────────────────────────────────────────────────
titlu "Pornesc serverul de dezvoltare"
printf '  Aplicația:   http://localhost:%s\n' "$PORT"
printf '  Autentificare: http://localhost:%s/autentificare\n' "$PORT"
if [ "$SEED" -eq 0 ]; then
  printf '  %sConturi de demonstrație: ./dev.sh --seed%s\n' "$GRI" "$STOP"
fi
printf '\n'

exec pnpm dev --port "$PORT"
