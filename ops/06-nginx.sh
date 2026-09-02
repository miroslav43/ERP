#!/usr/bin/env bash
# ============================================================================
# ops/06-nginx.sh — edge-ul partajat al VM-ului.
#
# ATENȚIE: `strawboss-nginx-1` e SINGURUL proces legat pe 80/443 și deservește
# TOATE site-urile de pe această mașină (nortiauno.com, buget.scoala-ai.ro,
# serafullautonoma.ro, serviceproof.ro, n8n..., plus al nostru). O greșeală aici
# nu strică doar ERP-ul — le pică pe toate. De aceea fiecare operațiune e
# precedată de verificări, iar containerul nu se repornește niciodată automat.
# ============================================================================

# @section "Nginx / SSL"

# Trimite vhost-ul spre serviciul nostru? (folosit de `prod` ca avertisment)
_vhost_points_to_app() {
  grep -q "${ADM_SERVICE}:${ADM_PORT}" "${ADM_NGINX_CONFD}/${ADM_VHOST}" 2>/dev/null
}

# --- Verificarea care previne o cădere totală -------------------------------
# nginx bind-montează directorul conf.d de pe host. Dacă inode-ul acelui DIRECTOR
# e înlocuit cât timp containerul rulează (rm -rf + mkdir, un git checkout, un
# editor care rescrie directorul), montarea devine STALE: înăuntru /etc/nginx/conf.d
# apare GOL, deși pe host e plin. nginx continuă să servească din configul din
# memorie — până la primul `nginx -s reload`, care recitește directorul gol,
# încarcă ZERO server-blocks, nu mai ascultă pe 80/443 și lasă fără serviciu
# fiecare site de pe VM.
#
# Capcana: `nginx -t` TRECE, fiindcă un config gol e valid. Garda obișnuită nu
# prinde problema. Singurul test corect e să compari numărul de fișiere .conf
# de pe host cu cel din container.
_nginx_mount_live() {
  local host_n cont_n
  host_n=$(ls -1 "${ADM_NGINX_CONFD}"/*.conf 2>/dev/null | wc -l | tr -d ' ')
  cont_n=$(docker exec "$ADM_NGINX" sh -c 'ls -1 /etc/nginx/conf.d/*.conf 2>/dev/null | wc -l' 2>/dev/null | tr -d ' ')
  [ "${cont_n:-0}" -gt 0 ] && [ "${cont_n:-0}" -eq "${host_n:-0}" ]
}

# @cmd nginx:check "Preflight edge: montare, porturi, site-uri, config"
cmd_nginx__check() {
  header "Verificare nginx partajat"
  require_cmd docker

  if ! docker ps --format '{{.Names}}' | grep -q "^${ADM_NGINX}$"; then
    _fail "container ${ADM_NGINX}" "NU RULEAZĂ — toate site-urile sunt jos"
    return 1
  fi
  _ok "container" "$(docker ps --filter "name=^${ADM_NGINX}$" --format '{{.Status}}')"

  local host_n cont_n
  host_n=$(ls -1 "${ADM_NGINX_CONFD}"/*.conf 2>/dev/null | wc -l | tr -d ' ')
  cont_n=$(docker exec "$ADM_NGINX" sh -c 'ls -1 /etc/nginx/conf.d/*.conf 2>/dev/null | wc -l' 2>/dev/null | tr -d ' ')
  if _nginx_mount_live; then
    _ok "montare conf.d" "$cont_n fișiere (host: $host_n)"
  else
    _fail "montare conf.d" "container: $cont_n, host: $host_n — STALE"
    error "NU da reload. Un reload acum ar încărca zero site-uri și ar pica tot VM-ul."
    error "Recuperare: docker restart ${ADM_NGINX} (verifică întâi că toate certificatele există)."
    return 1
  fi

  # Alpine n-are ss/netstat — porturile se citesc din /proc/net/tcp (hex).
  local ports
  ports=$(docker exec "$ADM_NGINX" sh -c 'cat /proc/net/tcp /proc/net/tcp6 2>/dev/null' \
          | awk '$4=="0A"{n=split($2,p,":"); print p[n]}' | sort -u \
          | while read -r h; do printf '%d\n' "0x$h"; done | sort -un)
  echo "$ports" | grep -qx 80  && _ok "port 80"  "ascultă" || _fail "port 80"  "LIPSEȘTE"
  echo "$ports" | grep -qx 443 && _ok "port 443" "ascultă" || _fail "port 443" "LIPSEȘTE"

  section "Site-uri încărcate"
  docker exec "$ADM_NGINX" sh -c 'nginx -T 2>/dev/null' \
    | awk '/^[[:space:]]*server_name/{sub(/;.*/,""); sub(/^[[:space:]]*server_name[[:space:]]+/,""); print "    "$0}' \
    | sort -u

  section "Test configurație"
  docker exec "$ADM_NGINX" nginx -t
}

