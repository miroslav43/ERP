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

# Log-urile stau în RUNNER_TEMP, nu în /tmp. Pe un runner SELF-HOSTED, /tmp
# supraviețuiește între rulări: prima versiune a raportat o secțiune „Deploy" cu
# ieșirea rulării ANTERIOARE, într-o rulare în care pasul de deploy fusese sărit.
# Agentul curăță `_work/_temp` la începutul fiecărui job, deci acolo nu se poate
# întâmpla.
LOGS="${RUNNER_TEMP:-/tmp}"

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
if [ -f "$LOGS"/verify.log ] && grep -qE '\.tsx?\([0-9]+,[0-9]+\): error' "$LOGS"/verify.log; then
  echo "### Erori de tipuri"
  echo '```'
  grep -E '\.tsx?\([0-9]+,[0-9]+\): error' "$LOGS"/verify.log | head -10
  echo '```'
  echo ""
fi

# eslint: calea fișierului pe o linie singură, apoi „  12:5  error  descriere  regulă".
#
# NU `grep -B3`: primul lucru pe care l-a produs varianta aia, la proba cu
# log-uri sintetice, a fost o eroare de `tsc` afișată sub titlul „Erori de
# lint" — fiindcă cele trei linii dinainte veneau din secțiunea de typecheck.
# Colegul ar fi căutat o regulă ESLint care nu există. `awk` ține minte ultima
# cale văzută și o tipărește o singură dată, doar dacă are erori sub ea.
if [ -f "$LOGS"/verify.log ] && grep -qE '^[[:space:]]+[0-9]+:[0-9]+[[:space:]]+error' "$LOGS"/verify.log; then
  echo "### Erori de lint"
  echo '```'
  awk '
    /^\/.*\.(ts|tsx|js|jsx|mjs|cjs)$/ { cale = $0; next }
    /^[[:space:]]+[0-9]+:[0-9]+[[:space:]]+error/ {
      if (cale != "") { print cale; cale = "" }
      print
    }
  ' "$LOGS"/verify.log | head -15
  echo '```'
  echo ""
fi

# vitest
if [ -f "$LOGS"/verify.log ] && grep -qE '(FAIL|✗|×)' "$LOGS"/verify.log; then
  echo "### Teste picate"
  echo '```'
  grep -E '(FAIL|✗|×)' "$LOGS"/verify.log | head -10
  echo '```'
  echo ""
fi

# prettier: „[warn] src/fisier.ts"
if [ -f "$LOGS"/verify.log ] && grep -q '^\[warn\]' "$LOGS"/verify.log; then
  echo "### Fișiere neformatate"
  echo '```'
  grep '^\[warn\]' "$LOGS"/verify.log | head -10
  echo '```'
  echo "Reparație: \`pnpm format\`"
  echo ""
fi

# psql vorbește în trei registre, iar primul tipar le acoperea doar pe unul:
#   ERROR:       eroare SQL în migrare  („relation … does not exist")
#   FATAL:       refuz la conectare     („password authentication failed")
#   psql: error: eroare de client       (gazdă inexistentă, termen depășit)
#
# Rularea 33956599315 a picat cu FATAL, iar rezumatul n-a arătat NIMIC despre
# cauză — doar o secțiune „Deploy" cu log vechi. Tocmai eroarea care contează
# lipsea din raportul menit s-o arate.
if [ -f "$LOGS"/migrari.log ] && grep -qE '(ERROR:|FATAL:|psql: error:)' "$LOGS"/migrari.log; then
  echo "### Migrarea nu a putut rula"
  echo '```'
  # `awk '!vazut[$0]++'` în loc de `sort -u`: psql repetă mesajul, dar contextul
  # unei erori SQL („LINE 3: from app.angajati" + „^") e util DOAR în ordinea
  # originală. Sortarea l-ar rupe.
  grep -B2 -A2 -E '(ERROR:|FATAL:|psql: error:)' "$LOGS"/migrari.log \
    | grep -vE '^--$|^$|┌|└' | awk '!vazut[$0]++' | head -12
  echo '```'
  echo ""
fi

if [ -f "$LOGS"/deploy.log ] && grep -qiE 'error|eșuat|failed|neconvergent' "$LOGS"/deploy.log; then
  echo "### Deploy"
  echo '```'
  tail -25 "$LOGS"/deploy.log
  echo '```'
  echo ""
fi

echo "Log-ul întreg: rularea din fila Actions."
