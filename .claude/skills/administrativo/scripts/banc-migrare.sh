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

# Ieșirile psql (eroarea migrării, izolarea, proba) stau într-un director AL
# ACESTEI RULĂRI, nu în `/tmp/banc.err` & co. Căile fixe erau comune tuturor
# bancurilor de pe mașină: cu mai mulți agenți în paralel, fiecare `psql … 2>`
# trunchia fișierul celuilalt, iar la un eșec simultan coada afișată sub „✗"
# putea fi eroarea altui banc — sau a unei probe care trecuse. Containerul avea
# deja PID-ul în nume; fișierele, nu.
LUCRU="$(mktemp -d "${TMPDIR:-/tmp}/banc-$$.XXXXXX")" || {
  echo "banc: nu pot crea directorul temporar"; exit 3; }
ERR="$LUCRU/err"; IZO="$LUCRU/izo"; PROBA="$LUCRU/proba"

curat() {
  [ -n "$CONTAINER" ] && [ "$PASTREAZA" -eq 0 ] && docker rm -f "$CONTAINER" >/dev/null 2>&1
  rm -rf -- "$LUCRU"
}
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
  if psql "$URL" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null 2>"$ERR"; then echo "✓"
  else echo "✗"; echo "── eroare ──"; tail -20 "$ERR"; exit 1; fi
done
echo "  $N migrări aplicate"

echo "▶ barierele de securitate"
B=0
for b in scripts/checks/security-definer.sql scripts/checks/policies-explain.sql scripts/checks/rls-enabled.sql; do
  B=$((B+1))
  printf "  Bariera %s %-38s" "$B" "$(basename "$b")"
  if psql "$URL" -v ON_ERROR_STOP=1 -q -f "$b" >/dev/null 2>"$ERR"; then echo "✓"
  else echo "✗"; tail -20 "$ERR"; exit 2; fi
done

echo "▶ izolarea între tenanți"
if psql "$URL" -v ON_ERROR_STOP=1 -f tests/rls/izolare.sql >"$IZO" 2>&1; then
  grep -c '✓' "$IZO" | xargs printf "  %s verificări trecute ✓\n"
else
  echo "  ✗"; tail -30 "$IZO"; exit 2
fi

# Probele pe module. Fiecare își numără singură eșecurile și încheie cu
# `raise exception` dacă are vreunul, deci `ON_ERROR_STOP=1` e de-ajuns.
#
# La 2026-09-05 erau ZECE fișiere `tests/rls/proba-*.sql` și NICIUNA nu
# era rulată de vreo poartă — nici aici, nici în CI. O probă pe care n-o
# rulează nimeni putrezește tăcut: prima migrare care îi rupe premisele n-o
# supără pe nimeni. Globul, nu o listă: următoarea probă intră singură.
echo "▶ probele pe module"
shopt -s nullglob
for p in tests/rls/proba-*.sql; do
  printf "  %-46s" "$(basename "$p")"
  if psql "$URL" -v ON_ERROR_STOP=1 -f "$p" >"$PROBA" 2>&1; then echo "✓"
  else echo "✗"; tail -30 "$PROBA"; exit 2; fi
done

echo "▶ TOT VERDE: $N migrări · 3/3 bariere · izolare · probe"
# Cu `--pastreaza`, URL-ul EXACT al acestui banc. `docker ps --filter
# name=administrativo-banc | head -1` alege orice banc de pe mașină — cu agenți
# în paralel, tipurile s-ar genera din baza altcuiva.
if [ "$PASTREAZA" -eq 1 ]; then
  echo "  păstrat: ${CONTAINER:-(--url dat)} · $URL"
  [ -n "$CONTAINER" ] && echo "  oprire: docker rm -f $CONTAINER"
fi
exit 0
