#!/usr/bin/env bash
# Aplică O migrare pe baza din cloud, byte-exact, prin psql — comanda din
# NOTES.md §1, împachetată ca punct unic de intrare.
#
# ── DE CE UN SCRIPT, ȘI NU psql DIRECT ──────────────────────────────────────
# Două motive, amândouă practice:
#
# 1. PAROLA NU AJUNGE NICIODATĂ ÎN LINIA DE COMANDĂ. Citită aici din
#    `.env.local`, nu scrisă de cel care rulează. O comandă `PGPASSWORD=… psql …`
#    tastată de mână ajunge în istoricul shell-ului, în transcriptul sesiunii și
#    în orice regulă de permisiune scrisă după ea.
#
# 2. REGULA DE PERMISIUNE DEVINE ÎNGUSTĂ. Un `Bash(psql *)` ar acoperi orice
#    comandă psql, către orice bază, inclusiv `drop schema public cascade`.
#    Regula pentru scriptul ăsta acoperă exact atât: aplicarea unui fișier de
#    migrare din `supabase/migrations/`, în tranzacție, cu ON_ERROR_STOP.
#
# ── CE NU FACE ──────────────────────────────────────────────────────────────
# Nu editează SQL-ul, nu-l retranscrie, nu-l trece prin niciun model — exact
# motivul pentru care CLAUDE.md interzice `supabase db push` și
# `mcp__supabase__apply_migration`. `psql -f` trimite fișierul ca atare.
#
#   aplica-cloud.sh supabase/migrations/0074_ceva.sql
#
# Ieșiri: 0 aplicată · 1 migrarea a picat · 3 eroare de utilizare/configurare.
set -uo pipefail

RADACINA="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
cd "$RADACINA" || { echo "aplica-cloud: nu găsesc rădăcina repo-ului"; exit 3; }

FISIER="${1:-}"
[ -n "$FISIER" ] || { echo "aplica-cloud: dă calea migrării. Ex: aplica-cloud.sh supabase/migrations/0074_x.sql"; exit 3; }
[ -f "$FISIER" ] || { echo "aplica-cloud: „$FISIER” nu există"; exit 3; }

