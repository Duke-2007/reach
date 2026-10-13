# Reach

**A targeting audit and simulator for social protection and financial inclusion in Rwanda.**
Entry for the NISR 2026 Big Data Hackathon, Track 2 (Financial Inclusion and Poverty Reduction).

- Repository: [TODO: public GitHub link]
- Live app: [TODO: Vercel link]
- Team: [TODO: names]

## What it is

Rwanda has cut poverty sharply (39.8% in 2017 to 27.4% in 2024, published NISR figures), so the households that are still poor are harder to find, and targeting mistakes matter more. Two mistakes define the problem:

- **Exclusion error:** a poor household gets no support.
- **Leakage:** a household that is not poor gets support.

Reach measures both, district by district, from NISR's EICV7 household survey. It then lets a planner test better targeting rules under a fixed budget and see the result with honest uncertainty ranges.

**Who uses it:** district planners and social-protection programme managers.
**The decision it supports:** how to screen and prioritise households when only a fixed share of households can be supported.

## What the user sees

| Screen | Question it answers |
|---|---|
| Gap map | Where is the gap? Poverty, households missed, leakage, financial access and the "triple gap" for each of the 30 districts |
| Missed vs covered | Who is missed? Traits of poor households with and without support |
| Model | How well can poverty be predicted from easy-to-observe traits, and how is it validated? |
| Simulate rules | At a given budget, how many poor households does each rule reach? |
| District brief | A printable one-page summary for a district with three recommended actions |
| Priority districts | Which districts have the most poor households with no support? A sortable table with intervals |
| Method and limits | What data and methods were used, how to read the intervals, and what the numbers cannot tell you |


The app is mobile first, available in English and Kinyarwanda, and reads small aggregated files (no server).

## Main results (Rwanda, "any support", households, 95% intervals)


### Equity check

At the programmes' own coverage (10.1% of households) each rule picks households nationwide. The table shows the share of each group's **poor** households that is reached (95% intervals in `docs/` and in the app).

| Group | Share of poor households | Observed | Model (B) | Scorecard (C) | Gain of B per 1,000 poor households (95% CI) |
|---|---|---|---|---|---|
| Urban | 17% | 9.7% | 25.4% | 18.6% | +157 (+112 to +203) |
| Rural | 83% | 15.8% | 28.6% | 26.7% | +128 (+111 to +146) |
| Female-headed | 26% | 20.7% | 26.0% | 21.7% | +54 (+17 to +89) |
| Male-headed | 74% | 12.6% | 28.8% | 26.6% | +161 (+140 to +179) |
| Eastern Province | 26% | 8.1% | 27.7% | 25.4% | +196 (+166 to +232) |
| Kigali City | 5% | 5.3% | 18.9% | 16.7% | +136 (+66 to +215) |
| Northern Province | 11% | 18.8% | 22.5% | 25.6% | +37 (-8 to +99), not clear |
| Southern Province | 30% | 16.5% | 29.9% | 26.6% | +134 (+97 to +162) |
| Western Province | 28% | 19.0% | 30.1% | 25.0% | +111 (+76 to +143) |

Current coverage is uneven: the Eastern Province holds 26% of poor households but the programmes reach 8.1% of them. Observed targeting already reaches female-headed poor households better (20.7%) than male-headed ones (12.6%), and the scorecard would give them almost no extra reach (21.7%). For this reason Reach recommends testing the scorecard **alongside** existing criteria, not replacing them.

---

| Measure | Result |
|---|---|
| Poor households | 23.4% (22.6%-24.2%). Persons: 27.4% poor and 5.4% extremely poor, matching the published EICV7 figures |
| Poor households that receive support | 14.7% (13.6%-16.0%) |
| **Exclusion error** (poor households with no support) | **85.3%** (84.0%-86.4%) |
| **Leakage** (supported households that are not poor) | **65.7%** (63.2%-68.2%) |
| Support programmes reach | 10.1% of all households |

At the programmes' own coverage (10.1% of households), the share of poor households reached is:

