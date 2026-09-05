#!/usr/bin/env bash
# ============================================================================
# Transformă log-urile rulării în rezumatul pe care îl citește colegul.
#
# Scopul: primele cinci rânduri să spună CE s-a stricat și UNDE, fără derulat
# patru mii de linii de log. Ieșirea merge în două locuri — $GITHUB_STEP_SUMMARY
# (randat în capul rulării) și un comentariu pe commit.
#
# Citește `JOB_STATUS` din mediu. GitHub NU îl expune automat: `job.status`
# există doar în context de expresie, deci workflow-ul trebuie să-l paseze
# explicit prin `env:`.
# ============================================================================
set -uo pipefail

stare="${JOB_STATUS:-necunoscut}"
sha="${GITHUB_SHA:-necunoscut}"

echo "## Staging — \`${sha:0:8}\`"
echo ""

if [ "$stare" = "success" ]; then
  echo "✅ **Viu la** https://staging.administrativo.ro"
  exit 0
fi

echo "❌ **Nu a ajuns pe staging.** Site-ul a rămas pe versiunea anterioară."
echo ""

# tsc: „src/fisier.ts(12,5): error TS2304: …"
if [ -f /tmp/verify.log ] && grep -qE '\.tsx?\([0-9]+,[0-9]+\): error' /tmp/verify.log; then
  echo "### Erori de tipuri"
  echo '```'
  grep -E '\.tsx?\([0-9]+,[0-9]+\): error' /tmp/verify.log | head -10
  echo '```'
  echo ""
fi

# eslint: calea pe o linie, apoi „  12:5  error  descriere  regula"
if [ -f /tmp/verify.log ] && grep -qE '^[[:space:]]+[0-9]+:[0-9]+[[:space:]]+error' /tmp/verify.log; then
  echo "### Erori de lint"
  echo '```'
  grep -B3 -E '^[[:space:]]+[0-9]+:[0-9]+[[:space:]]+error' /tmp/verify.log | head -15
  echo '```'
  echo ""
fi

# vitest
if [ -f /tmp/verify.log ] && grep -qE '(FAIL|✗|×)' /tmp/verify.log; then
  echo "### Teste picate"
  echo '```'
  grep -E '(FAIL|✗|×)' /tmp/verify.log | head -10
  echo '```'
  echo ""
fi

# prettier: „[warn] src/fisier.ts"
if [ -f /tmp/verify.log ] && grep -q '^\[warn\]' /tmp/verify.log; then
  echo "### Fișiere neformatate"
  echo '```'
  grep '^\[warn\]' /tmp/verify.log | head -10
  echo '```'
  echo "Reparație: \`pnpm format\`"
  echo ""
fi

# psql: „psql:supabase/migrations/0130_x.sql:42: ERROR: …"
if [ -f /tmp/migrari.log ] && grep -q 'ERROR:' /tmp/migrari.log; then
  echo "### Migrarea a picat"
  echo '```'
  grep -B2 -A2 'ERROR:' /tmp/migrari.log | head -20
  echo '```'
  echo ""
fi

if [ -f /tmp/deploy.log ] && grep -qiE 'error|eșuat|failed|neconvergent' /tmp/deploy.log; then
  echo "### Deploy"
  echo '```'
  tail -25 /tmp/deploy.log
  echo '```'
  echo ""
fi

echo "Log-ul întreg: rularea din fila Actions."
