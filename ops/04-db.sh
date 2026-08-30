#!/usr/bin/env bash
# ============================================================================
# ops/04-db.sh — baza de date (Supabase Cloud, proiect nybmhorngsajoqaxjlbr).
#
# Nu există container de Postgres și nu se rulează `supabase start`: decizia e
# consemnată în NOTES.md și PROGRESS.md — toate bazele reale (dezvoltare, test,
# producție) trăiesc în cloud.
#
# Migrările sunt forward-only și NU se aplică automat de nicăieri: nici din
# entrypoint-ul containerului, nici din deploy. „O migrare aplicată din greșeală
# pe proiectul greșit nu se poate da înapoi."
#
# ── DE CE UN REGISTRU PROPRIU ───────────────────────────────────────────────
# Varianta veche relua TOATE fișierele la fiecare rulare și considera „sărită"
# orice eroare al cărei text conținea „already exists". Două defecte, ambele
# tăcute:
#   • o migrare picată din alt motiv, dar cu „already exists" undeva în mesaj,
#     era raportată ca sărită — adică drept succes;
#   • nimic nu ținea minte ce s-a aplicat, deci „ce mai e de rulat?" nu avea
#     răspuns.
#
# `supabase_migrations.schema_migrations` NU e o alternativă: în acest proiect
# are 35 de rânduri din 95 de migrări aplicate, fiindcă `psql` nu scrie în el.
# De aceea registrul e al nostru, în `internal` (schemă neexpusă de PostgREST),
# și ține și suma de control a fișierului: o migrare deja aplicată care se
# modifică pe disc oprește totul, în loc să fie reaplicată tăcut.
# ============================================================================

# @section "Bază de date"

# ---------------------------------------------------------------------------
# `.env.local` e fișierul complet al dezvoltatorului — acolo stau parola bazei,
# cheia de serviciu și cheile de criptare. `.env.production` ține doar ce are
# nevoie containerul, care NU se conectează direct la Postgres. Deci pentru
# comenzile de bază de date sursa e `.env.local`, cu `.env.production` ca rezervă.
_load_env_db() {
  local f
  for f in "$ADMINISTRATIVO_ROOT/.env.local" "$ADMINISTRATIVO_ROOT/.env.production"; do
    if [ -f "$f" ]; then
      set -a
      # shellcheck disable=SC1090
      source "$f"
      set +a
      return 0
    fi
  done
  error "Nu găsesc nici .env.local, nici .env.production."
  exit 1
}

_db_url() {
  if [ -n "${DATABASE_URL:-}" ]; then echo "$DATABASE_URL"; return 0; fi
  [ -n "${SUPABASE_DB_PASSWORD:-}" ] || return 1

  local ref; ref=$(echo "${NEXT_PUBLIC_SUPABASE_URL:-}" | sed 's|https://||; s|\.supabase\.co.*||')
  [ -n "$ref" ] || return 1

  # Pooler-ul, nu conexiunea directă: proiectele noi nu mai au IPv4 direct
  # (NOTES.md §1). Regiunea se poate suprascrie din mediu.
  local gazda="${SUPABASE_POOLER_HOST:-aws-1-eu-west-1.pooler.supabase.com}"
  printf 'postgresql://postgres.%s:%s@%s:5432/postgres' "$ref" "$SUPABASE_DB_PASSWORD" "$gazda"
}

_db_url_sau_mori() {
  local u; u=$(_db_url) || {
    error "Nu pot construi șirul de conexiune."
    echo -e "     ${DIM}Setează DATABASE_URL, sau SUPABASE_DB_PASSWORD în .env.local.${NC}"
    exit 1
  }
  echo "$u"
}

# Registrul, creat la prima nevoie. `internal` nu e expusă de PostgREST, deci
# nu devine încă o tabelă publică.
_db_registru() {
  psql "$1" -v ON_ERROR_STOP=1 -q -c "
    set client_min_messages = warning;
    create schema if not exists internal;
    create table if not exists internal.migrari_aplicate (
      nume        text primary key,
      suma        text not null,
      aplicata_la timestamptz not null default now(),
      durata_ms   integer
    );" >/dev/null
}

