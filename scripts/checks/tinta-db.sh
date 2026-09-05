#!/usr/bin/env bash
# ============================================================================
# Poarta „comenzile de bază de date lovesc baza mediului cerut".
#
# DEFECTUL PE CARE ÎL PREVINE, găsit pe 2026-09-05:
#
#   $ ADM_MEDIU=staging ./administrativo.sh db:status
#     •  proiect Supabase   nybmhorngsajoqaxjlbr   ← PRODUCȚIA
#     ⚠  de aplicat         3
#
# `_load_env_db` încărca hardcodat `.env.local`, deci comutatorul de mediu nu
# ajungea niciodată la stratul de bază de date. Pasul „migrări pe baza de
# staging" din .github/workflows/staging.yml ar fi aplicat DDL pe datele reale
# ale firmelor-client, automat, la fiecare push în main.
#
# Verificarea NU cere ca bazele să fie accesibile: compară doar referințele de
# proiect. Parola de staging poate fi greșită, invarianta rămâne verificabilă.
# Nu tipărește niciodată șirul de conexiune — conține parola.
#
# Rulare: bash scripts/checks/tinta-db.sh
# ============================================================================
set -uo pipefail

RADACINA="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
esecuri=0

# Rezolvă șirul de conexiune într-un shell proaspăt și întoarce DOAR referința
# de proiect. `ops/_lib.sh` face `readonly`, deci fiecare probă are shell-ul ei.
ref_pentru() { # $1 = mediu, $2 = (opțional) director de secrete
  local mediu="$1" secrete="${2:-}"
  ADM_MEDIU="$mediu" ADM_SECRETE_DIR="$secrete" ADMINISTRATIVO_ROOT="$RADACINA" bash -c '
    source "$ADMINISTRATIVO_ROOT/ops/_lib.sh" >/dev/null 2>&1
    source "$ADMINISTRATIVO_ROOT/ops/04-db.sh" >/dev/null 2>&1
    _load_env_db >/dev/null 2>&1
    u=$(_db_url_sau_mori) || exit 1
    _ref_din_url "$u"
  ' 2>/dev/null
}

REF_PRODUCTIE="nybmhorngsajoqaxjlbr"

echo ""
echo "1. Producția lovește proiectul de producție:"
p="$(ref_pentru productie)"
if [ -z "$p" ]; then
  # Spațiul de lucru al runner-ului e un checkout proaspăt: `.env.local` e
  # ignorat de git, deci nu există acolo. Verificarea se sare, nu pică —
  # invariantele care contează sunt 2, 3 și 4.
  echo "  ⚠ mediul de producție nu e disponibil aici (checkout curat) — sar"
elif [ "$p" = "$REF_PRODUCTIE" ]; then
  echo "  ✓ $p"
else
  echo "  ✗ producția a rezolvat spre „$p\" (așteptat $REF_PRODUCTIE)"
  esecuri=$((esecuri + 1))
fi

echo ""
echo "2. Staging NU lovește producția:"
s="$(ref_pentru staging)"
if [ -z "$s" ]; then
  echo "  ⚠ staging n-a putut rezolva un șir de conexiune (mediu neconfigurat)"
  echo "    Verificarea care contează — «nu e producția» — rămâne valabilă."
elif [ "$s" = "$REF_PRODUCTIE" ]; then
  echo "  ✗ STAGING REZOLVĂ SPRE PRODUCȚIE — exact defectul din 2026-09-05"
  esecuri=$((esecuri + 1))
else
  echo "  ✓ $s  (diferit de producție)"
fi

echo ""
echo "3. O nepotrivire între mediu și conexiune e REFUZATĂ:"
# `NEXT_PUBLIC_SUPABASE_URL` spune un proiect, `DATABASE_URL` altul. Combinația
# n-are nicio interpretare validă, deci comanda trebuie să se oprească.
mkdir -p "$TMP/secrete"
cat > "$TMP/secrete/.env.staging" <<'EOF'
NEXT_PUBLIC_SUPABASE_URL="https://mjyuonhcltjoxektopcg.supabase.co"
DATABASE_URL='postgresql://postgres:parolafalsa@db.nybmhorngsajoqaxjlbr.supabase.co:5432/postgres'
EOF
if ref_pentru staging "$TMP/secrete" | grep -q '[a-z]'; then
  echo "  ✗ nepotrivirea a fost ACCEPTATĂ"
  esecuri=$((esecuri + 1))
else
  echo "  ✓ nepotrivirea a fost refuzată"
fi

echo ""
echo "4. Un șir din care nu se poate citi proiectul e REFUZAT:"
cat > "$TMP/secrete/.env.staging" <<'EOF'
NEXT_PUBLIC_SUPABASE_URL="https://mjyuonhcltjoxektopcg.supabase.co"
DATABASE_URL='postgresql://cineva:ceva@o-gazda-oarecare:5432/postgres'
EOF
if ref_pentru staging "$TMP/secrete" | grep -q '[a-z]'; then
  echo "  ✗ un șir necunoscut a fost ACCEPTAT"
  esecuri=$((esecuri + 1))
else
  echo "  ✓ un șir necunoscut a fost refuzat"
fi

echo ""
if [ "$esecuri" -gt 0 ]; then
  echo "$esecuri verificări au picat."
  exit 1
fi
echo "Toate verificările au trecut."
