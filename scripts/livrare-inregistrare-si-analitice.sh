#!/usr/bin/env bash
# Pornirea celor două lucruri care ating producția în livrarea de față:
#
#   1. migrarea 0121 — fără ea, /inregistrare dă eroare internă;
#   2. Umami pe analitice.administrativo.ro — măsurare fără cookie-uri.
#
#   bash scripts/livrare-inregistrare-si-analitice.sh
#
# Se poate rula de mai multe ori: fiecare pas verifică întâi dacă e deja făcut.
#
# ── DE CE NU `db:migrate` ───────────────────────────────────────────────────
# `db:migrate` aplică TOT ce e în așteptare. La scrierea scriptului, pe disc mai
# era și `0122_push_dispozitive.sql`, netracked — o migrare la care lucra altă
# sesiune, în acel moment. Scriptul aplică 0121 PE NUME, prin `aplica-cloud.sh`,
# și refuză să atingă altceva.
#
# ── ORDINEA CARE NU E NEGOCIABILĂ ───────────────────────────────────────────
# Certificatul se emite ÎNAINTE de a instala vhost-ul. Blocul `listen 443 ssl`
# referă un fișier care încă nu există, iar un `ssl_certificate` lipsă face nginx
# să nu mai PORNEASCĂ — crash-loop, adică toate cele nouă site-uri de pe VM cad,
# nu doar rămân la configurația veche. Vezi nota din `ops/06-nginx.sh`.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 3

MIGRARE="supabase/migrations/0121_inregistrare_publica.sql"
SUBDOMENIU="analitice.administrativo.ro"
NGINX="strawboss-nginx-1"
CONFD="/srv/apps/Strawboss/nginx/conf.d"
VHOST="31-${SUBDOMENIU}.conf"
STRAWBOSS="/srv/apps/Strawboss"

V='\033[0;32m'; G='\033[0;33m'; R='\033[0;31m'; D='\033[2m'; N='\033[0m'
pas()  { printf "\n${N}▶ %s${N}\n" "$1"; }
ok()   { printf "  ${V}✓${N} %s\n" "$1"; }
sar()  { printf "  ${D}· %s (deja făcut)${N}\n" "$1"; }
avert(){ printf "  ${G}!${N} %s\n" "$1"; }
mor()  { printf "  ${R}✗ %s${N}\n" "$1"; exit 1; }

# ── 0. Verificări înainte de a atinge ceva ──────────────────────────────────
pas "Verific mediul"
[ -f "$MIGRARE" ]        || mor "lipsește $MIGRARE"
[ -f .env.local ]        || mor "lipsește .env.local (parola bazei)"
[ -f .env.production ]   || mor "lipsește .env.production (secretele Umami)"
[ -d "$CONFD" ]          || mor "nu găsesc $CONFD"
[ -w "$CONFD" ]          || mor "nu pot scrie în $CONFD"
command -v psql >/dev/null || mor "psql nu e în PATH"
docker ps --format '{{.Names}}' | grep -q "^${NGINX}$" || mor "containerul $NGINX nu rulează"

PAROLA="$(grep -m1 '^SUPABASE_DB_PASSWORD=' .env.local | cut -d= -f2- | tr -d '\r\n"')"
[ -n "$PAROLA" ] || mor "SUPABASE_DB_PASSWORD lipsește din .env.local"
GAZDA="${ADMINISTRATIVO_DB_HOST:-aws-1-eu-west-1.pooler.supabase.com}"
UTILIZATOR="${ADMINISTRATIVO_DB_USER:-postgres.nybmhorngsajoqaxjlbr}"
psqlc() { PGPASSWORD="$PAROLA" psql -h "$GAZDA" -p 5432 -U "$UTILIZATOR" -d postgres "$@"; }
ok "mediu complet"

# ── 1. Migrarea ─────────────────────────────────────────────────────────────
pas "Migrarea 0121 — înregistrarea self-serve"
NUME="$(basename "$MIGRARE")"
SUMA="$(sha256sum "$MIGRARE" | cut -c1-16)"

if psqlc -tAc "select 1 from internal.migrari_aplicate where nume = '${NUME}'" | grep -q 1; then
  sar "0121 e deja în registru"
else
  ADMINISTRATIVO_PSQL=psql bash .claude/skills/administrativo/scripts/aplica-cloud.sh "$MIGRARE" \
    || mor "migrarea a picat — NIMIC din ce urmează nu s-a atins"
  # `aplica-cloud.sh` aplică fișierul, dar NU scrie în registru. O migrare
  # neînregistrată e reaplicată de `db:migrate` la următoarea rulare.
  psqlc -q -c "insert into internal.migrari_aplicate (nume, suma) values ('${NUME}', '${SUMA}')
               on conflict (nume) do nothing;"
  ok "aplicată și înregistrată (suma ${SUMA})"
fi

