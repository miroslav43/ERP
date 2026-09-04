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
  echo "aplica-cloud: APLICATĂ. Regenerează tipurile înainte de typecheck."
else
  echo "aplica-cloud: A PICAT (cod $COD). Migrarea e în tranzacție — nimic nu s-a comis."
fi
exit "$COD"
