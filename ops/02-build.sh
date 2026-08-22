#!/usr/bin/env bash
# ============================================================================
# ops/02-build.sh — build local și calitatea codului (fără Docker).
# ============================================================================

# @section "Build & Calitate"

# @cmd install "Instalează dependențele (pnpm, lockfile fix)"
cmd_install() {
  header "Instalare dependențe"
  require_cmd pnpm
  pnpm install --frozen-lockfile
  success "Dependențe instalate."
}

# @cmd build "Build de producție local (.next/)"
cmd_build() {
  header "Build local"
  require_cmd pnpm
  # `next build` importă fiecare rută, iar src/config/env.ts validează la import.
  # Fără mediu încărcat, build-ul moare cu „Configurație invalidă", nu cu ceva
  # care să sugereze că lipsesc variabile.
  _load_env
  _validate_prod_env
  pnpm build
  success "Build terminat în .next/"
}

# @cmd typecheck "Verificare de tipuri (tsc --noEmit)"
cmd_typecheck() { header "Verificare tipuri"; require_cmd pnpm; pnpm typecheck; success "Tipuri OK."; }

# @cmd lint "ESLint"
cmd_lint() { header "Lint"; require_cmd pnpm; pnpm lint; success "Lint OK."; }

# @cmd test "Teste unitare (vitest)"
cmd_test() { header "Teste unitare"; require_cmd pnpm; pnpm test; }

# @cmd verify "Tot lanțul: typecheck + lint + format + teste + build"
cmd_verify() {
  header "Verificare completă"
  require_cmd pnpm
  pnpm verify
  # `pnpm verify` din package.json NU include build. Build-ul e singurul care
  # prinde greșelile de graniță server/client — de exemplu un fișier marcat
  # "use server" care exportă o constantă (Next refuză build-ul, `tsc` nu
  # semnalează nimic). Fără el, „Verificare completă" ar fi o promisiune falsă.
  header "Build de producție"
  pnpm build
  success "Toate verificările au trecut, inclusiv build."
}

# @cmd clean "Șterge artefactele de build (.next, cache turbo)"
cmd_clean() {
  header "Curățare artefacte"
  rm -rf "$ADMINISTRATIVO_ROOT/.next" "$ADMINISTRATIVO_ROOT/.turbo"
  find "$ADMINISTRATIVO_ROOT" -maxdepth 2 -name '*.tsbuildinfo' -delete 2>/dev/null || true
  success "Artefacte șterse."
}

# @cmd clean:all "clean + node_modules"
cmd_clean__all() {
  header "Curățare totală"
  confirm "Șterg și node_modules (reinstalarea durează câteva minute)?" || { info "Anulat."; return 0; }
  cmd_clean
  rm -rf "$ADMINISTRATIVO_ROOT/node_modules"
  success "Șters tot. Rulează ./administrativo.sh install."
}
