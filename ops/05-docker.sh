#!/usr/bin/env bash
# ============================================================================
# ops/05-docker.sh — construcția imaginii și stack-ul Swarm.
#
# Edge-ul (nginx + certbot) NU se atinge de aici — e partajat de tot VM-ul și
# trăiește în docker-compose.yml-ul StrawBoss. Vezi ops/06-nginx.sh.
# ============================================================================

# @section "Docker / Swarm"

# Construiește imaginea, taguită cu git short-sha + :latest.
# Tagul pe sha e ce face rollback-ul posibil: Swarm păstrează spec-ul anterior
# și poate reveni la imaginea exactă de dinainte. Cu doar `:latest`, „anterioara"
# ar fi un tag mutabil care între timp arată spre altceva.
_build_image() {
  local tag; tag="$(_git_sha)"

  # Tagul TREBUIE să se schimbe când se schimbă conținutul, altfel deploy-ul e
  # o iluzie: `docker stack deploy` compară SPECIFICAȚIA serviciului, iar cu
  # aceeași referință de imagine Swarm decide că n-are ce actualiza și lasă
  # task-urile vechi să ruleze mai departe. Serviciul rămâne 2/2 „sănătos", pe
  # cod vechi — un verde fals care a costat un ciclu întreg de depanare.
  #
  # Pe un arbore murdar, sha-ul nu descrie ce se construiește, deci i se
  # adaugă un marcaj de timp. Pe un arbore curat, sha-ul E identitatea:
  # o reconstrucție a aceluiași commit chiar nu are ce să schimbe.
  local dirty; dirty=$(git -C "$ADMINISTRATIVO_ROOT" status --porcelain 2>/dev/null | wc -l)
  if [ "$dirty" -gt 0 ]; then
    tag="${tag}-$(date +%Y%m%d%H%M%S)"
    warn "Arbore de lucru murdar ($dirty fișiere) — tag unic: $tag"
  fi

  header "Construiesc imaginea (tag: $tag)"

  # Variabilele NEXT_PUBLIC_* se dau ca build args fiindcă `next build` le
  # înlocuiește textual în bundle-ul de client. Cele de server NU se dau:
  # Dockerfile folosește placeholdere doar cât să treacă validarea Zod, iar
  # valorile reale ajung la runtime prin docker-stack.yml. Așa niciun secret nu
  # intră în vreun layer, nici măcar în cel aruncat.
  # ── GARDĂ: o variabilă NEXT_PUBLIC_* uitată din lista de mai jos ──────────
  # `next build` inlinuiește variabilele `NEXT_PUBLIC_*` în bundle-ul de client
  # DIN MEDIUL BUILD-ULUI. Una care există în `.env.production` dar nu e trecută
  # prin `--build-arg` ajunge `undefined` în browser — și nu cade nimic: codul
  # care o citește pur și simplu nu face nimic.
  #
  # S-a întâmplat deja, cu `NEXT_PUBLIC_UMAMI_*`: erau completate corect, imaginea
  # s-a construit, s-a livrat, iar scriptul de măsurare lipsea din pagină. Nicio
  # eroare, nicăieri. Verificarea de mai jos costă o secundă.
  local lipsa=()
  local cheie
  while IFS= read -r cheie; do
    grep -q -- "--build-arg ${cheie}=" "${BASH_SOURCE[0]}" || lipsa+=("$cheie")
  done < <(grep -oE '^NEXT_PUBLIC_[A-Z0-9_]+' "$(_env_file)" | sort -u)
  if [ ${#lipsa[@]} -gt 0 ]; then
    warn "Variabile NEXT_PUBLIC_* din .env.production care NU se trimit la build:"
    printf '       %s\n' "${lipsa[@]}"
    warn "Vor fi 'undefined' în browser. Adaugă-le în docker build de mai jos ȘI ca ARG în Dockerfile."
  fi

  docker build \
    --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
    --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    --build-arg NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL" \
    --build-arg NEXT_PUBLIC_UMAMI_SRC="${NEXT_PUBLIC_UMAMI_SRC:-}" \
    --build-arg NEXT_PUBLIC_UMAMI_ID="${NEXT_PUBLIC_UMAMI_ID:-}" \
    -t "${ADM_IMAGE}:${tag}" \
    -t "${ADM_IMAGE}:latest" \
    "$ADMINISTRATIVO_ROOT"

  success "Imagine construită: ${ADM_IMAGE}:${tag}"
  ADM_IMAGE_TAG="$tag"
}

# @cmd docker:build "Construiește imaginea de producție"
cmd_docker__build() {
  require_cmd docker
  _load_env
  _validate_prod_env
  _build_image
  echo ""
  docker images "${ADM_IMAGE}" --format '  {{.Repository}}:{{.Tag}}  {{.Size}}  ({{.CreatedSince}})' | head -5
}

# ---------------------------------------------------------------------------
# Fișierul de stack al mediului.
#
# Producția folosește docker-stack.yml direct. Staging-ul are nevoie de o CHEIE
# de serviciu diferită, fiindcă `docker stack deploy` înregistrează pe rețea un
# alias egal cu cheia, iar `strawboss-net` e partajată de tot VM-ul: două
# servicii cu același alias înseamnă că nginx împarte traficul de producție
# între ele.
#
# Cheia NU se poate parametriza. Probat pe 2026-09-04, toate trei:
#   `${VAR}:` ca nume de serviciu → „Additional property ${…} is not allowed"
#     (schema Compose se validează ÎNAINTEA interpolării);
#   `networks.<net>.aliases` → aliasul scurt implicit se ADAUGĂ, nu se
#     înlocuiește: [administrativo-web-staging administrativo-web];
#   `extends` → „Support for `extends` is not implemented yet".
#
# Rămâne redenumirea printr-o substituție ancorată. Un `sed` care nu potrivește
# nimic ar produce TĂCUT exact coliziunea pe care o evităm — de aceea cele două
# gărzi de mai jos nu sunt decorative.
# ---------------------------------------------------------------------------
_genereaza_stack() {
  local sursa="$ADMINISTRATIVO_ROOT/docker-stack.yml"

  if [ "$ADM_MEDIU" = "productie" ]; then
    echo "$sursa"
    return 0
  fi

  local dest="$ADMINISTRATIVO_ROOT/.stack-${ADM_MEDIU}.generat.yml"
  sed "s|^  administrativo-web:\$|  ${ADM_SERVICE}:|" "$sursa" > "$dest"

  if ! grep -q "^  ${ADM_SERVICE}:\$" "$dest"; then
    error "Generarea stack-ului a eșuat: cheia ${ADM_SERVICE} nu apare în fișierul generat."
    error "Cel mai probabil serviciul a fost redenumit în docker-stack.yml."
    rm -f "$dest"
    exit 1
  fi

  if grep -q '^  administrativo-web:$' "$dest"; then
    error "Generarea stack-ului a eșuat: cheia de producție a rămas în fișierul generat."
    error "Ar înregistra un alias de rețea în coliziune cu producția."
    rm -f "$dest"
    exit 1
  fi

  echo "$dest"
}

# Poartă: codul nu pleacă peste o bază căreia îi lipsesc migrările lui.
#
# Deploy-ul nu aplică migrările (asta e `db:migrate`, cu confirmare), deci
# main poate fi oricând înaintea bazei de producție. Pe 23 oct 2026 era cu 29
# de migrări înainte (0192–0198 ale campaniei QA, plus lotul flotă–mentenanță),
# iar un deploy de rutină din altă sesiune ar fi rulat codul nou peste schema
# veche: 42703 pe coloane, P0001 pe triggere, ecrane goale. Pe staging poarta
# trece mereu, fiindcă workflow-ul rulează `db:migrate` chiar înainte.
#
# Corpul e un SUBSHELL, cu paranteze: parola bazei vine prin `_load_env_db`
# (pe producție, din `.env.local`), iar fișierul ăla are și `NEXT_PUBLIC_*` de
# dezvoltare. Încărcat în shell-ul deploy-ului, ar suprascrie valorile de
# producție chiar înainte de build, iar ele se coc în imagine.
_poarta_migrari_aplicate() (
  if [ "${ADM_FARA_POARTA_MIGRARI:-}" = "1" ]; then
    warn "Poarta migrărilor e sărită (ADM_FARA_POARTA_MIGRARI=1)."
    exit 0
  fi
  require_cmd psql
  _load_env_db
  # `|| exit`: un `exit` din `_db_url_sau_mori` iese doar din `$(...)`.
  local u; u=$(_db_url_sau_mori) || exit 1
  local aplicate
  aplicate=$(psql "$u" -tAc "select nume from internal.migrari_aplicate;") || {
    error "Nu pot citi registrul de migrări al mediului ${ADM_MEDIU} — refuz să fac deploy orbește."
    exit 1
  }
  local lipsa=() f n
  for f in "$ADMINISTRATIVO_ROOT"/supabase/migrations/*.sql; do
    n=$(basename "$f")
    grep -qxF "$n" <<<"$aplicate" || lipsa+=("$n")
  done
  if [ "${#lipsa[@]}" -gt 0 ]; then
    error "Baza mediului ${ADM_MEDIU} nu are ${#lipsa[@]} migrări de pe disc: codul nou ar rula peste schema veche."
    printf "     ${DIM}%s${NC}\n" "${lipsa[@]:0:12}" >&2
    [ "${#lipsa[@]}" -gt 12 ] && echo -e "     ${DIM}… și încă $(( ${#lipsa[@]} - 12 )).${NC}" >&2
    echo -e "     ${DIM}Întâi: ADM_MEDIU=${ADM_MEDIU} ./administrativo.sh db:migrate (cere confirmare), apoi deploy-ul.${NC}" >&2
    exit 1
  fi
  _ok "migrări pe baza țintă" "toate cele de pe disc sunt aplicate"
)

# @cmd stack:deploy "Build + rolling update health-gated al stack-ului"
cmd_stack__deploy() {
  header "Deploy stack '${ADM_STACK}'"
  require_cmd docker
  _load_env
  _validate_prod_env
  _poarta_migrari_aplicate || exit 1
  _ensure_swarm
  _build_image

  local fisier_stack; fisier_stack="$(_genereaza_stack)"
  _infol "fișier de stack" "$(basename "$fisier_stack")"

  info "Rolling update (start-first, health-gated, rollback automat)..."
  # --resolve-image never: pe un singur nod nu există registry, iar Swarm ar
  # încerca altfel să rezolve tagul într-un digest de la un registru inexistent
  # și ar eșua. _load_env a exportat deja variabilele pentru interpolare.
  IMAGE_TAG="$ADM_IMAGE_TAG" docker stack deploy \
    -c "$fisier_stack" \
    --resolve-image never \
    "$ADM_STACK"

  echo ""
  _wait_converged 240 || {
    error "Deploy neconvergent. Loguri: ./administrativo.sh stack:logs"
    return 1
  }

  # Verificare reală prin rețea, nu doar „Swarm zice că e sus". Din host nu se
  # poate: shell-ul e izolat de rețea și IP-urile Docker nu-s accesibile. Un
  # sidecar pe overlay e singurul test onest.
  echo ""
  info "Verific upstream-ul din interiorul rețelei..."
  local code
  code=$(docker run --rm --network "$ADM_OVERLAY" curlimages/curl:latest \
    -sS -m 10 -o /dev/null -w '%{http_code}' \
    "http://${ADM_SERVICE}:${ADM_PORT}/healthz" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    _ok "healthz prin overlay" "HTTP $code"
  else
    _fail "healthz prin overlay" "HTTP $code"
    warn "Serviciul e sus pentru Swarm, dar nu răspunde pe rețea."
  fi
}

# @cmd stack:status "Starea serviciilor și a task-urilor"
cmd_stack__status() {
  require_cmd docker
  if ! _stack_exists; then
    _infol "stack ${ADM_STACK}" "nu e deployat"
    return 0
  fi
  section "Servicii"
  docker stack services "$ADM_STACK"
  section "Task-uri"
  docker stack ps "$ADM_STACK" --no-trunc \
    --format 'table {{.Name}}\t{{.CurrentState}}\t{{.Error}}' 2>/dev/null | head -12
  section "Imagine activă"
  docker service inspect "$(_service_full)" \
    --format '  {{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null || true
}

# @cmd stack:logs "Urmărește logurile serviciului"
cmd_stack__logs() {
  require_cmd docker
  docker service logs -f --tail "${1:-100}" "$(_service_full)"
}

# @cmd stack:rollback "Revenire la imaginea anterioară"
cmd_stack__rollback() {
  header "Rollback ${ADM_STACK}"
  require_cmd docker
  _service_exists || { error "Serviciul nu există."; exit 1; }
  info "Imaginea curentă: $(docker service inspect "$(_service_full)" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')"
  docker service rollback "$(_service_full)"
  _wait_converged 180
}

# @cmd scale "Schimbă numărul de replici: ./administrativo.sh scale 3"
cmd_scale() {
  require_cmd docker
  local n="${1:?utilizare: scale <număr>}"
  docker service scale "$(_service_full)=${n}"
}

# @cmd stack:rm "Șterge stack-ul (edge-ul partajat rămâne)"
cmd_stack__rm() {
  header "Șterg stack-ul '${ADM_STACK}'"
  require_cmd docker
  confirm "Site-ul va da 502 până la următorul deploy. Continui?" || { info "Anulat."; return 0; }
  docker stack rm "$ADM_STACK"
  success "Stack șters."
}
