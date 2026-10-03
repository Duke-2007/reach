#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "[1/6] 01_load_clean.py"
python pipeline/01_load_clean.py

echo "[2/6] 02_weighted_gaps.py"
python pipeline/02_weighted_gaps.py

echo "[3/6] 02b_financial_inclusion.py"
python pipeline/02b_financial_inclusion.py

echo "[4/6] 03_model.py"
python pipeline/03_model.py

echo "[5/6] 04_simulate.py"
python pipeline/04_simulate.py

echo "[6/6] 05_export.py"
python pipeline/05_export.py

echo "Pipeline complete."
