#!/usr/bin/env bash
# scripts/checks/nginx-jurnale-unelte.sh
#
# Poarta pentru jurnalele nginx: ce scrie un vizitator într-o unealtă gratuită
# nu ajunge în jurnalele serverului.
#
# ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
# Formularele uneltelor sunt GET, deci numele angajaților, firma și salariul
# stau în adresă. Până la 8 oct 2026, `log_format durate` și `main` scriau
# `"$request"` — adică adresa cu tot cu valori — în /var/log/nginx/administrativo.log
# și în jurnalul docker al edge-ului (fără plafon de mărime). Același lucru
# pentru `error_log`, care scrie `request: "GET …?angajati=…"` la orice 502.
#
# ── CUM ────────────────────────────────────────────────────────────────────
# Pornește un nginx EFEMER, din aceeași imagine ca edge-ul (ID-ul ei, nu eticheta),
# cu vhost-urile din repo și certificate autosemnate, într-o rețea docker
# proprie (ca `resolver 127.0.0.11` să răspundă repede „Host not found” →
# 502, nu să aștepte 30 s). Trimite cereri cu marcaj și citește jurnalele.
# Edge-ul real NU e atins: niciun fișier din /srv/apps/Strawboss, niciun reload.
#
# Utilizare:  bash scripts/checks/nginx-jurnale-unelte.sh
#             ADM_VHOSTURI=<director> pentru alt director decât deploy/nginx.
set -euo pipefail

RADACINA="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VHOSTURI="${ADM_VHOSTURI:-$RADACINA/deploy/nginx}"
NUME="adm-poarta-jurnale-$$"
PORT_HTTPS=18443
PORT_HTTP=18080
MARCAJ="Zzjurnal"
# Imaginea EXACTĂ a edge-ului, nu eticheta `nginx:alpine`: eticheta se mută la
# fiecare `docker pull` (pe 8 oct 2026, local era deja nginx/1.31.5, iar edge-ul
# rula 1.29.7). Fără edge pe mașină (alt calculator), se cade pe etichetă și se
# spune asta.
IMAGINE="${ADM_IMAGINE_NGINX:-$(docker inspect strawboss-nginx-1 --format '{{.Image}}' 2>/dev/null || true)}"
if [ -z "$IMAGINE" ]; then
  IMAGINE="nginx:alpine"
  echo "  (edge-ul strawboss-nginx-1 nu e pe mașină: rulez pe nginx:alpine, care poate fi altă versiune)" >&2
fi
LUCRU="$(mktemp -d)"

curata() {
  docker rm -f "$NUME" >/dev/null 2>&1 || true
  docker network rm "$NUME-net" >/dev/null 2>&1 || true
  rm -rf "$LUCRU"
}
trap curata EXIT

mkdir -p "$LUCRU/conf.d"
cp "$VHOSTURI/30-administrativo.ro.conf" "$VHOSTURI/32-staging.administrativo.ro.conf" "$LUCRU/conf.d/"
: > "$LUCRU/conf.d/.htpasswd-staging"
for domeniu in administrativo.ro staging.administrativo.ro; do
  mkdir -p "$LUCRU/le/live/$domeniu"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 -subj "/CN=$domeniu" \
    -keyout "$LUCRU/le/live/$domeniu/privkey.pem" \
    -out "$LUCRU/le/live/$domeniu/fullchain.pem" 2>/dev/null
done
chmod -R a+rX "$LUCRU"

docker network create "$NUME-net" >/dev/null
docker run -d --name "$NUME" --network "$NUME-net" \
  -p "127.0.0.1:$PORT_HTTPS:443" -p "127.0.0.1:$PORT_HTTP:80" \
  -v "$LUCRU/conf.d:/etc/nginx/conf.d:ro" -v "$LUCRU/le:/etc/letsencrypt:ro" \
  "$IMAGINE" >/dev/null
sleep 1
docker exec "$NUME" nginx -v
docker exec "$NUME" nginx -t