# @cmd nginx:reload "Reload în siguranță (preflight + nginx -t + reload)"
cmd_nginx__reload() {
  header "Reload nginx"
  require_cmd docker

  if ! _nginx_mount_live; then
    error "Montarea conf.d e stale — reload REFUZAT (ar pica toate site-urile)."
    error "Rulează ./administrativo.sh nginx:check pentru detalii."
    exit 1
  fi
  _ok "montare conf.d" "live"

  docker exec "$ADM_NGINX" nginx -t || { error "Config invalid — nu dau reload."; exit 1; }
  _ok "nginx -t" "valid"

  docker exec "$ADM_NGINX" nginx -s reload
  success "Reload făcut."
}

# @cmd nginx:vhost "Instalează vhost-ul administrativo.ro → aplicație (cu backup)"
cmd_nginx__vhost() {
  header "Instalez vhost-ul pentru ${ADM_DOMAIN}"
  require_cmd docker

  local dest="${ADM_NGINX_CONFD}/${ADM_VHOST}"
  local sursa="${ADMINISTRATIVO_ROOT}/deploy/nginx/${ADM_VHOST}"
  [ -f "$sursa" ] || { error "Lipsește șablonul: $sursa"; exit 1; }

  if ! _nginx_mount_live; then
    error "Montarea conf.d e stale — nu ating nimic."
    exit 1
  fi

  # Certificatul trebuie să existe ÎNAINTE de a instala un bloc `listen 443 ssl`
  # care îl referă: un ssl_certificate lipsă face nginx să nu mai PORNEASCĂ
  # (crash-loop), ceea ce e mai rău decât un reload eșuat.
  if ! docker exec "$ADM_NGINX" test -f "/etc/letsencrypt/live/${ADM_DOMAIN}/fullchain.pem"; then
    error "Certificatul pentru ${ADM_DOMAIN} lipsește din volum."
    error "Emite-l întâi: ./administrativo.sh ssl:issue"
    exit 1
  fi
  _ok "certificat" "prezent pentru ${ADM_DOMAIN}"

  # Backup: al fișierului (revenire instant) și al întregului director.
  #
  # Backup-ul se rescrie la FIECARE instalare, intenționat. Până la 2026-09-03
  # condiția era `[ ! -f "$bak" ]`, adică se salva o singură dată, prima —
  # backup-ul rămânea înghețat pe configurația Eduvora de dinaintea preluării
  # domeniului. Consecința: dacă a doua instalare pica la `nginx -t`, „revenirea
  # la varianta anterioară" de mai jos restaura un vhost vechi de săptămâni,
  # care trimitea spre un serviciu systemd oprit între timp. Un rollback care
  # repară testul și strică site-ul e mai rău decât niciun rollback.
  local bak="${dest}.anterior.bak"
  if [ -f "$dest" ]; then
    cp "$dest" "$bak"
    _ok "backup vhost" "$(basename "$bak")"
  fi
  local snap="/tmp/confd-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
  tar czf "$snap" -C "$(dirname "$ADM_NGINX_CONFD")" "$(basename "$ADM_NGINX_CONFD")" 2>/dev/null
  _ok "snapshot conf.d" "$snap"

  # Scriere IN-PLACE (`cat >`), nu mv/rm: înlocuirea fișierului e inofensivă, dar
  # atingerea inode-ului DIRECTORULUI ar face montarea stale (vezi comentariul de
  # la _nginx_mount_live).
  cat "$sursa" > "$dest"
  _ok "vhost scris" "$dest"

  docker exec "$ADM_NGINX" nginx -t || {
    error "Config invalid — REVIN la varianta anterioară."
    if [ -f "$bak" ]; then
      cat "$bak" > "$dest"
    else
      # Prima instalare: nu există „anterior". Fișierul nou e singurul vinovat,
      # deci se scoate de tot — altfel rămâne pe disc un config invalid, iar
      # următorul reload al ORICUI de pe VM eșuează.
      rm -f "$dest"
      warn "Nu exista backup (prima instalare) — am șters vhost-ul invalid."
    fi
    exit 1
  }
  _ok "nginx -t" "valid"

  docker exec "$ADM_NGINX" nginx -s reload
  success "Vhost activ — ${ADM_DOMAIN} trimite acum spre ${ADM_SERVICE}:${ADM_PORT}."
}

