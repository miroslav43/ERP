#!/usr/bin/env bash
# ============================================================================
# deploy/instaleaza-timer.sh — închide lanțul unui timer de pe VM.
#
#   ./deploy/instaleaza-timer.sh push     # golirea cozii de notificări
#   ./deploy/instaleaza-timer.sh reges    # ciclul de reconciliere REGES-Online
#
# Steagurile:
#   --fara-deploy   sare peste `stack:deploy` (dacă tocmai l-ai rulat)
#   --da            nu întreabă nimic (pentru o a doua rulare, după ce ai văzut
#                   ce face prima)
#
# CE FACE, ȘI DE CE ARE NEVOIE DE TREI LOCURI
# Secretul trebuie să existe identic în trei locuri, altfel lanțul tace FĂRĂ
# nicio eroare vizibilă:
#   1. `.env.production`            — de-aici îl citește `stack:deploy`;
#   2. în containerul pornit        — Swarm propagă doar ce e ENUMERAT în
#                                     `docker-stack.yml`; de-aia pasul 4;
#   3. `/etc/administrativo/*.env`  — mediul din care rulează timerul.
# Cu secretul lipsă din oricare, ruta răspunde 404 la orice apel — indistinct
# de „rută inexistentă".
#
# IDEMPOTENT. Se poate rula de câte ori vrei. Dacă secretul există deja
# undeva, îl REFOLOSEȘTE — nu generează unul nou, fiindcă asta ar rupe exact
# potrivirea pe care scriptul o construiește.
#
# NU RULA SCRIPTUL ÎNTREG CU `sudo`: are nevoie să scrie `.env.production` și
# să ruleze `stack:deploy` ca utilizatorul tău. Cere el `sudo` unde trebuie.
# ============================================================================
set -uo pipefail

RADACINA="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RADACINA" || exit 1

# ── Formatare ───────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  R=$'\033[0;31m'; V=$'\033[0;32m'; G=$'\033[0;33m'; A=$'\033[0;34m'
  DIM=$'\033[2m'; B=$'\033[1m'; N=$'\033[0m'
else
  R=""; V=""; G=""; A=""; DIM=""; B=""; N=""
fi
pas()   { echo; echo "${B}${A}▶${N} ${B}$*${N}"; }
ok()    { echo "  ${V}✓${N}  $*"; }
info()  { echo "  ${A}●${N}  $*"; }
atent() { echo "  ${G}⚠${N}  $*"; }
rau()   { echo "  ${R}✗${N}  $*" >&2; }
mor()   { rau "$*"; exit 1; }

# ── Argumente ───────────────────────────────────────────────────────────────
CE=""; FARA_DEPLOY=0; FARA_INTREBARI=0
while [ $# -gt 0 ]; do
  case "$1" in
    push|reges)     CE="$1"; shift ;;
    --fara-deploy)  FARA_DEPLOY=1; shift ;;
    --da)           FARA_INTREBARI=1; shift ;;
    -h|--help)      sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)              mor "Argument necunoscut „$1”. Vezi --help." ;;
  esac
done
[ -n "$CE" ] || mor "Spune ce instalezi: push sau reges. Vezi --help."

case "$CE" in
  push)
    VAR="PUSH_CRON_SECRET"; UNITATE="push-livrare"
    ENVFILE="/etc/administrativo/push.env"; RUTA="/api/push/livreaza"
    CE_TACE="Coada push_livrari nu se golește: nicio notificare pe telefoane." ;;
  reges)
    VAR="REGES_CRON_SECRET"; UNITATE="reges-reconciliere"
    ENVFILE="/etc/administrativo/reges.env"; RUTA="/api/reges/reconciliere"
    CE_TACE="Ciclul de reconciliere REGES-Online nu pornește." ;;
esac
DOMENIU="administrativo.ro"

intreaba() {
  [ "$FARA_INTREBARI" -eq 1 ] && return 0
  local raspuns
  read -r -p "  ${G}?${N}  $1 [da/NU] " raspuns
  [ "$raspuns" = "da" ]
}

# ── 0. Preflight ────────────────────────────────────────────────────────────
pas "0. Verific ce am nevoie"

[ "$(id -u)" -ne 0 ] || mor "Nu rula scriptul cu sudo — cere el unde trebuie. Vezi antetul."
[ -f .env.production ] || mor "Lipsește .env.production în $RADACINA."
[ -f "deploy/${UNITATE}.service" ] || mor "Lipsește deploy/${UNITATE}.service."
[ -f "deploy/${UNITATE}.timer" ]   || mor "Lipsește deploy/${UNITATE}.timer."
command -v openssl >/dev/null || mor "Lipsește openssl."
command -v systemctl >/dev/null || mor "Lipsește systemctl — nu e un VM cu systemd."
command -v curl >/dev/null || mor "Lipsește curl."
command -v sudo >/dev/null || mor "Lipsește sudo — scriptul are nevoie de el pentru /etc și systemd."

