#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Amprentă stabilă a erorilor `tsc`, pentru comparație înainte/după un fix.
#
# Cheia e (fișier, cod, mesaj) — DELIBERAT fără linie și coloană. Un fix care
# adaugă o linie deplasează toate erorile ulterioare din fișier; cu linia în
# cheie, fiecare dintre ele ar apărea drept „eroare nouă" și orice reparație
# ar fi respinsă.
#
# Se folosește când `pnpm typecheck` e deja roșu pe main: gate-ul nu poate fi
# „zero erori", ci „nicio eroare în plus față de cele cunoscute".
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

cd "${GITHUB_WORKSPACE:-$(git rev-parse --show-toplevel)}" || exit 3

# Fără replay de diagnostice din cache — altfel lista poate fi parțială.
rm -f tsconfig.tsbuildinfo

# `tsc` iese cu 2 când găsește erori. Aici e normal, deci fără `set -e`.
./node_modules/.bin/tsc --noEmit --pretty false --incremental false 2>&1 \
| awk '
    # Diagnostic primar cu locație. Cerem CIFRE între paranteze: altfel
    # `src/app/(app)/concedii/...` ar fi tăiat la grupul de rute `(app)`.
    /^[^[:space:]].*\([0-9]+,[0-9]+\): error TS[0-9]+:/ {
      i = match($0, /\([0-9]+,[0-9]+\): error TS[0-9]+: /)
      fisier = substr($0, 1, i - 1)
      rest   = substr($0, i)
      match(rest, /TS[0-9]+/); cod = substr(rest, RSTART, RLENGTH)
      j = index(rest, ": " cod ": ")
      mesaj = substr(rest, j + length(cod) + 4)
      print fisier "\t" cod "\t" mesaj
      next
    }
    # Diagnostic global, fără fișier (ex. TS18003, TS5083).
    /^error TS[0-9]+:/ {
      match($0, /TS[0-9]+/); cod = substr($0, RSTART, RLENGTH)
      print "<global>\t" cod "\t" substr($0, index($0, ": ") + 2)
      next
    }
    # Elaborările indentate și „Found N errors" se ignoră.
  ' \
| LC_ALL=C sort
