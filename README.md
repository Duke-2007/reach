# Reach

Reach audits social protection targeting and compares poverty-based screening rules in Rwanda.

Entry for the NISR 2026 Big Data Hackathon, Track 2 (Financial Inclusion and Poverty Reduction).

## Links

- Live app: [reachrw.vercel.app](https://reachrw.vercel.app/)
- Repository: [Duke-2007/reach](https://github.com/Duke-2007/reach)
- Team: HIRWA RAENNE DUKE and AIMEE CLENIE DUKUZEMARIYA

## The problem

Some poor households receive no support, while some supported households are not poor. Reach measures these targeting gaps using Rwanda's EICV7 household survey. It also compares alternative screening rules at the same support budget.

## Decision and users

District planners and social-protection programme managers can use Reach to examine targeting gaps and compare how poverty-ranked rules might change who is reached under a fixed budget. The results support discussion and policy design; they do not identify households.

## Pages

| Route | Question it answers |
|---|---|
| `/` | How do poverty and targeting gaps vary across districts? |
| `/missed` | What traits distinguish poor households with and without support? |
| `/model` | How well does the model rank poverty risk, and how was it checked? |
| `/simulate` | How do targeting rules compare at different support budgets? |
| `/priority` | Which districts have the most poor households without support? |
| `/brief` | What does a district summary show, and what actions could be considered? |
| `/method` | How were the estimates made, and what are their limits? |

## Data

The survey is the National Institute of Statistics of Rwanda (NISR), *Rwanda Integrated Household Living Conditions Survey (EICV7) 2023-2024, Cross-Sectional Sample*, [NISR Microdata Catalog](https://microdata.statistics.gov.rw/index.php/catalog), study `RWA-NISR-EICV7-2023-2024-v01` (catalog ID 119). Raw microdata is not redistributed. The repository contains aggregated files in `outputs/` and `app/public/data/`.

District boundaries are from geoBoundaries, Rwanda ADM2, under CC BY 4.0. Road data is from OpenStreetMap contributors under ODbL. Road routes are precomputed with OSRM using the FOSSGIS demo server. See [data sources and conditions](docs/data-sources.md).

## Headline results

The app reports district-level targeting results for **any support**, with 95% design-based intervals. The values below summarize Rwanda nationally unless stated otherwise.

- Poor households: 23.4% (95% CI 22.6% to 24.2%).
- Persons (point estimates; no interval is recorded in the source file): 27.4% poor and 5.4% extremely poor in EICV7 (2023-2024).
- Poor households receiving any support: 14.7% (95% CI 13.6% to 16.0%).
- Exclusion error among poor households: 85.3% (95% CI 84.0% to 86.4%).
- Leakage among supported households: 65.7% (95% CI 63.2% to 68.2%).
- Any support reaches 10.1% of households.
- At the observed support budget, rule B gains 133 poor households reached per 1,000 (95% CI 118 to 149); rule C gains 106 (95% CI 91 to 122).
- Rule B clearly beats observed targeting in 23 of 30 districts; rule C does so in 21 of 30.
- Out-of-fold model AUC is 0.819 (95% CI 0.812 to 0.827); it is 0.773 without household-size and composition variables.

The Eastern Province holds 26% of poor households, and current programmes reach 8.1% of its poor households. For female-headed poor households, reach is 20.7% under current targeting and 21.7% under the scorecard, so the scorecard adds little for this group.

## How to run the app

```sh
cd app
npm ci
npm run dev
```

For development, open the local address printed by Next.js. The app reads the aggregated JSON files in `app/public/data/`.

### Production build

```sh
cd app
npm ci
npm run build
npm run start
```

The `npm run build` command must finish before `npm run start`.

## How to rebuild the data

The pipeline needs the NISR microdata files in `data/raw/`. Obtain access through the NISR Microdata Catalog and follow its conditions of use. Never commit or redistribute the raw files.

Install Python dependencies from the repository root with `pip install -r requirements.txt` (or use the pinned versions in `requirements-lock.txt`). Then run:

```sh
bash pipeline/run_all.sh
```

This runs the numbered pipeline scripts, writes aggregated exports to `outputs/` and `app/public/data/`, and runs the Python test suite.

The routes step calls the OSRM demo server, so it needs internet access. The precomputed route file is already in outputs/.

## Tests

From the repository root, run the Python suite:

```sh
python -m pytest tests -q
```

For the web app, run these commands from `app/`:

```sh
python scripts/check-i18n-keys.py
npx tsc --noEmit
npm run lint
npm test
npm run build
```

## Limitations

- Results are for districts; the survey does not support household-level identification or sector-level claims.
- Rules B and C are judged against the survey poverty label, which the model is trained to predict, so the comparison favours them by design. It shows what a poverty-ranked rule could add, not that the programmes are badly run.
- Programme-specific estimates can be noisy, so the headline measure is any support.
- Extreme-poverty estimates are noisy at district level.
- Support may change household welfare, and programmes use eligibility criteria beyond the survey poverty line.
- The app has not been validated with district planners or programme staff.

See [the full limitations](docs/limitations.md).

## AI tools

Claude, Trae, Devin and Codex assisted with planning, writing and reviewing code and documentation. See the [AI use disclosure](docs/ai-use-disclosure.md).

## NISR submission checklist

| Item | Repository status |
|---|---|
| ReadMe | This README explains the data, dashboard and user interactions. |
| Scripts | `pipeline/run_all.sh` rebuilds the aggregated data and runs the Python tests. |
| Data | Aggregated exports are in `outputs/` and `app/public/data/`; raw survey microdata is not redistributed. |

- Screen recording: [demo/reach-demo-v2.webm](demo/reach-demo-v2.webm)