#!/bin/sh
# Recalculates .xlsx files with LibreOffice (headless) inside a Debian container, so that the
# delivered workbooks carry cached values for readers that do not recalculate (e.g. AI screeners).
# Usage (from anywhere):  model/recalc.sh financial-model.xlsx cap-table.xlsx   (paths relative to vestventures/)
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
C=vv-lo
if ! docker ps --format '{{.Names}}' | grep -qx "$C"; then
  docker rm -f "$C" >/dev/null 2>&1 || true
  docker run -d --name "$C" -v "$ROOT":/w debian:bookworm-slim sleep 14400 >/dev/null
  docker exec "$C" sh -c 'apt-get update >/dev/null && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends libreoffice-calc-nogui fonts-dejavu-core >/dev/null'
fi
U="$(id -u):$(id -g)"
for f in "$@"; do
  b=$(basename "$f")
  docker exec -u "$U" -e HOME=/tmp "$C" sh -c "rm -rf /tmp/rc && mkdir -p /tmp/rc && \
    soffice -env:UserInstallation=file:///tmp/lo-profile --headless --norestore \
      --convert-to 'xlsx:Calc MS Excel 2007 XML' --outdir /tmp/rc '/w/$f' >/tmp/rc.log 2>&1 && \
    test -s '/tmp/rc/$b' && cp '/tmp/rc/$b' '/w/$f'" || { echo "recalc FAILED for $f" >&2; exit 1; }
  echo "recalculated $f"
done