# Proba: funcția există și e apelabilă de anon.
psqlc -tAc "select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='public' and p.proname='inregistreaza_organizatie'" | grep -q 1 \
  || mor "funcția inregistreaza_organizatie NU există după migrare"
ok "funcția există în bază"

# ── 2. Certificatul — ÎNAINTE de vhost ──────────────────────────────────────
pas "Certificatul pentru ${SUBDOMENIU}"
if docker exec "$NGINX" test -f "/etc/letsencrypt/live/${SUBDOMENIU}/fullchain.pem" 2>/dev/null; then
  sar "certificatul există deja"
else
  # Merge fără vhost: nginx n-are `default_server`, deci gazda nepotrivită cade
  # pe primul bloc `:80` încărcat, care servește deja /.well-known/acme-challenge/.
  docker compose --project-directory "$STRAWBOSS" run --rm \
    --entrypoint certbot certbot \
    certonly --webroot -w /var/www/certbot \
    -d "$SUBDOMENIU" \
    --agree-tos --no-eff-email --non-interactive -m contact@administrativo.ro \
    || mor "certbot a picat — vhost-ul NU se instalează fără certificat"
  docker exec "$NGINX" test -f "/etc/letsencrypt/live/${SUBDOMENIU}/fullchain.pem" \
    || mor "certbot a ieșit cu 0, dar certificatul nu e în volum"
  ok "certificat emis"
fi

# ── 3. Stack-ul Umami ───────────────────────────────────────────────────────
pas "Stack-ul Umami"
set -a; . ./.env.production; set +a
[ -n "${UMAMI_DB_PASSWORD:-}" ] || mor "UMAMI_DB_PASSWORD lipsește din .env.production"
[ -n "${UMAMI_APP_SECRET:-}" ]  || mor "UMAMI_APP_SECRET lipsește din .env.production"

docker stack deploy -c deploy/umami/docker-stack.yml umami || mor "deploy-ul stack-ului a picat"
ok "stack trimis către Swarm"

printf "  ${D}aștept serviciile"
for _ in $(seq 1 60); do
  GATA="$(docker service ls --filter name=umami --format '{{.Replicas}}' | grep -c '^1/1$' || true)"
  [ "$GATA" = "2" ] && break
  printf "."; sleep 5
done
printf "${N}\n"
docker service ls --filter name=umami --format '  {{.Name}}  {{.Replicas}}'
[ "${GATA:-0}" = "2" ] || avert "serviciile nu sunt încă 1/1 — prima pornire își face schema, poate dura"

# ── 4. Vhost-ul, cu `nginx -t` ca poartă ────────────────────────────────────
pas "Vhost-ul"
if cmp -s "deploy/nginx/${VHOST}" "${CONFD}/${VHOST}" 2>/dev/null; then
  sar "vhost-ul e deja instalat și identic"
else
  [ -f "${CONFD}/${VHOST}" ] && cp "${CONFD}/${VHOST}" "${CONFD}/${VHOST}.anterior.bak"
  cp "deploy/nginx/${VHOST}" "${CONFD}/${VHOST}"
  ok "copiat în ${CONFD}"

  if ! docker exec "$NGINX" nginx -t 2>&1 | tee /tmp/nginx-t.log | grep -q "test is successful"; then
    cat /tmp/nginx-t.log
    rm -f "${CONFD}/${VHOST}"
    [ -f "${CONFD}/${VHOST}.anterior.bak" ] && mv "${CONFD}/${VHOST}.anterior.bak" "${CONFD}/${VHOST}"
    mor "nginx -t a picat — am dat înapoi vhost-ul, nginx rămâne pe configurația veche"
  fi
  ok "nginx -t trecut"
  docker exec "$NGINX" nginx -s reload || mor "reload eșuat"
  ok "nginx reîncărcat"
fi

# ── 5. Proba finală ─────────────────────────────────────────────────────────
pas "Verificare"
COD="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://${SUBDOMENIU}/" || echo "000")"
case "$COD" in
  200|302|307) ok "https://${SUBDOMENIU} răspunde ($COD)" ;;
  *) avert "https://${SUBDOMENIU} a răspuns $COD — dacă Umami încă pornește, mai încearcă în două minute" ;;
esac

printf "\n${V}Gata.${N} Mai rămâne un pas, care cere ochii tăi:\n"
printf "  1. deschide ${D}https://${SUBDOMENIU}${N} — utilizator ${D}admin${N}, parolă ${D}umami${N}\n"
printf "  2. SCHIMBĂ PAROLA\n"
printf "  3. Settings → Websites → Add website, domeniul ${D}administrativo.ro${N}\n"
printf "  4. copiază Website ID și dă-mi-l: îl pun în .env.production și refac imaginea\n"
printf "     (NEXT_PUBLIC_UMAMI_* se coc la build, nu la pornire)\n\n"
