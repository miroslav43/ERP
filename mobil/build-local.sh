#!/usr/bin/env bash
# ============================================================================
# mobil/build-local.sh — APK Android construit AICI, fără EAS.
#
#   ./build-local.sh            # release (semnat cu cheia de debug)
#   ./build-local.sh debug      # debug
#   ./build-local.sh --curat    # șterge android/ și reface de la zero
#
# PROBAT pe VM la 2026-09-05: `BUILD SUCCESSFUL in 8m 12s`, APK de 92 MB,
# `ro.administrativo.portal`, minSdk 24 / targetSdk 36, patru ABI-uri.
#
# ── CE ÎNSEAMNĂ „FĂRĂ EAS", EXACT ──────────────────────────────────────────
# Compilarea nu depinde de niciun serviciu. Rămân însă două dependențe pe care
# scriptul ăsta NU le rezolvă, și pe care e cinstit să le știi înainte:
#
#   1. JETONUL DE PUSH. `getExpoPushTokenAsync` cere un `projectId` emis de
#      expo.dev (verificat în sursa instalată,
#      `expo-notifications/build/getExpoPushTokenAsync.js:49-53`). Ieșirea e
#      `getDevicePushTokenAsync()` + FCM HTTP v1 direct din server — altă
#      muncă, nu o opțiune de aici.
#   2. iOS. Nu există compilare iOS fără macOS și Xcode. Nu e o limită a lui
#      Expo, e una a lui Apple.
#
# ── SEMNĂTURA: CHEIA DE DEBUG ──────────────────────────────────────────────
# Șablonul Expo semnează și `release` cu `debug.keystore`
# (`android/app/build.gradle`, `signingConfig signingConfigs.debug`). APK-ul se
# instalează și se testează, dar NU se publică: cheia de debug e aceeași pe
# orice mașină, iar o aplicație semnată cu o cheie nu se mai poate actualiza cu
# alta. Pentru distribuție reală îți faci un keystore propriu, O DATĂ, și îl
# păstrezi pentru totdeauna:
#
#   keytool -genkeypair -v -keystore administrativo.keystore \
#     -alias administrativo -keyalg RSA -keysize 2048 -validity 10000
#
# ...apoi îl referi din `android/app/build.gradle`. Dar `android/` e generat de
# `prebuild` și gitignorat, deci configurarea aia trebuie mutată într-un config
# plugin ca să supraviețuiască. Până atunci, EAS o face mai ieftin.
# ============================================================================
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1

if [ -t 1 ]; then
  R=$'\033[0;31m'; V=$'\033[0;32m'; G=$'\033[0;33m'; A=$'\033[0;34m'
  DIM=$'\033[2m'; B=$'\033[1m'; N=$'\033[0m'
else R=""; V=""; G=""; A=""; DIM=""; B=""; N=""; fi
pas()   { echo; echo "${B}${A}▶${N} ${B}$*${N}"; }
ok()    { echo "  ${V}✓${N}  $*"; }
info()  { echo "  ${A}●${N}  $*"; }
atent() { echo "  ${G}⚠${N}  $*"; }
mor()   { echo "  ${R}✗${N}  $*" >&2; exit 1; }

VARIANTA="release"; CURAT=0
while [ $# -gt 0 ]; do
  case "$1" in
    debug|release) VARIANTA="$1"; shift ;;
    --curat)       CURAT=1; shift ;;
    -h|--help)     sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)             mor "Argument necunoscut „$1”. Vezi --help." ;;
  esac
done

# ── SDK-ul ─────────────────────────────────────────────────────────────────
pas "SDK-ul Android"
if [ -z "${ANDROID_HOME:-}" ]; then
  for candidat in "$HOME/Android/Sdk" "$HOME/Library/Android/sdk" /usr/lib/android-sdk; do
    [ -d "$candidat/platforms" ] && { ANDROID_HOME="$candidat"; break; }
  done
fi
[ -n "${ANDROID_HOME:-}" ] || mor "Nu găsesc SDK-ul Android. Setează ANDROID_HOME."
export ANDROID_HOME ANDROID_SDK_ROOT="$ANDROID_HOME"
ok "$ANDROID_HOME"
ok "platforme: $(ls "$ANDROID_HOME/platforms" 2>/dev/null | tr '\n' ' ')"
command -v java >/dev/null || mor "Lipsește Java. Gradle-ul RN 0.86 cere JDK 17."
ok "$(java -version 2>&1 | head -1)"

