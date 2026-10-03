# Reach — Rwanda social protection & financial inclusion targeting simulator

## What it is

Entry for the NISR 2026 Big Data Hackathon, Track 2 (Financial Inclusion and Poverty Reduction).
Using the EICV7 2023–24 household survey we measure, by district:

- **Exclusion error**: poor households missed by existing support programmes.
- **Leakage**: non-poor households receiving support.

A planner can then compare alternative targeting rules under a fixed budget.

## Data

See [data/README.md](data/README.md) for the list of required raw files and how to place them.
The pipeline expects 10 Stata (`.dta`) files from the EICV7 cross-sectional sample (catalog id 119).
Never commit raw microdata; only aggregated outputs live in `outputs/` and `app/public/data`.

## How to reproduce

```bash
# Python environment
python -m venv .venv
# Windows Git Bash / Linux: source .venv/Scripts/activate   (or source .venv/bin/activate)
source .venv/Scripts/activate
pip install -r requirements.txt

# (optional) visualisation / map deps — may require resolver flags on Python 3.14
pip install -r requirements-optional.txt

# Run the whole pipeline (stops on first error)
bash pipeline/run_all.sh

# App
cd app
npm install
npm run dev
```

## Method

1. Clean and merge the 10 EICV7 files; aggregate person-level records to household level.
2. Validate survey weights and poverty rates against the published figures (national poverty ~27.4%, extreme ~5.4%).
3. Train a poverty-probability model on **non-leaking** household features (no consumption / expenditure / income variables).
4. Score every household and simulate targeting rules (thresholds, proxy-means tests, combined rules).
5. Compute exclusion, leakage and cost by district and export small aggregated JSON files.
6. Display the results in a bilingual (English / Kinyarwanda) static Next.js app with maps (MapLibre) and charts (Recharts).

All estimates respect the survey design (weights + clusters; strata if available).
Model validation uses cross-validation grouped by cluster (`clust`).

## Limitations

- Survey-based estimates: cells with fewer than 30 households (or few events) are flagged / hidden.
- This is a **policy design tool**, not a list of real households. No individual-level data is exposed.
- Model features are limited to variables that would be observable before the poverty line is drawn;
  nothing derived from consumption, expenditure, income or existing poverty classifications is used.
- Targeting simulations assume a fixed budget and a single rule; they do not model behavioural
  response or dynamic programme entry/exit.

## AI tools disclosure

List of AI tools used in the preparation of this entry and the specific parts they contributed to:

- To be filled in.

## Licence

To be filled in.
