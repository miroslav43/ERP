#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Compară două amprente produse de `tipuri-amprenta.sh`.
#
# Iese cu 1 dacă amprenta curentă conține o eroare care nu era în bază, SAU
# aceeași eroare de mai multe ori decât înainte. Comparația e pe MULTISET, nu
# pe mulțime: două erori identice în același fișier nu trebuie să se
# colapseze într-una singură.
#
#   tipuri-compara.sh <amprenta_baza> <amprenta_curenta>
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

baza="${1:?lipsește amprenta de bază}"
curenta="${2:?lipsește amprenta curentă}"

LC_ALL=C awk -F'\t' '
  NR == FNR { b[$0]++; next }
              c[$0]++
  END {
    rc = 0
    for (k in c) {
      if (c[k] > (b[k] + 0)) {
        printf("EROARE NOUĂ (%d -> %d): %s\n", b[k] + 0, c[k], k)
        rc = 1
      }
    }
    if (rc == 0) print "Nicio eroare de tip nouă față de linia de bază."
    exit rc
  }
' "$baza" "$curenta"
