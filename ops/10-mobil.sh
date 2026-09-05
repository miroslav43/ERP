#!/usr/bin/env bash
# ============================================================================
# ops/10-mobil.sh — aplicația mobilă (Expo), construită AICI.
#
# Comenzile de aici NU ating nici stack-ul, nici baza, nici nginx-ul: `mobil/`
# are propriul lanț de unelte, propriul lockfile și propriul tsconfig. Sunt în
# centrul de comandă doar ca să nu trebuiască ținute minte două locuri.
#
# Munca grea o face `mobil/build-local.sh`, care rămâne rulabil și direct —
# funcțiile astea sunt un capăt, nu o a doua implementare. Tot ce știe despre
# capcane (TMPDIR propriu, `prebuild` care rescrie `package.json`, semnătura cu
# cheia de debug) trăiește acolo, într-un singur loc.
# ============================================================================

# @section "Aplicația mobilă"

_mobil_dir() { echo "$ADMINISTRATIVO_ROOT/mobil"; }

# @cmd mobile-build-local "APK Android construit local, fără EAS: mobile-build-local [release|debug] [--curat]"
cmd_mobile__build__local() {
  local dir; dir="$(_mobil_dir)"
  [ -d "$dir" ] || { error "Nu găsesc $dir"; exit 1; }
  [ -x "$dir/build-local.sh" ] || { error "Lipsește $dir/build-local.sh"; exit 1; }

  # `node_modules` din `mobil/` are propriul lockfile și propriul workspace.
  # Fără el, `prebuild` cade cu un mesaj despre autolinking care nu spune
  # nimic despre cauză — vezi capcana pnpm din mobil/README.md.
  if [ ! -d "$dir/node_modules" ]; then
    warn "mobil/node_modules lipsește — instalez întâi."
    (cd "$dir" && pnpm install) || { error "pnpm install a eșuat în mobil/"; exit 1; }
  fi

  # Nu prindem ieșirea: build-ul durează minute, iar progresul lui Gradle e
  # singurul semn că merge. `exec` ar închide și centrul de comandă odată cu
  # el, așa că doar delegăm și propagăm codul.
  (cd "$dir" && ./build-local.sh "$@")
}

# @cmd mobile-apk "APK-urile din arhiva locală (se păstrează ultimele 3)"
cmd_mobile__apk() {
  local arhiva; arhiva="$(_mobil_dir)/apk"
  if [ ! -d "$arhiva" ]; then
    info "Nicio arhivă încă. Construiește cu: ./administrativo.sh mobile-build-local"
    return 0
  fi

  local gasite=0 f
  section "APK-uri locale"
  # Aceeași sortare ca în build-local.sh: numeric pe numărul din nume.
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    gasite=$((gasite + 1))
    _infol "$f" "$(du -h "$arhiva/$f" 2>/dev/null | cut -f1)"
  done < <(cd "$arhiva" && ls -1 administrativo-*.apk 2>/dev/null | sort -t- -k3,3nr)

  if [ "$gasite" -eq 0 ]; then
    info "Arhiva e goală. Construiește cu: ./administrativo.sh mobile-build-local"
    return 0
  fi

  if [ -L "$arhiva/ultimul.apk" ]; then
    echo ""
    _ok "ultimul.apk" "→ $(readlink "$arhiva/ultimul.apk")"
    echo -e "     ${DIM}adb install -r $arhiva/ultimul.apk${NC}"
  fi
  echo ""
  echo -e "  ${DIM}Următorul build va fi #$(printf '%04d' "$(( $(cat "$arhiva/.contor" 2>/dev/null || echo 0) + 1 ))").${NC}"
  echo -e "  ${DIM}APK-urile sunt semnate cu cheia de DEBUG — de testat, nu de publicat.${NC}"
}