_suma() { sha256sum "$1" | cut -c1-16; }

# @cmd db:status "Migrări aplicate, în așteptare și starea conexiunii"
cmd_db__status() {
  header "Stare bază de date"
  _load_env_db

  local total; total=$(ls -1 "$ADMINISTRATIVO_ROOT"/supabase/migrations/*.sql 2>/dev/null | wc -l)
  _infol "migrări în repo" "$total fișiere"
  _infol "ultima pe disc" "$(basename "$(ls -1 "$ADMINISTRATIVO_ROOT"/supabase/migrations/*.sql 2>/dev/null | tail -1)")"
  _infol "proiect Supabase" "$(echo "${NEXT_PUBLIC_SUPABASE_URL:-}" | sed 's|https://||; s|\.supabase\.co||')"

  local u; u=$(_db_url) || { _warnl "conexiune" "fără parolă — sar peste verificările directe"; return 0; }
  if ! psql "$u" -c 'select 1' &>/dev/null; then
    _fail "conexiune psql" "eșuată"
    return 1
  fi
  _ok "conexiune psql" "reușită"

  _db_registru "$u"
  local aplicate; aplicate=$(psql "$u" -tAc "select count(*) from internal.migrari_aplicate;")
  _infol "în registru" "$aplicate aplicate"

  local restante=0 f
  for f in "$ADMINISTRATIVO_ROOT"/supabase/migrations/*.sql; do
    if ! psql "$u" -tAc "select 1 from internal.migrari_aplicate where nume = $(printf "'%s'" "$(basename "$f")");" | grep -q 1; then
      restante=$(( restante + 1 ))
    fi
  done
  if [ "$restante" -eq 0 ]; then
    _ok "de aplicat" "niciuna"
  else
    _warnl "de aplicat" "$restante — rulează ./administrativo.sh db:migrate"
  fi
}

# @cmd db:baseline "Marchează migrările curente ca aplicate, fără să le ruleze"
cmd_db__baseline() {
  header "Însămânțez registrul"
  require_cmd psql
  _load_env_db
  local u; u=$(_db_url_sau_mori)
  _db_registru "$u"

  warn "Marchez TOATE migrările de pe disc drept aplicate, FĂRĂ să le rulez."
  warn "Se folosește o singură dată, pe o bază despre care știi că e la zi."
  confirm "Continui?" || { info "Anulat."; return 0; }

  local n=0 f nume
  for f in "$ADMINISTRATIVO_ROOT"/supabase/migrations/*.sql; do
    nume=$(basename "$f")
    psql "$u" -v ON_ERROR_STOP=1 -q -c \
      "insert into internal.migrari_aplicate (nume, suma) values ('$nume', '$(_suma "$f")')
       on conflict (nume) do nothing;" >/dev/null
    n=$(( n + 1 ))
  done
  success "$n migrări trecute în registru."
}

# @cmd db:migrate "Aplică DOAR migrările neaplicate, în ordine, fiecare în tranzacția ei"
cmd_db__migrate() {
  header "Aplicare migrări"
  require_cmd psql
  _load_env_db
  local u; u=$(_db_url_sau_mori)
  _db_registru "$u"

  local uscat=0
  [ "${1:-}" = "--dry-run" ] && uscat=1

  # Ce e de făcut, ÎNAINTE de orice scriere.
  local restante=() modificate=() f nume suma inregistrata
  for f in "$ADMINISTRATIVO_ROOT"/supabase/migrations/*.sql; do
    nume=$(basename "$f"); suma=$(_suma "$f")
    inregistrata=$(psql "$u" -tAc "select suma from internal.migrari_aplicate where nume = '$nume';")
    if [ -z "$inregistrata" ]; then
      restante+=("$f")
    elif [ "$inregistrata" != "$suma" ]; then
      modificate+=("$nume")
    fi
  done

  # Forward-only nu e o convenție de politețe: o migrare aplicată care se
  # schimbă pe disc înseamnă că baza și repo-ul spun lucruri diferite.
  if [ "${#modificate[@]}" -gt 0 ]; then
    error "Migrări DEJA APLICATE care s-au modificat pe disc:"
    printf '      %s\n' "${modificate[@]}"
    echo -e "     ${DIM}Forward-only: scrie o migrare nouă, nu o edita pe cea aplicată.${NC}"
    return 1
  fi

  if [ "${#restante[@]}" -eq 0 ]; then
    success "Nimic de aplicat — baza e la zi."
    return 0
  fi

  info "De aplicat: ${#restante[@]}"
  printf '      %s\n' "${restante[@]##*/}"
  echo ""

  if [ "$uscat" -eq 1 ]; then
    info "Rulare uscată — nu s-a scris nimic."
    return 0
  fi

  warn "Forward-only, pe baza de PRODUCȚIE. Nu există rollback."
  warn "Fă întâi un backup din Supabase Dashboard."
  confirm "Aplic cele ${#restante[@]} migrări?" || { info "Anulat."; return 0; }

  # Jurnalul de erori se creează cu `mktemp`, NU pe o cale fixă în /tmp.
  # `/tmp/adm-mig.err` a fost scris odată de o rulare cu `sudo`; de atunci
  # aparținea lui root, iar bash-ul oricui altcuiva pica pe redirectare ÎNAINTE
  # să pornească psql — deci prima migrare raporta „EȘEC" și tipărea conținutul
  # RĂMAS de la rularea veche, adică o eroare din altă migrare, din altă zi.
  # Diagnostic trimis pe pistă falsă de un fișier temporar. Aceeași clasă cu
  # `.git` deținut de root din memoria proiectului.
  local jurnal; jurnal=$(mktemp "${TMPDIR:-/tmp}/adm-mig.XXXXXX.err") || {
    error "Nu pot crea fișierul temporar pentru jurnalul migrărilor."; return 1; }

  local ok=0 t0 t1
  for f in "${restante[@]}"; do
    nume=$(basename "$f")
    printf "    %-52s" "$nume"
    t0=$(date +%s%3N)
    # `--single-transaction` NU se folosește: unele migrări au blocuri
    # `begin/commit` proprii, obligatorii pentru `alter type ... add value`
    # (55P04). Le-ar rupe. `ON_ERROR_STOP` oprește la prima eroare.
    if psql "$u" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null 2>"$jurnal"; then
      t1=$(date +%s%3N)
      psql "$u" -q -c "insert into internal.migrari_aplicate (nume, suma, durata_ms)
                       values ('$nume', '$(_suma "$f")', $(( t1 - t0 )))
                       on conflict (nume) do update set suma = excluded.suma;" >/dev/null
      echo -e "${GREEN}ok${NC} ${DIM}$(( t1 - t0 ))ms${NC}"
      ok=$(( ok + 1 ))
    else
      echo -e "${RED}EȘEC${NC}"
      sed 's/^/      /' "$jurnal" | tail -12
      echo ""
      # Oprire la prima eroare: următoarele presupun starea pe care asta n-a
      # apucat s-o creeze. A merge mai departe ar produce un al doilea eșec,
      # cu altă cauză, care ar ascunde-o pe prima.
      error "Oprit la „$nume”. Aplicate până aici: $ok. Repară și reia."
      rm -f "$jurnal"
      return 1
    fi
  done
  rm -f "$jurnal"

  echo ""
  success "$ok migrări aplicate."
  info "Regenerează tipurile: ./administrativo.sh db:types"
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
  _load_env_db
  local u; u=$(_db_url_sau_mori)
  local out
  out=$(psql "$u" -tAc \
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=false;")
  if [ -z "$out" ]; then
    success "Toate tabelele publice au RLS activ."
  else
    error "Tabele FĂRĂ RLS — expuse prin PostgREST oricui are cheia anon:"
    echo "$out" | sed 's/^/      /'
    return 1
  fi
}
