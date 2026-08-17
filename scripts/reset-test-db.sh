# scripts/reset-test-db.sh
#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Resetarea bazei de test, în cloud, FĂRĂ Docker și FĂRĂ `supabase start`.
#
# Ce face: aruncă schemele `public`, `app`, `internal`, le recreează, rejoacă
# toate migrările din supabase/migrations/ în ordine, reîncarcă schema în
# PostgREST și șterge utilizatorii rămași din rulări anterioare.
#
# ⚠️ ESTE DISTRUCTIV. De aceea are LISTĂ ALBĂ, nu listă neagră: rulează exclusiv
# pe proiectele declarate mai jos. Un `db reset` pornit din greșeală pe proiectul
# de dezvoltare sau de producție este exact accidentul pe care îl previne.
#
# Variabile de mediu:
#   TEST_SUPABASE_PROJECT_REF  ref-ul proiectului de test (verificat față de listă)
#   TEST_SUPABASE_DB_URL       postgresql://postgres:<parolă>@db.<ref>.supabase.co:5432/postgres?sslmode=require
#   TEST_SUPABASE_URL          https://<ref>.supabase.co   (verificare de coerență)
# Testele mai cer, în plus: TEST_SUPABASE_ANON_KEY, TEST_SUPABASE_SERVICE_ROLE_KEY.
#
# Local:  chmod +x scripts/reset-test-db.sh && bash scripts/reset-test-db.sh && pnpm test:rls
# CI:     vezi jobul `rls` documentat în tests/rls/setup/discover.ts
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ⚠️ COMPLETEAZĂ cu ref-ul proiectului dedicat testelor. Ține sincron cu
# REFURI_DE_TEST_PERMISE din tests/rls/setup/reset.ts (verificare dublă, voită).
REFURI_PERMISE=(
  # "ref-ul-proiectului-administrativo-test"
)
REF_DEZVOLTARE="nybmhorngsajoqaxjlbr"

: "${TEST_SUPABASE_PROJECT_REF:?lipsește TEST_SUPABASE_PROJECT_REF}"
: "${TEST_SUPABASE_DB_URL:?lipsește TEST_SUPABASE_DB_URL}"
: "${TEST_SUPABASE_URL:?lipsește TEST_SUPABASE_URL}"

if [ ${#REFURI_PERMISE[@]} -eq 0 ]; then
  echo "REFUZ: lista albă de proiecte de test este goală. Completează REFURI_PERMISE în acest fișier." >&2
  exit 1
fi

permis=0
for ref in "${REFURI_PERMISE[@]}"; do
  [ "$ref" = "$TEST_SUPABASE_PROJECT_REF" ] && permis=1
done
if [ "$permis" -ne 1 ]; then
  echo "REFUZ: proiectul \"$TEST_SUPABASE_PROJECT_REF\" NU este în lista albă. Resetul nu rulează." >&2
  exit 1
fi
if [ "$TEST_SUPABASE_PROJECT_REF" = "$REF_DEZVOLTARE" ]; then
  echo "REFUZ: \"$TEST_SUPABASE_PROJECT_REF\" este proiectul de dezvoltare/producție." >&2
  exit 1
fi
# Lista albă verifică ref-ul, dar psql se conectează la URL: verificăm că țintesc
# același proiect. Altfel s-ar putea reseta altă bază decât cea aprobată.
case "$TEST_SUPABASE_DB_URL" in
  *"$TEST_SUPABASE_PROJECT_REF"*) ;;
  *) echo "REFUZ: TEST_SUPABASE_DB_URL nu conține ref-ul $TEST_SUPABASE_PROJECT_REF." >&2; exit 1 ;;
esac
case "$TEST_SUPABASE_URL" in
  *"$TEST_SUPABASE_PROJECT_REF"*) ;;
  *) echo "REFUZ: TEST_SUPABASE_URL nu conține ref-ul $TEST_SUPABASE_PROJECT_REF." >&2; exit 1 ;;
esac

echo "── Reset pe proiectul de test $TEST_SUPABASE_PROJECT_REF"

psql "$TEST_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
-- Utilizatorii de test nu sunt atinși de dropul schemelor: se șterg explicit.
delete from auth.users where email like '%@rls-test.invalid';

drop schema if exists internal cascade;
drop schema if exists app cascade;
drop schema if exists public cascade;

create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
SQL

shopt -s nullglob
migrari=(supabase/migrations/*.sql)
if [ ${#migrari[@]} -eq 0 ]; then
  echo "REFUZ: nicio migrare în supabase/migrations/ — baza ar rămâne goală." >&2
  exit 1
fi
for f in "${migrari[@]}"; do
  echo "── $f"
  psql "$TEST_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

# Fără reload, PostgREST răspunde din cache-ul vechi (PGRST205) și testele ar
# „trece" fără să atingă vreo tabelă.
psql "$TEST_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -c "notify pgrst, 'reload schema';"

echo "── Baza de test resetată."
