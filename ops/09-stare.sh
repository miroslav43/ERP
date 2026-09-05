#!/usr/bin/env bash
# ============================================================================
# ops/09-stare.sh — pagina de stare a deploy-urilor de staging.
#
# DE CE EXISTĂ: la orice eșec, subdomeniul arată perfect și NIMIC nu spune că
# push-ul colegului n-a ajuns. Dacă `pnpm verify` pică, deploy-ul nici nu
# pornește; dacă `next build` pică, la fel; iar dacă containerul nu devine
# sănătos, `docker-stack.yml` face `failure_action: rollback` și subdomeniul
# revine singur la versiunea anterioară. În toate trei cazurile, tăcere.
#
# Starea e servită de un container SEPARAT (deploy/stare-stack.yml), nu de
# aplicație: momentul în care ai nevoie de ea e exact momentul în care aplicația
# nu pornește.
# ============================================================================

# @cmd stare:scrie "Scrie starea ultimei încercări de deploy [stare] [sha] [pași]"
cmd_stare__scrie() {
  local stare="${1:-necunoscut}" sha="${2:-necunoscut}" pasi="${3:-}"
  local dir="${ADM_STARE_DIR:-$HOME/.stare-staging}"
  mkdir -p "$dir"

  local culoare text
  case "$stare" in
    success) culoare="#0a7"; text="a ajuns pe staging" ;;
    *)       culoare="#c33"; text="NU a ajuns — staging e pe versiunea anterioară" ;;
  esac

  cat > "$dir/index.html" <<HTML
<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Staging — stare</title>
<style>
  body { font: 15px/1.6 system-ui, sans-serif; margin: 3rem auto; max-width: 40rem;
         padding: 0 1.25rem; color: #222; background: #fff; }
  h1 { font-size: 1.3rem; margin-bottom: .25rem; }
  .p { color: ${culoare}; font-weight: 600; font-size: 1.05rem; }
  code { background: #f2f2f2; padding: .1em .35em; border-radius: 3px; }
  .m { color: #666; font-size: .9rem; }
  @media (prefers-color-scheme: dark) {
    body { background: #14171c; color: #e6e6e6; }
    code { background: #262b33; }
    .m { color: #9aa1ab; }
  }
</style>
<h1>Administrativo — mediul de probă</h1>
<p class="p">${sha:0:8} — ${text}.</p>
<p>Pași <span class="m">(verify / migrări / deploy)</span>: <code>${pasi}</code></p>
<p class="m">Ultima încercare: $(date '+%Y-%m-%d %H:%M:%S %Z')</p>
<p><a href="https://github.com/miroslav43/ERP/commit/${sha}">Vezi commit-ul pe GitHub</a></p>
HTML

  printf '{"stare":"%s","sha":"%s","pasi":"%s","cand":"%s"}\n' \
    "$stare" "$sha" "$pasi" "$(date -Iseconds)" > "$dir/stare.json"

  _ok "stare scrisă" "$dir"
}
