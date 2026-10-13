# PROJECT_CONTEXT.md

## Project

**Reach**: a targeting audit and simulator for social protection and financial inclusion in Rwanda.
Entry for the NISR 2026 Big Data Hackathon, Track 2 (Financial Inclusion and Poverty Reduction).
Submission deadline: 30 Oct 2026, 11:59 PM.

## Goal

Using the NISR EICV7 2023-24 household survey, measure:

- which poor households are missed by support programs (**exclusion error**)
- which non-poor households receive support (**leakage**)

by district. Then let a planner compare targeting rules under a fixed budget.

## Architecture

- No live backend.
- A Python pipeline (offline) cleans the data, applies survey weights, trains a model and runs simulations.
- The pipeline exports small aggregated JSON files.
- A Next.js (TypeScript, Tailwind) static app reads those files.
- Deploy on Vercel.

## Folders

- `data/raw` (local only, gitignored)
- `data/processed` (gitignored)
- `data/external` (boundaries, only if the licence allows)
- `pipeline/` (numbered scripts 01 to 05 plus `config.py`)
- `outputs/` (aggregated JSON, safe to publish)
- `app/` (Next.js)
- `docs/`, `tests/`, `notebooks/`

## Hard rules

1. Never guess column names. Inspect the real files first and write findings to `docs/data-notes.md`.
2. Every estimate uses the survey weight (`weight`, the household weight). Confidence intervals must respect the survey design: use strata and clusters if a strata column exists in the data; otherwise use clusters (`clust`) only. State which one was used.
3. Never use consumption, expenditure, income-derived, poverty or quintile variables as model features. Poverty is defined from consumption, so that would leak the answer. The poverty file contains many such columns (for example exp1 to exp11, cons1, cons1ae, sol_jan, food, quintile, hh_index, pov_jan, poverty, epov_jan, Poverty_line, Extreme_line). All of them are forbidden as features.
4. Validate models with cross-validation grouped by cluster (`clust`).
5. Report results at district level only. Flag or hide cells with too few households or too few events.
6. Never commit raw microdata. Only aggregated outputs go in `outputs/` and `app/public/data`.
7. Fixed random seeds, pinned dependencies, one command (`pipeline/run_all.sh`) rebuilds everything.
8. English and Kinyarwanda UI text lives in i18n files, never hard-coded.
9. Plain, readable code with comments explaining statistical choices.
10. This is a policy design tool, not a list of real households. Say so in the UI and docs.

## Data

EICV7 Cross-Sectional Sample (catalog id 119). Files:

- `CS_EICV7_poverty_file` (15,054 households; hhid, clust, province, district, ur, weight, pop_wt, quintile, pov_jan, epov_jan, poverty)
- `CS_S01_S5_S7_Household`
- `CS_S0_S1_S2_S3_S4_S6A_S6B_S6C_Person`
- `CS_S5F_access_to_services`
- `CS_S9D1_Direct_Support`
- `CS_S9D2_Classic_Public_Work`
- `CS_S9D3_Expanded_Public_Work`
- `CS_S9D4_NSDS` (nutrition-sensitive direct support)
- `CS_S9D5_Financial_Services`
- `CS_S10A1_A2_credits`
- `CS_S10C_Savings`

Person-level files are keyed by hhid and pid and must be aggregated to household level.

Do NOT use the `CS_S8*` expenditure files as features.

Check against published figures: national poverty about 27.4% and extreme poverty about 5.4%. If the numbers are far off, stop and debug.

## Commands

Add the command for each stage here as it gets built.

```
# Python environment
python -m venv .venv
# Windows:  .venv\Scripts\activate
# Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt

# Pipeline (to be filled in)
# python pipeline/00_inspect.py
# python pipeline/01_load_clean.py
# ...

# App (to be filled in)
# cd app && npm run dev
```

## CHANGELOG

- 2026-10-02: Created project context.
