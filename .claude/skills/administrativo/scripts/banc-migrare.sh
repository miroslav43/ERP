#!/usr/bin/env bash
# Banc de migrări: aplică TOATE migrările pe un Postgres 17 curat, apoi cele
# trei bariere de securitate și testul de izolare. Identic cu jobul `migrations`
# din .github/workflows/ci.yml, ca să prinzi local ce ar pica în CI.
#
# De ce container și nu Postgres local: pe acest VM nu există niciun cluster
# local (doar clientul psql 16), iar NOTES.md §1 semnalează că un Postgres local
# 14 nu poate testa `security_invoker` (cere 15+) sau `NULLS NOT DISTINCT`.
# Interdicția „fără Docker pentru DB" din NOTES.md e despre baza de DEZVOLTARE;
# CI folosește deja exact `postgres:17` ca serviciu.
#
#   banc-migrare.sh [--url postgresql://…] [--pastreaza]
#
# Ieșiri: 0 totul verde · 1 migrare picată · 2 barieră/izolare picată · 3 SĂRIT.
set -uo pipefail

RADACINA="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
cd "$RADACINA" || { echo "banc: nu găsesc rădăcina repo-ului"; exit 3; }
[ -d supabase/migrations ] || { echo "banc: nu sunt în repo-ul Administrativo"; exit 3; }

URL=""; PASTREAZA=0; CONTAINER=""
while [ $# -gt 0 ]; do
  case "$1" in
    --url) URL="${2:-}"; shift 2 ;;
    --pastreaza) PASTREAZA=1; shift ;;
    *) echo "banc: argument necunoscut „$1”"; exit 3 ;;
  esac
done
[ -z "$URL" ] && URL="${ADMINISTRATIVO_BANC_URL:-}"

# Refuz absolut să ating cloud-ul.
case "$URL" in
  *supabase.co*|*pooler.supabase.com*)
    echo "banc: REFUZ — URL-ul arată spre Supabase cloud. Bancul rulează doar pe o bază de unică folosință."
    exit 3 ;;
esac

curat() { [ -n "$CONTAINER" ] && [ "$PASTREAZA" -eq 0 ] && docker rm -f "$CONTAINER" >/dev/null 2>&1; }
trap curat EXIT

if [ -z "$URL" ]; then
  command -v docker >/dev/null 2>&1 || {
    echo "banc: SĂRIT — nu există Docker și nu ai dat --url."
    echo "      Pornește manual un Postgres 17 și rulează:"
    echo "        $0 --url postgresql://postgres:parola@localhost:5432/banc"
    exit 3; }
  CONTAINER="administrativo-banc-$$"
  # Port liber, nu unul fix: o rulare anterioară cu `--pastreaza` ține 55432
  # ocupat, iar `docker run` cade atunci cu „port is already allocated" —
  # adică bancul refuză să pornească exact după o sesiune de iterat, când ai
  # cea mai mare nevoie de el.
  PORT=""
  for p in $(seq 55432 55452); do
    if ! (exec 3<>/dev/tcp/127.0.0.1/"$p") 2>/dev/null; then PORT="$p"; break; fi
    exec 3>&- 2>/dev/null || true
  done
  [ -z "$PORT" ] && { echo "banc: niciun port liber în 55432-55452"; exit 3; }
  echo "▶ pornesc postgres:17-alpine (container $CONTAINER, port $PORT)"
  docker run --rm -d --name "$CONTAINER" -e POSTGRES_PASSWORD=banc -p "$PORT:5432" postgres:17-alpine >/dev/null || {
    echo "banc: nu am putut porni containerul"; exit 3; }
  URL="postgresql://postgres:banc@localhost:$PORT/postgres"
  # NU `pg_isready`: imaginea oficială pornește întâi un server TEMPORAR de
  # inițializare, pe care pg_isready îl raportează gata — apoi acela se oprește
  # și pornește cel real. Interoghează prin portul publicat, care e disponibil
  # doar când serverul definitiv ascultă. Două reușite consecutive.
  printf "  aștept baza"
  GATA=0
  for _ in $(seq 1 60); do
    if psql "$URL" -tAc 'select 1' >/dev/null 2>&1; then
      GATA=$((GATA+1)); [ "$GATA" -ge 2 ] && { echo " ✓"; break; }
    else GATA=0; fi
    printf "."; sleep 1
  done
  [ "$GATA" -ge 2 ] || { echo " ✗ baza nu răspunde după 60s"; docker logs "$CONTAINER" 2>&1 | tail -15; exit 3; }
fi

command -v psql >/dev/null 2>&1 || { echo "banc: lipsește psql"; exit 3; }

echo "▶ aplic migrările"
N=0
for f in supabase/migrations/*.sql; do
  N=$((N+1))
  printf "  %-52s" "$(basename "$f")"
  if psql "$URL" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null 2>/tmp/banc.err; then echo "✓"
  else echo "✗"; echo "── eroare ──"; tail -20 /tmp/banc.err; exit 1; fi
done
echo "  $N migrări aplicate"

echo "▶ barierele de securitate"
B=0
for b in scripts/checks/security-definer.sql scripts/checks/policies-explain.sql scripts/checks/rls-enabled.sql; do
  B=$((B+1))
  printf "  Bariera %s %-38s" "$B" "$(basename "$b")"
  if psql "$URL" -v ON_ERROR_STOP=1 -q -f "$b" >/dev/null 2>/tmp/banc.err; then echo "✓"
  else echo "✗"; tail -20 /tmp/banc.err; exit 2; fi
done

echo "▶ izolarea între tenanți"
if psql "$URL" -v ON_ERROR_STOP=1 -f tests/rls/izolare.sql >/tmp/banc.izo 2>&1; then
  grep -c '✓' /tmp/banc.izo | xargs printf "  %s verificări trecute ✓\n"
else
  echo "  ✗"; tail -30 /tmp/banc.izo; exit 2
fi

echo "▶ TOT VERDE: $N migrări · 3/3 bariere · izolare"
exit 0
