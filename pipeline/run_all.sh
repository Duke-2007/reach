#!/usr/bin/env bash
# Rebuild every published table from the raw EICV7 files in data/raw. Stops on the first error.
# Usage (from anywhere):  bash pipeline/run_all.sh        (set PYTHON=python3 if needed)
# 06_routes needs internet only the first time (cached afterwards); if the routing server is
# unreachable it keeps the existing district_routes.json and still exits cleanly.
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PYTHON:-python}"
steps=(01_load_clean 01b_add_features 02_weighted_gaps 02b_financial_inclusion 03_model 03b_sensitivity 03c_equity 04_simulate 05_export 05b_export_extras 06_routes)
i=1
for s in "${steps[@]}"; do
  echo "== [$i/${#steps[@]}] $s =="
  "$PY" "pipeline/$s.py"
  i=$((i + 1))
done
echo "== tests =="
"$PY" -m pytest tests -q
echo "Done: outputs/ and app/public/data/ are up to date."