# Numai din `supabase/migrations/`: scriptul aplică MIGRĂRI, nu SQL arbitrar.
# Fără verificarea asta, regula de permisiune ar fi doar aparent îngustă.
case "$FISIER" in
  supabase/migrations/*.sql) ;;
  *) echo "aplica-cloud: se aplică doar fișiere din supabase/migrations/*.sql"; exit 3 ;;
esac

[ -f .env.local ] || { echo "aplica-cloud: lipsește .env.local"; exit 3; }
PAROLA="$(grep -m1 '^SUPABASE_DB_PASSWORD=' .env.local | cut -d= -f2- | tr -d '\r\n"')"
[ -n "$PAROLA" ] || { echo "aplica-cloud: SUPABASE_DB_PASSWORD lipsește din .env.local"; exit 3; }

# Clientul psql al stației. Repo-ul e lucrat de pe mai multe mașini, iar `psql`
# nu e în PATH pe niciuna în același fel: pe Windows stă în `C:\PostgreSQL`, pe
# macOS vine din Postgres.app sau din `libpq` (keg-only, deci tot în afara
# PATH-ului). O singură cale implicită, oricare ar fi ea, e greșită pe celelalte
# mașini — de aceea se CAUTĂ, în ordinea de mai jos, iar `ADMINISTRATIVO_PSQL`
# rămâne cuvântul final.
gaseste_psql() {
  if [ -n "${ADMINISTRATIVO_PSQL:-}" ]; then echo "$ADMINISTRATIVO_PSQL"; return; fi
  if command -v psql >/dev/null 2>&1; then command -v psql; return; fi
  for c in \
    /Applications/Postgres.app/Contents/Versions/latest/bin/psql \
    /opt/homebrew/opt/libpq/bin/psql \
    /usr/local/opt/libpq/bin/psql \
    /c/PostgreSQL/17/bin/psql.exe
  do
    [ -x "$c" ] && { echo "$c"; return; }
  done
  echo ""
}
PSQL="$(gaseste_psql)"
[ -n "$PSQL" ] && { command -v "$PSQL" >/dev/null 2>&1 || [ -x "$PSQL" ]; } || {
  echo "aplica-cloud: nu găsesc psql. Instalează-l (macOS: Postgres.app sau \`brew install libpq\`)"
  echo "              sau pune calea exactă în ADMINISTRATIVO_PSQL."
  exit 3
}

GAZDA="${ADMINISTRATIVO_DB_HOST:-aws-1-eu-west-1.pooler.supabase.com}"
UTILIZATOR="${ADMINISTRATIVO_DB_USER:-postgres.nybmhorngsajoqaxjlbr}"

echo "aplica-cloud: $FISIER → $UTILIZATOR@$GAZDA"
PGPASSWORD="$PAROLA" "$PSQL" \
  -h "$GAZDA" -p 5432 -U "$UTILIZATOR" -d postgres \
  -v ON_ERROR_STOP=1 -f "$FISIER"
COD=$?

if [ "$COD" -eq 0 ]; then
  # ── Rândul din registru ──────────────────────────────────────────────────────
  # Scriptul ăsta a aplicat ani întregi fără să scrie nimic în
  # `internal.migrari_aplicate`, iar consecința a lovit de patru ori: `0119`
  # (3 sept), apoi `0128`, `0129` și `0131` (4-5 sept). De fiecare dată următoarea
  # sesiune rula `db:migrate`, care citește DOAR registrul, primea migrarea în
  # lista „de aplicat" și o re-executa — până la prima instrucțiune fără formă
  # idempotentă (`create type`, `create table`, `add constraint`), unde murea pe
  # producție.
  #
  # `db:migrate` știe de acum să verifice în bază înainte de a aplica, deci
  # defectul e prins și în aval. Rândul de aici îl previne cu totul: e mai bine
  # ca registrul să fie corect decât ca altcineva să repare după el. Suma se
  # calculează IDENTIC cu `_suma()` din `ops/04-db.sh` — `sha256sum` trunchiat la
  # 16 caractere. Dacă cele două formule diverg, garda forward-only ar raporta
  # fiecare migrare aplicată prin scriptul ăsta drept „modificată pe disc" și ar
  # bloca livrarea tuturor.
  #
  # `durata_ms` rămâne NULL, ca la `db:mark`: rândul spune „a rulat", nu „a fost
  # cronometrat de db:migrate".
  SUMA="$(sha256sum "$FISIER" | cut -c1-16)"
  NUME="$(basename "$FISIER")"
  if PGPASSWORD="$PAROLA" "$PSQL" \
       -h "$GAZDA" -p 5432 -U "$UTILIZATOR" -d postgres \
       -v ON_ERROR_STOP=1 -q -c "
         create schema if not exists internal;
         create table if not exists internal.migrari_aplicate (
           nume        text primary key,
           suma        text not null,
           aplicata_la timestamptz not null default now(),
           durata_ms   integer
         );
         insert into internal.migrari_aplicate (nume, suma)
         values ('$NUME', '$SUMA')
         on conflict (nume) do nothing;" >/dev/null 2>&1; then
    echo "aplica-cloud: APLICATĂ și trecută în registru (suma $SUMA)."
  else
    # Migrarea E aplicată; doar evidența n-a mers. Se spune tare, cu comanda de
    # reparat — altfel exact situația asta reapare la următorul `db:migrate`.
    echo "aplica-cloud: APLICATĂ, dar NU am putut scrie în registru."
    echo "              Repară acum: ./administrativo.sh db:mark $NUME"
  fi
  echo "aplica-cloud: regenerează tipurile înainte de typecheck."
else
  echo "aplica-cloud: A PICAT (cod $COD). Migrarea e în tranzacție — nimic nu s-a comis."
fi
exit "$COD"