# `docker-stack.yml` enumeră explicit fiecare variabilă. O verificare, nu o
# presupunere: lipsa liniei e cauza cea mai tăcută din tot lanțul.
if ! grep -q "^\s*-\s*${VAR}=" docker-stack.yml; then
  mor "${VAR} NU e enumerat în docker-stack.yml. Swarm nu propagă ce nu e acolo:
      secretul ar rămâne \"\" în container, iar ruta ar răspunde 404 și la un apel
      cu secretul CORECT. Adaugă în blocul environment: al serviciului:
        - ${VAR}=\${${VAR}:-}"
fi
ok "${VAR} e enumerat în docker-stack.yml"
ok "unitățile există în deploy/"

# ── 1. Secretul: îl aflu, sau îl fac ────────────────────────────────────────
pas "1. Secretul"

# Din .env.production, fără să-l tipăresc. Ghilimelele se scot: fișierul e
# `source`-uit de bash (deci pot exista), iar EnvironmentFile-ul systemd le-ar
# lua ca parte din valoare.
din_env=""
if grep -q "^${VAR}=" .env.production; then
  din_env="$(grep "^${VAR}=" .env.production | tail -1 | cut -d= -f2-)"
  din_env="${din_env%\"}"; din_env="${din_env#\"}"
  din_env="${din_env%\'}"; din_env="${din_env#\'}"
fi

din_etc=""
if sudo test -f "$ENVFILE"; then
  din_etc="$(sudo grep "^${VAR}=" "$ENVFILE" 2>/dev/null | tail -1 | cut -d= -f2-)"
fi

SECRET=""
if [ -n "$din_env" ] && [ -n "$din_etc" ]; then
  if [ "$din_env" = "$din_etc" ]; then
    SECRET="$din_env"; ok "există în ambele locuri și se potrivesc — îl refolosesc"
  else
    atent "există în AMBELE locuri dar sunt DIFERITE."
    info "Asta e exact starea în care ruta răspunde 404 la fiecare rulare a timerului."
    info "Iau valoarea din .env.production (sursa pentru container) și o rescriu în ${ENVFILE}."
    intreaba "Continui?" || mor "Oprit. Nimic nu s-a schimbat."
    SECRET="$din_env"
  fi
elif [ -n "$din_env" ]; then
  SECRET="$din_env"; ok "există în .env.production — îl copiez în ${ENVFILE}"
elif [ -n "$din_etc" ]; then
  SECRET="$din_etc"; ok "există în ${ENVFILE} — îl copiez în .env.production"
else
  SECRET="$(openssl rand -base64 32)"; ok "generat unul nou (base64, 32 de octeți)"
fi
[ -n "$SECRET" ] || mor "Secretul a ieșit gol. Nu continui."

# ── 2. .env.production ──────────────────────────────────────────────────────
pas "2. .env.production"

if [ -n "$din_env" ]; then
  ok "deja acolo, neatins"
else
  cp -p .env.production ".env.production.bak-$(date +%Y%m%d-%H%M%S)"
  # `\n` la ÎNCEPUT, obligatoriu: fișierul nu se termină cu linie nouă
  # (verificat pe 2026-09-04), iar un `>>` fără el ar lipi variabila de ultima
  # linie existentă și le-ar strica pe AMÂNDOUĂ, tăcut.
  printf '\n%s="%s"\n' "$VAR" "$SECRET" >> .env.production
  ok "adăugat (copie de siguranță alături, .env.production.bak-*)"
fi

# Poarta care contează: fișierul e `source`-uit de ops/_lib.sh, deci trebuie să
# rămână interpretabil de bash. `bash -n` prinde exact stricăciunea pe care ar
# produce-o o adăugare fără linie nouă la început.
if bash -n .env.production 2>/dev/null; then
  ok "sintaxa fișierului e validă"
else
  rau "SINTAXA .env.production E STRICATĂ. Ultimele linii, cu valorile ascunse:"
  tail -3 .env.production | sed 's/=.*/=<ascuns>/' | sed 's/^/     /'
  mor "Restaurează din copia .env.production.bak-* de lângă și spune-mi ce s-a întâmplat."
fi
grep -c "^${VAR}=" .env.production | grep -qx 1 \
  && ok "apare exact o dată" \
  || atent "apare de mai multe ori — source o ia pe ultima. Curăță manual."

# ── 3. Mediul timerului ─────────────────────────────────────────────────────
pas "3. ${ENVFILE}"