# ── /tmp propriu ───────────────────────────────────────────────────────────
# CAPCANĂ PLĂTITĂ: Metro își ține cache-ul în `os.tmpdir()`, adică
# `/tmp/metro-cache`. Pe VM-ul ăsta, directorul e al lui ROOT (creat de altă
# unealtă pe 17 aug), iar Metro încearcă să-l GOLEASCĂ la pornire:
#   Error: EACCES: permission denied, rmdir '/tmp/metro-cache/00'
# Build-ul cade la `:app:createBundleReleaseJsAndAssets`, iar Gradle raportează
# doar „Process 'command 'node'' finished with non-zero exit value 1" — un
# mesaj care nu spune nimic despre permisiuni. Un TMPDIR propriu o ocolește.
pas "Directorul temporar"
TMPDIR="${TMPDIR:-}"
case "$TMPDIR" in
  ""|/tmp) TMPDIR="$PWD/.tmp-build"; ;;
esac
mkdir -p "$TMPDIR" || mor "Nu pot crea $TMPDIR"
export TMPDIR
ok "$TMPDIR ${DIM}(nu /tmp — vezi comentariul din script)${N}"

# ── Proiectul nativ ────────────────────────────────────────────────────────
pas "Proiectul nativ (android/)"
if [ "$CURAT" -eq 1 ]; then
  rm -rf android && ok "șters, se regenerează"
fi
if [ -d android ]; then
  ok "există deja ${DIM}(--curat ca să-l refaci)${N}"
else
  [ -d node_modules ] || mor "Lipsește node_modules. Rulează întâi: pnpm install"
  info "prebuild — generează android/ din app.config.ts"
  # `prebuild` REscrie scripturile din package.json („expo start --android" →
  # „expo run:android"), fiindcă un proiect cu director nativ nu mai e un
  # proiect Expo Go. `android/` e gitignorat, dar `package.json` NU — deci
  # schimbarea aia ar ajunge într-un commit și ar rupe fluxul Expo Go al
  # celorlalți. O reparăm imediat, mai jos.
  cp package.json .package.json.inainte
  if ! npx expo prebuild --platform android --no-install; then
    rm -f .package.json.inainte
    mor "prebuild a eșuat."
  fi
  if ! cmp -s package.json .package.json.inainte; then
    mv .package.json.inainte package.json
    ok "package.json restaurat (prebuild îi rescrie scripturile)"
  else
    rm -f .package.json.inainte
  fi
  ok "generat"
fi

if [ -n "${GOOGLE_SERVICES_JSON:-}" ]; then
  ok "GOOGLE_SERVICES_JSON=$GOOGLE_SERVICES_JSON — push-ul va funcționa"
else
  atent "GOOGLE_SERVICES_JSON nesetat: aplicația se construiește, dar NU va"
  atent "primi jeton de push pe Android. Vezi README, secțiunea Firebase."
fi

# ── Compilarea ─────────────────────────────────────────────────────────────
pas "Compilarea ($VARIANTA)"
SARCINA="assembleRelease"; [ "$VARIANTA" = "debug" ] && SARCINA="assembleDebug"
info "prima rulare durează ~10 minute (descarcă Gradle și dependențele)"
JURNAL="$PWD/.build-local.log"
if (cd android && ./gradlew "$SARCINA" --no-daemon --console=plain) > "$JURNAL" 2>&1; then
  ok "gata"
else
  echo
  grep -n "What went wrong" -A 8 "$JURNAL" | head -20
  echo
  mor "Build eșuat. Jurnalul întreg: $JURNAL"
fi

# ── Rezultatul ─────────────────────────────────────────────────────────────
pas "APK-ul"
APK="$(find android/app/build/outputs/apk/$VARIANTA -name '*.apk' -print -quit 2>/dev/null)"
[ -n "$APK" ] || mor "Build-ul a raportat succes, dar nu găsesc APK-ul. Vezi $JURNAL."
ok "$PWD/$APK ${DIM}($(du -h "$APK" | cut -f1))${N}"

BT="$(ls -d "$ANDROID_HOME"/build-tools/* 2>/dev/null | sort -V | tail -1)"
if [ -n "$BT" ] && [ -x "$BT/aapt2" ]; then
  "$BT/aapt2" dump badging "$APK" 2>/dev/null | head -1 | sed 's/^/     /'
fi
if [ -n "$BT" ] && [ -x "$BT/apksigner" ]; then
  semnatar="$("$BT/apksigner" verify --print-certs "$APK" 2>/dev/null | grep -m1 'certificate DN')"
  case "$semnatar" in
    *"Android Debug"*)
      atent "Semnat cu CHEIA DE DEBUG. Se instalează și se testează — nu se publică."
      atent "Vezi antetul scriptului pentru keystore propriu." ;;
    *) ok "${semnatar#*: }" ;;
  esac
fi

echo
echo "  ${DIM}Pe telefon: copiază APK-ul și deschide-l (cere o dată${N}"
echo "  ${DIM}„instalare din surse necunoscute\").${N}"
echo "  ${DIM}Cele patru ABI-uri fac dimensiunea; EAS produce un AAB pe care${N}"
echo "  ${DIM}Play Store îl împarte per dispozitiv.${N}"
