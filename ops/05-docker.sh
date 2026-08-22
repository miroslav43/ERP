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

  # Cele trei NEXT_PUBLIC_* se dau ca build args fiindcă `next build` le
  # înlocuiește textual în bundle-ul de client. Variabilele de server NU se dau:
  # Dockerfile folosește placeholdere doar cât să treacă validarea Zod, iar
  # valorile reale ajung la runtime prin docker-stack.yml. Așa niciun secret nu
  # intră în vreun layer, nici măcar în cel aruncat.
  docker build \
    --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
    --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
    --build-arg NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL" \
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

# @cmd stack:deploy "Build + rolling update health-gated al stack-ului"
cmd_stack__deploy() {
  header "Deploy stack '${ADM_STACK}'"
  require_cmd docker
  _load_env
  _validate_prod_env
  _ensure_swarm
  _build_image

  info "Rolling update (start-first, health-gated, rollback automat)..."
  # --resolve-image never: pe un singur nod nu există registry, iar Swarm ar
  # încerca altfel să rezolve tagul într-un digest de la un registru inexistent
  # și ar eșua. _load_env a exportat deja variabilele pentru interpolare.
  IMAGE_TAG="$ADM_IMAGE_TAG" docker stack deploy \
    -c "$ADMINISTRATIVO_ROOT/docker-stack.yml" \
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
