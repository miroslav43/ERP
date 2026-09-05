#!/usr/bin/env bash
# ============================================================================
# ops/08-curatenie.sh — singurul loc din proiect care șterge ceva de pe disc.
#
# Măsurat pe VM la 2026-09-04: 197 de imagini (89,55 GB recuperabili), 2317
# intrări de cache de build (70,49 GB recuperabili), 40 de tag-uri
# `administrativo-web` adunate în zece zile. Fiecare deploy lasă ~125 MB —
# stratul `COPY .next/standalone`, singurul care se rescrie. Nimic nu a curățat
# vreodată nimic.
#
# Un VM cu Docker rămas fără disc nu doboară doar aplicația noastră: cade tot ce
# scrie pe `/`, adică toate cele nouă site-uri de aici.
# ============================================================================

# @section "Întreținere"

# @cmd curata "Șterge imaginile vechi și cache-ul de build [câte tag-uri păstrez]"
cmd_curata() {
  local pastrez="${1:-5}"
  header "Curățenie — păstrez ultimele ${pastrez} tag-uri per imagine"
  require_cmd docker

  # DE CE NU `docker volume prune`, NICIODATĂ, nici cu confirmare:
  # măsurat pe acest VM, 239 din 245 de volume sunt neatașate — dar mașina
  # servește nouă site-uri, ale mai multor proiecte. Un volum „neatașat" poate fi
  # baza unui serviciu oprit temporar. Ștergerea e ireversibilă și n-ar fi a
  # noastră.
  local inainte; inainte=$(df --output=avail -BG / | tail -1 | tr -dc '0-9')

  local sters=0
  for imagine in "administrativo-web" "administrativo-web-staging"; do
    # Ordonate descrescător după data creării; sar peste primele $pastrez.
    # `latest` se exclude explicit: e un alias spre tagul viu, iar ștergerea lui
    # ar lăsa `docker-stack.yml` fără implicitul din `${IMAGE_TAG:-latest}`.
    # `|| true` nu e neglijență, e obligatoriu: `administrativo.sh` rulează cu
    # `set -euo pipefail`, iar `grep -v` întoarce 1 când NU selectează nicio
    # linie — exact ce se întâmplă pentru o imagine care încă nu există
    # (`administrativo-web-staging` înaintea primului deploy). Fără el,
    # `pipefail` propagă 1, `set -e` omoară scriptul imediat după antet, iar
    # pasul de curățenie din workflow pică fără să spună de ce.
    #
    # S-a întâmplat: prima rulare reală (2026-09-05, rularea 33954717540) a
    # ieșit cu cod 1 după antet. Local păruse doar o ieșire trunchiată.
    local vechi
    vechi=$(docker images "$imagine" --format '{{.CreatedAt}}\t{{.Tag}}' 2>/dev/null \
            | grep -v $'\tlatest$' | sort -r | tail -n "+$((pastrez + 1))" | cut -f2) || true
    local tag
    for tag in $vechi; do
      if docker rmi "${imagine}:${tag}" >/dev/null 2>&1; then
        sters=$((sters + 1))
      else
        # Imaginea e folosită de un serviciu viu (tipic: tagul aflat în rulare).
        # Nu e o eroare — e exact protecția pe care o vrem.
        _infol "sar peste" "${imagine}:${tag} — în uz"
      fi
    done
  done
  _ok "imagini șterse" "$sters"

  # Cache-ul de build e sigur de șters: costă doar un build mai lent data
  # viitoare. Peste o săptămână straturile oricum nu se mai potrivesc, fiindcă
  # lockfile-ul și sursele s-au schimbat.
  info "Curăț cache-ul de build mai vechi de 7 zile..."
  docker builder prune --force --filter until=168h 2>&1 | tail -1

  local dupa; dupa=$(df --output=avail -BG / | tail -1 | tr -dc '0-9')
  echo ""
  success "Spațiu liber: ${inainte} GB → ${dupa} GB  (+$((dupa - inainte)) GB)"
}