sudo install -d -m 700 -o root -g root /etc/administrativo
printf '%s=%s\n' "$VAR" "$SECRET" | sudo tee "$ENVFILE" >/dev/null
sudo chown root:root "$ENVFILE"
sudo chmod 600 "$ENVFILE"
ok "scris, root:root, 0600"
unset SECRET din_env din_etc

# ── 4. Îl duce în container ─────────────────────────────────────────────────
pas "4. Îl duc în container"

if [ "$FARA_DEPLOY" -eq 1 ]; then
  atent "sărit (--fara-deploy). Dacă n-ai rulat stack:deploy DUPĂ pasul 2,"
  atent "secretul nu e în container și pasul 6 va arăta 404."
else
  info 'stack:deploy reface imaginea și face un rolling update health-gated.'
  info "Cu două replici, site-ul nu cade — dar durează câteva minute."
  if intreaba "Rulez ./administrativo.sh stack:deploy?"; then
    ./administrativo.sh stack:deploy || mor "stack:deploy a eșuat. Nu instalez timerul peste un deploy picat."
    ok "gata"
  else
    atent "sărit. Rulează-l tu înainte să te bazezi pe verificarea de la pasul 6."
  fi
fi

# ── 5. Unitatea și timerul ──────────────────────────────────────────────────
pas "5. Unitatea și timerul"

sudo cp "deploy/${UNITATE}.service" "deploy/${UNITATE}.timer" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now "${UNITATE}.timer"
ok "instalate și pornite"

if systemctl list-timers --all --no-pager "${UNITATE}.timer" | grep -q "${UNITATE}"; then
  ok "timerul e programat"
  systemctl list-timers --no-pager "${UNITATE}.timer" | sed -n '1,2p' | sed 's/^/     /'
else
  rau "timerul NU apare în list-timers. Vezi: systemctl status ${UNITATE}.timer"
fi

# ── 6. Verificarea ──────────────────────────────────────────────────────────
pas "6. Verificarea"

info "(a) Ruta există? Apel FĂRĂ secret — 404 e răspunsul corect aici."
cod="$(curl -sS -o /dev/null -w '%{http_code}' -m 20 \
        --resolve "${DOMENIU}:443:127.0.0.1" \
        -X POST "https://${DOMENIU}${RUTA}" 2>/dev/null || echo "000")"
case "$cod" in
  404) ok "HTTP 404 — ruta răspunde, apelul n-are secret. Corect." ;;
  502|503) rau "HTTP $cod — containerul nu răspunde. Vezi ./administrativo.sh stack:status" ;;
  000) rau "curl n-a ajuns nicăieri. nginx-ul local nu ascultă pe 443?" ;;
  *)   atent "HTTP $cod — neașteptat pentru un apel fără secret." ;;
esac

info "(b) Chemarea REALĂ a timerului — singura care dovedește tot lanțul."
# Fereastra de jurnal se ancorează ÎNAINTE de pornire. Fără `--since`, un
# `-n 15` poate potrivi un „HTTP 200" rămas de la o rulare veche și ar declara
# lanțul închis peste un eșec proaspăt — exact felul de poartă verde din
# obișnuință pe care proiectul îl plătește de fiecare dată.
de_cand="$(date '+%Y-%m-%d %H:%M:%S')"
sudo systemctl start "${UNITATE}.service" 2>/dev/null || true
sleep 3
jurnal="$(sudo journalctl -u "${UNITATE}" --since "$de_cand" --no-pager 2>/dev/null)"
if [ -z "$(echo "$jurnal" | grep -v "^-- " | tr -d "[:space:]")" ]; then
  atent "Nimic în jurnal de la pornire — mai aștept 5 secunde."
  sleep 5
  jurnal="$(sudo journalctl -u "${UNITATE}" --since "$de_cand" --no-pager 2>/dev/null)"
fi
echo "$jurnal" | tail -8 | sed 's/^/     /'

if echo "$jurnal" | grep -qE "HTTP (200|409)"; then
  echo
  ok "${B}Lanțul e închis.${N} De-acum, ce intră în coadă pleacă în cel mult un minut."
elif echo "$jurnal" | grep -q "HTTP 404"; then
  echo
  rau "HTTP 404 la chemarea cu secret: valoarea din ${ENVFILE} nu se potrivește"
  rau "cu cea ajunsă în container. Aproape sigur ai sărit pasul 4 (stack:deploy)."
  rau "Reia scriptul FĂRĂ --fara-deploy."
  exit 2
else
  echo
  atent "Jurnalul n-a arătat încă un cod. Peste un minut: journalctl -u ${UNITATE} -n 20"
fi

echo
echo "  ${DIM}Ce depindea de asta: ${CE_TACE}${N}"
echo "  ${DIM}Explicațiile, pas cu pas: docs/runbook-push-vm.md${N}"
