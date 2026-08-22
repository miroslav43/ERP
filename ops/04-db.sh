#!/usr/bin/env bash
# ============================================================================
# ops/04-db.sh — baza de date (Supabase Cloud, proiect nybmhorngsajoqaxjlbr).
#
# Nu există container de Postgres și nu se rulează `supabase start`: decizia e
# consemnată în NOTES.md și PROGRESS.md — toate bazele reale (dezvoltare, test,
# producție) trăiesc în cloud.
#
# Migrările sunt forward-only și NU se aplică automat de nicăieri: nici din
# entrypoint-ul containerului, nici din deploy. Citat din dev.sh: „o migrare
# aplicată din greșeală pe proiectul greșit nu se poate da înapoi."
# ============================================================================

# @section "Bază de date"

# @cmd db:status "Numără migrările și testează conexiunea"
cmd_db__status() {
  header "Stare bază de date"
  local n; n=$(ls -1 "$ADMINISTRATIVO_ROOT"/supabase/migrations/*.sql 2>/dev/null | wc -l)
  _infol "migrări în repo" "$n fișiere"
  _infol "ultima" "$(basename "$(ls -1 "$ADMINISTRATIVO_ROOT"/supabase/migrations/*.sql 2>/dev/null | tail -1)")"

  _load_env
  _infol "proiect Supabase" "$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed 's|https://||; s|\.supabase\.co||')"

  if [ -n "${DATABASE_URL:-}" ] && command -v psql &>/dev/null; then
    if psql "$DATABASE_URL" -c 'SELECT 1' &>/dev/null; then
      _ok "conexiune psql" "reușită"
    else
      _fail "conexiune psql" "eșuată"
    fi
  else
    _infol "psql" "DATABASE_URL nesetat — verificarea directă e sărită"
  fi

  # Verificarea prin API confirmă că serviciul răspunde chiar fără psql local.
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' -m 10 \
    -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
    "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/" 2>/dev/null || echo "000")
  [ "$code" = "200" ] && _ok "API Supabase" "HTTP $code" || _warnl "API Supabase" "HTTP $code"
}

# @cmd db:migrate "Aplică migrările (cere confirmare explicită)"
cmd_db__migrate() {
  header "Aplicare migrări"
  require_cmd psql
  _load_env

  if [ -z "${DATABASE_URL:-}" ]; then
    error "DATABASE_URL nu e setat în .env.production."
    echo -e "     ${DIM}Vezi NOTES.md pentru șirul de conexiune prin pooler.${NC}"
    exit 1
  fi

  local n; n=$(ls -1 "$ADMINISTRATIVO_ROOT"/supabase/migrations/*.sql 2>/dev/null | wc -l)
  warn "Sunt $n migrări, forward-only, pe baza de PRODUCȚIE."
  warn "Nu există rollback. Fă întâi un backup din Supabase Dashboard."
  confirm "Aplic migrările?" || { info "Anulat."; return 0; }

  local ok=0 skip=0 fail=0
  for m in "$ADMINISTRATIVO_ROOT"/supabase/migrations/*.sql; do
    printf "    %-52s" "$(basename "$m")"
    local out
    if out=$(psql "$DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 -f "$m" 2>&1); then
      echo -e "${GREEN}ok${NC}"; ok=$(( ok + 1 ))
    elif echo "$out" | grep -qi "already exists\|duplicate"; then
      echo -e "${YELLOW}sărită${NC}"; skip=$(( skip + 1 ))
    else
      echo -e "${RED}EȘEC${NC}"; echo "$out" | head -3 | sed 's/^/      /'
      fail=$(( fail + 1 ))
    fi
  done
  echo ""
  info "aplicate: $ok · sărite: $skip · eșuate: $fail"
  [ "$fail" -eq 0 ] || return 1
}

# @cmd db:types "Regenerează src/types/database.ts din schema live"
cmd_db__types() {
  header "Generez tipurile"
  require_cmd pnpm
  pnpm db:types
  success "src/types/database.ts actualizat."
}

# @cmd db:check-rls "Tabele publice fără RLS activ (nu ar trebui să existe)"
cmd_db__check__rls() {
  header "Verificare RLS"
  require_cmd psql
  _load_env
  [ -n "${DATABASE_URL:-}" ] || { error "DATABASE_URL nesetat."; exit 1; }
  local out
  out=$(psql "$DATABASE_URL" -tAc \
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=false;")
  if [ -z "$out" ]; then
    success "Toate tabelele publice au RLS activ."
  else
    error "Tabele FĂRĂ RLS — expuse prin PostgREST oricui are cheia anon:"
    echo "$out" | sed 's/^/      /'
    return 1
  fi
}
