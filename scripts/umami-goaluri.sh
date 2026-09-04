#!/usr/bin/env bash
# Creează goal-urile și pâlniile în Umami, prin API-ul oficial.
#
# Utilizare:
#   UMAMI_ADMIN_PAROLA='...' bash scripts/umami-goaluri.sh
#
# ── DE CE PRIN API ȘI NU PRIN SQL ─────────────────────────────────────────────
# Rândurile din tabela `report` s-ar putea insera direct, și ar apărea în
# interfață. Dar forma coloanei `parameters` e un contract intern al aplicației:
# la primul update de Umami care o schimbă, rapoartele scrise de mână se rup
# tăcut — arată în listă și nu mai calculează nimic. Prin API, validarea Zod a
# aplicației le respinge ACUM dacă forma e greșită, ceea ce e exact ce vrei.
#
# ── DE UNDE VIN FORMELE ───────────────────────────────────────────────────────
# Citite din build-ul containerului (Umami 3.3.1), nu din documentația v2, care
# descrie altă schemă:
#   goal   → parameters { startDate, endDate, type, value }
#   funnel → parameters { startDate, endDate, window, steps[{type,value,filters}] }
# `type` ia „path" sau „event"; `window` e fereastra pâlniei, în ore.
#
# Scriptul e idempotent după NUME: ce există deja nu se recreează.
set -euo pipefail

GAZDA="${UMAMI_GAZDA:-https://analitice.administrativo.ro}"
UTILIZATOR="${UMAMI_ADMIN_UTILIZATOR:-admin}"
SITE="${UMAMI_SITE_ID:-cac2bd93-b2c5-46a3-997f-707c0851841d}"
# Fereastra pe care o deschid rapoartele. Interfața o poate schimba la vizualizare.
DE_LA="${UMAMI_DE_LA:-2026-09-01T00:00:00.000Z}"
PANA_LA="${UMAMI_PANA_LA:-2027-09-01T00:00:00.000Z}"
FEREASTRA_PALNIE="${UMAMI_FEREASTRA:-24}"

D=$'\e[1m'; N=$'\e[0m'; R=$'\e[31m'; V=$'\e[32m'
mor() { printf "${R}✗ %s${N}\n" "$*" >&2; exit 1; }

# Parola se ia din `.env.production` dacă nu vine din mediu.
#
# Se citește cu `grep`, nu cu `source`: fișierul are zeci de variabile, iar un
# `source` le-ar aduce pe toate în shell — inclusiv chei de service_role — ca
# apoi să fie moștenite de orice proces pornit de aici. Un script care are nevoie
# de un singur secret nu are voie să le încarce pe toate.
if [ -z "${UMAMI_ADMIN_PAROLA:-}" ] && [ -f .env.production ]; then
  UMAMI_ADMIN_PAROLA="$(grep -m1 '^UMAMI_ADMIN_PAROLA=' .env.production | cut -d= -f2- | sed 's/^"\(.*\)"$/\1/; s/^'"'"'\(.*\)'"'"'$/\1/')"
fi

[ -n "${UMAMI_ADMIN_PAROLA:-}" ] || mor "UMAMI_ADMIN_PAROLA lipsește — nici din mediu, nici din .env.production"
command -v jq >/dev/null || mor "jq nu e instalat"

printf "${D}1. autentificare${N} — %s ca %s\n" "$GAZDA" "$UTILIZATOR"
RASPUNS="$(curl -sS --max-time 25 -X POST "$GAZDA/api/auth/login" \
  -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg u "$UTILIZATOR" --arg p "$UMAMI_ADMIN_PAROLA" '{username:$u,password:$p}')")" \
  || mor "cererea de autentificare a eșuat"

TOKEN="$(printf '%s' "$RASPUNS" | jq -r '.token // empty')"
[ -n "$TOKEN" ] || mor "autentificare respinsă: $(printf '%s' "$RASPUNS" | head -c 200)"
printf "   ${V}✓${N} token obținut\n\n"