cere() { # cere <cale> [antet]
  local argumente=(-sk -m 10 -o /dev/null --resolve "administrativo.ro:$PORT_HTTPS:127.0.0.1")
  [ $# -ge 2 ] && argumente+=(-H "$2")
  curl "${argumente[@]}" "https://administrativo.ro:$PORT_HTTPS$1" || true
}
cere "/unelte/foaie-de-pontaj?luna=10&an=2026&angajati=$MARCAJ+Popescu%0D%0A$MARCAJ+Ionescu" \
  "Referer: https://administrativo.ro/unelte/condica-de-prezenta?firma=$MARCAJ+Firma"
cere "/api/unelte/foaie-de-parcurs?sofer=$MARCAJ+Sofer&format=pdf&firma=$MARCAJ"
cere "/api/unelte/cerere-concediu?format=docx"
cere "/unelte?x=$MARCAJ"
cere "/preturi?utm_source=poarta" "Referer: https://administrativo.ro/unelte/calculator-salariu?suma=$MARCAJ"
curl -s -m 5 -o /dev/null --resolve "administrativo.ro:$PORT_HTTP:127.0.0.1" \
  "http://administrativo.ro:$PORT_HTTP/unelte/fisa-evaluare?nume=$MARCAJ" || true
sleep 1

JURNAL_DOCKER="$(docker logs "$NUME" 2>&1)"
JURNAL_DURATE="$(docker exec "$NUME" cat /var/log/nginx/administrativo.log)"
politica() {
  curl -skI -m 10 --resolve "administrativo.ro:$PORT_HTTPS:127.0.0.1" "https://administrativo.ro:$PORT_HTTPS$1" \
    | tr -d '\r' | awk -F': ' 'tolower($1)=="referrer-policy"{print $2}'
}

probleme=0
cere_ca() { # cere_ca <descriere> <condiție-bash>
  if eval "$2"; then echo "  ✓ $1"; else echo "  ✗ $1" >&2; probleme=$((probleme + 1)); fi
}
ACCES_DOCKER="$(grep -v '\[error\]\|\[crit\]\|\[warn\]\|\[notice\]\|docker-entrypoint\|^/docker' <<<"$JURNAL_DOCKER" || true)"
EROARE_UNELTE="$(grep '\[error\]' <<<"$JURNAL_DOCKER" | grep 'request: "GET /\(api/\)\{0,1\}unelte' || true)"

cere_ca "jurnalul de acces (docker, adm_main) fără marcaj" '! grep -q "$MARCAJ" <<<"$ACCES_DOCKER"'
cere_ca "administrativo.log (durate) fără marcaj" '! grep -q "$MARCAJ" <<<"$JURNAL_DURATE"'
cere_ca "error_log fără cererile uneltelor" '[ -z "$EROARE_UNELTE" ]'
cere_ca "unealta apare, fără argumente" 'grep -q "\"GET /unelte/foaie-de-pontaj HTTP/2.0\"" <<<"$JURNAL_DURATE"'
cere_ca "descărcarea își păstrează formatul" 'grep -q "\"GET /api/unelte/foaie-de-parcurs?format=pdf HTTP/2.0\"" <<<"$JURNAL_DURATE"'
cere_ca "restul sitului își păstrează query string-ul" 'grep -q "\"GET /preturi?utm_source=poarta HTTP/2.0\"" <<<"$JURNAL_DURATE"'
cere_ca "Referer-ul e scris fără argumente" 'grep -q "\"https://administrativo.ro/unelte/condica-de-prezenta\"" <<<"$ACCES_DOCKER"'
cere_ca "Referrer-Policy strict-origin pe /unelte/*" '[ "$(politica /unelte/foaie-de-pontaj)" = "strict-origin" ]'
cere_ca "Referrer-Policy strict-origin pe /unelte" '[ "$(politica /unelte)" = "strict-origin" ]'
cere_ca "Referrer-Policy neschimbată în rest" '[ "$(politica /preturi)" = "strict-origin-when-cross-origin" ]'

if [ "$probleme" -gt 0 ]; then
  echo "" >&2
  echo "nginx-jurnale-unelte: $probleme verificări au căzut. Jurnalul docker:" >&2
  echo "$JURNAL_DOCKER" | tail -20 >&2
  exit 1
fi
echo "nginx-jurnale-unelte: jurnalele nu păstrează valorile din unelte."
