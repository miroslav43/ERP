#!/bin/sh
# Full pipeline: 3 scenario workbooks -> recalc -> snapshot -> final workbook -> recalc -> _surse/cifre.json
set -eu
cd "$(dirname "$0")/.."
mkdir -p model/recalc
for s in 1 2 3; do
  python3 model/build_model.py --scenario $s --out model/recalc/scen$s.xlsx
done
model/recalc.sh model/recalc/scen1.xlsx model/recalc/scen2.xlsx model/recalc/scen3.xlsx
python3 model/export_cifre.py snapshot model/recalc/scen1.xlsx model/recalc/scen2.xlsx model/recalc/scen3.xlsx \
  --out model/recalc/snapshot.json >/dev/null
python3 model/build_model.py --scenario 1 --snapshot model/recalc/snapshot.json
model/recalc.sh financial-model.xlsx
python3 model/export_cifre.py cifre financial-model.xlsx model/recalc/snapshot.json --out _surse/cifre.json >/dev/null
rm -f model/recalc/scen1.xlsx model/recalc/scen2.xlsx model/recalc/scen3.xlsx model/__pycache__/*.pyc
echo "cifre.json written"