api() { curl -sS --max-time 25 -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' "$@"; }

# `websiteId` e OBLIGATORIU la GET, deși la POST vine în corp. Fără el, ruta
# întoarce 400, iar un `jq` peste eroare produce lista goală — adică exact
# aparența unui site fără rapoarte. Prima rulare a scriptului a raportat „gata"
# cu lista de verificare goală din motivul ăsta, deși cele opt erau create.
LISTA="$GAZDA/api/reports?websiteId=$SITE&pageSize=200"

printf "${D}2. ce există deja${N}\n"
EXISTENTE="$(api "$LISTA" | jq -r '(.data // [])[].name' 2>/dev/null || true)"
if [ -z "$EXISTENTE" ]; then printf "   (niciun raport)\n\n"; else printf '%s\n' "$EXISTENTE" | sed 's/^/   · /'; printf '\n'; fi

creeaza() {
  local nume="$1" tip="$2" descriere="$3" parametri="$4"
  if printf '%s\n' "$EXISTENTE" | grep -Fxq "$nume"; then
    printf "   ${D}=${N} %-42s există deja, sar\n" "$nume"; return 0
  fi
  local corp cod
  corp="$(jq -nc --arg w "$SITE" --arg n "$nume" --arg t "$tip" --arg d "$descriere" \
    --argjson p "$parametri" '{websiteId:$w,name:$n,type:$t,description:$d,parameters:$p}')"
  cod="$(api -o /tmp/umami-raspuns.json -w '%{http_code}' -X POST "$GAZDA/api/reports" --data "$corp")"
  if [ "$cod" = "200" ] || [ "$cod" = "201" ]; then
    printf "   ${V}+${N} %-42s creat\n" "$nume"
  else
    printf "   ${R}✗${N} %-42s HTTP %s — %s\n" "$nume" "$cod" "$(head -c 160 /tmp/umami-raspuns.json)"
  fi
}

# ── Goal-uri ────────────────────────────────────────────────────────────────
# Ordinea nu e întâmplătoare: primul e singurul care măsoară bani, restul măsoară
# drumul până la el.
printf "${D}3. goal-uri${N}\n"

g() { jq -nc --arg s "$DE_LA" --arg e "$PANA_LA" --arg t "$1" --arg v "$2" \
      '{startDate:$s,endDate:$e,type:$t,value:$v}'; }

creeaza "Conturi create"                 goal \
  "Formularul de înregistrare trimis cu succes. Singura conversie reală." \
  "$(g event inregistrare-trimisa)"

creeaza "Click pe CTA din erou"          goal \
  "Butonul principal de pe pagina de start. Raportat la vizite, dă rata de intenție." \
  "$(g event cta-erou)"

creeaza "Descărcări foaie de pontaj"     goal \
  "Exportul în Excel al uneltei gratuite. Măsoară dacă momeala prinde." \
  "$(g event foaie-excel)"

creeaza "CTA de pe paginile de lege"     goal \
  "Click pe Creează cont de pe art. 119, REGES sau ghidul ITM. Răspunde dacă traficul legislativ convertește sau doar citește." \
  "$(g event cta-pagina-lege)"

creeaza "Vizite pe pagina de prețuri"    goal \
  "Vizitarea /preturi. Cel mai bun semnal de intenție care nu cere un click pe buton." \
  "$(g path /preturi)"

# ── Pâlnii ──────────────────────────────────────────────────────────────────
printf "\n${D}4. pâlnii${N}\n"

p() { jq -nc --arg s "$DE_LA" --arg e "$PANA_LA" --argjson w "$FEREASTRA_PALNIE" --argjson st "$1" \
      '{startDate:$s,endDate:$e,window:$w,steps:$st}'; }

creeaza "Drumul clasic: start → preț → cont" funnel \
  "Cât se pierde între pagina de start, prețuri și contul creat." \
  "$(p '[{"type":"path","value":"/","filters":[]},{"type":"path","value":"/preturi","filters":[]},{"type":"event","value":"inregistrare-trimisa","filters":[]}]')"

creeaza "Din unealta gratuită în cont"      funnel \
  "Dacă foaia de pontaj gratuită aduce conturi sau doar trafic care pleacă." \
  "$(p '[{"type":"path","value":"/unelte/foaie-de-pontaj","filters":[]},{"type":"path","value":"/inregistrare","filters":[]},{"type":"event","value":"inregistrare-trimisa","filters":[]}]')"

creeaza "Din pagina de lege în cont"        funnel \
  "Dacă obligațiile legale aduc clienți sau doar cititori." \
  "$(p '[{"type":"path","value":"/evidenta-orelor-de-munca","filters":[]},{"type":"path","value":"/preturi","filters":[]},{"type":"event","value":"inregistrare-trimisa","filters":[]}]')"

# ── Verificarea ─────────────────────────────────────────────────────────────
# Nu „am trimis cererile", ci „ce e acolo acum". Un POST care întoarce 200 și un
# raport care apare în listă nu sunt același lucru.
printf "\n${D}5. ce e acum în Umami${N}\n"
FINAL="$(api "$LISTA")"
NR="$(printf '%s' "$FINAL" | jq -r '(.data // []) | length' 2>/dev/null || echo 0)"
if [ "${NR:-0}" -eq 0 ]; then
  # Lista goală după opt creări reușite nu e „gata", e o verificare care n-a
  # funcționat. Se spune, nu se trece peste.
  printf "   ${R}✗ lista a venit goală — verificarea NU confirmă nimic${N}\n"
  printf "   răspuns: %s\n" "$(printf '%s' "$FINAL" | head -c 200)"
  exit 1
fi
printf '%s' "$FINAL" | jq -r '(.data // []) | sort_by(.type, .name)[] | "   \(.type | . + "      " | .[0:7])\(.name)"'
printf "   ${V}%s rapoarte confirmate prin citire${N}\n" "$NR"

# Adresele se scriu întregi. În Umami 3.x nu mai există o listă unificată
# „Reports" — pagina aia e goală, deși rapoartele există. Trimit la secțiunile în
# care chiar se văd, verificate cu browser, nu presupuse din documentație.
printf "\n${V}Gata.${N} Se văd aici:\n"
printf "   ${D}%s/websites/%s/goals${N}\n" "$GAZDA" "$SITE"
printf "   ${D}%s/websites/%s/funnels${N}\n" "$GAZDA" "$SITE"
printf "sau în meniul din stânga, la ${D}Behavior → Goals${N} și ${D}Funnels${N}.\n"