# @cmd nginx:restore "Revenire la vhost-ul instalat anterior"
cmd_nginx__restore() {
  header "Revenire vhost ${ADM_DOMAIN}"
  local dest="${ADM_NGINX_CONFD}/${ADM_VHOST}"
  local bak="${dest}.anterior.bak"
  [ -f "$bak" ] || { error "Nu există backup ($(basename "$bak"))."; exit 1; }

  # Scriere in-place, ca la instalare: `mv`/`rm` ar atinge inode-ul directorului
  # și ar face montarea conf.d stale pentru tot VM-ul.
  cat "$bak" > "$dest"
  docker exec "$ADM_NGINX" nginx -t && docker exec "$ADM_NGINX" nginx -s reload
  success "Vhost revenit la versiunea anterioară."
}

# @cmd ssl:status "Certificatele din volum și expirarea lor"
cmd_ssl__status() {
  header "Certificate Let's Encrypt"
  require_cmd docker
  docker exec "$ADM_NGINX" sh -c 'ls -1 /etc/letsencrypt/live 2>/dev/null' \
  | grep -v README | while read -r d; do
      [ -z "$d" ] && continue
      local_end=$(docker exec "$ADM_NGINX" sh -c \
        "openssl x509 -noout -enddate -in /etc/letsencrypt/live/$d/fullchain.pem 2>/dev/null" \
        | cut -d= -f2)
      if [ "$d" = "$ADM_DOMAIN" ]; then
        printf "  ${OK}  ${BOLD}%-38s${NC} %s\n" "$d" "$local_end"
      else
        printf "  ${DOT}  %-38s %s\n" "$d" "$local_end"
      fi
    done
}

# @cmd ssl:issue "Emite/reînnoiește certificatul pentru administrativo.ro"
cmd_ssl__issue() {
  header "Emitere certificat"
  require_cmd docker
  local email="${CERTBOT_EMAIL:-maleticimiroslavzvonco@gmail.com}"

  warn "Let's Encrypt limitează eșecurile la 5/oră. Blocul :80 cu ACME trebuie să fie deja activ."
  confirm "Emit certificat pentru ${ADM_DOMAIN} + www?" || { info "Anulat."; return 0; }

  # `--entrypoint certbot` e OBLIGATORIU: entrypoint-ul serviciului e o buclă
  # `certbot renew; sleep 12h`. Fără suprascriere, argumentele `certonly ...`
  # sunt ignorate, bucla pornește și comanda atârnă la nesfârșit fără să emită.
  docker compose --project-directory "$ADM_STRAWBOSS_ROOT" run --rm \
    --entrypoint certbot certbot \
    certonly --webroot -w /var/www/certbot \
    -d "$ADM_DOMAIN" -d "www.${ADM_DOMAIN}" \
    --agree-tos --no-eff-email --non-interactive -m "$email"

  success "Certificat emis. Acum: ./administrativo.sh nginx:reload"
}