| Rule | Poor households reached | Gain over observed, per 1,000 poor households |
|---|---|---|
| A. Observed targeting | 14.7% (13.6%-15.9%) | - |
| B. Model-ranked (out-of-fold risk) | 28.0% (26.9%-29.1%) | +133 (118 to 149) |
| C. Simple scorecard (6 features, integer points) | 25.3% (24.3%-26.4%) | +106 (91 to 122) |

Rule B clearly beats observed targeting in 23 of the 30 districts, and rule C in 21 of 30; in the others the district samples are too small to tell. The model's weighted AUC is 0.819 (0.812-0.827) from out-of-fold predictions, and 0.773 even without any household-size variable.

These figures describe how well each rule reaches households that are poor by the consumption-based poverty line used in the survey. The programmes target by their own criteria, so the comparison shows what a poverty-ranked rule could add, not that the programmes are badly run. See [docs/limitations.md](docs/limitations.md).

## Data

- NISR EICV7 2023-24 cross-sectional sample (catalog ID 119). The raw microdata is **not** in this repository and must not be redistributed (NISR terms). Only aggregated results are published here.
- District boundaries: geoBoundaries (gbOpen, Rwanda ADM2), CC BY 4.0.
- Full list of files, access conditions and citations: [docs/data-sources.md](docs/data-sources.md).

## How to reproduce

1. **Get the data.** Request EICV7 (catalog 119) from the NISR microdata catalog and place the `.dta` files in `data/raw/` (sub-folders are fine). Never commit them.
2. **Python environment** (Python 3.12 or newer):
   ```
   python -m venv .venv
   # Windows PowerShell:  .venv\Scripts\Activate.ps1      Git Bash / Linux / macOS:  source .venv/Scripts/activate  (or .venv/bin/activate)
   pip install -r requirements.txt
   ```
  For the exact package versions used (Python 3.14.8 on Windows with Git Bash): `pip install -r requirements-lock.txt`.
   For the web app use Node 24.21.0 and `npm ci`.

3. **Rebuild every published table** with one command (stops at the first error and runs the tests at the end):
   ```
   bash pipeline/run_all.sh
   ```
   Or run the steps in order:
   `01_load_clean.py`, `01b_add_features.py`, `02_weighted_gaps.py`, `02b_financial_inclusion.py`, `03_model.py`, `04_simulate.py`, `05_export.py`.
   `00_inspect.py` lists every file, column and label (metadata only); `03b_sensitivity.py` re-fits the model without household-size variables.
4. **Run the tests:** `python -m pytest tests -q` (Python) and `cd app && npm test` (web app).
5. **Start the app:**
   ```
   cd app
   npm install
   npm run dev
   ```
   Open http://localhost:3000. `05_export.py` writes the data files the app reads into `app/public/data/`.

Random seeds are fixed (42); the bootstrap uses 200 replicates.

## Method in brief

1. Label each surveyed household: poor or not, supported or not (four boxes).
2. Weight every count with the survey weight and compute design-based confidence intervals (60 strata, 1,674 clusters).
3. Predict poverty with weighted logistic regression and gradient boosting, using no consumption variables, validated by cross-validation grouped by cluster.
4. Simulate rules A, B and C at budgets from 1% to 50% with out-of-fold predictions and a design-based bootstrap.
5. Export aggregated JSON; the static web app and printable district brief read it.


Details: [docs/methodology.md](docs/methodology.md).

## Limitations

District level only; programme-level estimates are small, so "any support" is the headline; extreme-poverty estimates are noisy by district; receiving support can raise a household's consumption; the tool is a policy design aid, not a list of real households. See [docs/limitations.md](docs/limitations.md).

## AI tools disclosure

AI assistants were used to plan, write and review code and documentation. The tools and what they were used for are listed in [docs/ai-use-disclosure.md](docs/ai-use-disclosure.md).

## Impact

See [docs/impact.md](docs/impact.md).

## Originality, IP and licence

This is original work by the team named above, written for the NISR 2026 Big Data Hackathon. Under the terms of the competition, rights in the submission are assigned to NISR. [TODO: check this sentence and the code licence against the competition rules PDF before submitting.]
Boundary data: geoBoundaries, CC BY 4.0. Survey data: © NISR, used under the National Data Archive terms of use.
