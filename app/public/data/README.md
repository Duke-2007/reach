# app/public/data — data contract

All JSON files in this folder are consumed by the Next.js frontend.
Every file currently carries `"placeholder": true` with a disclosure note — these
values are synthetic and **must** be replaced by the Python pipeline output
(`pipeline/01_load_clean.py` → `02_weighted_gaps.py` → `02b_financial_inclusion.py` →
`03_model.py` → `04_simulate.py` → `05_export.py`) before any public use.

Shared rule: any boolean `small_cell: true` means the estimate is built on fewer
than 30 households and the UI should hide or visually flag the cell.

---

## 1. district_gaps.json — district-level targeting audit

Top-level:

| Field | Type | Notes |
|---|---|---|
| `placeholder` | bool | Always `true` until pipeline writes the real file |
| `note` | string | Mandatory disclosure string — check in UI banner if `placeholder: true` |
| `survey_design` | object | Disclosure of weights, clusters, strata used for SEs / CIs |
| `survey_design.weight_column` | string | `weight` (household weight) |
| `survey_design.cluster_column` | string | `clust` |
| `survey_design.strata_column_used` | bool | Pipeline must confirm; placeholder says `false` |
| `survey_design.note` | string | Free text explaining the choice |
| `n_districts` | integer | 30 (Rwanda's 5 provinces × 30 districts) |
| `districts` | array of 30 objects | See rows below |
| `national_averages` | object | Weighted mean of each row-level metric across the 30 districts |
| `min_cell_size_flag` | integer | 30 |

Each `districts[]` row:

| Field | Type | Notes |
|---|---|---|
| `district` | string | District name (Gasabo … Rutsiro). Match against GeoJSON boundaries exactly |
| `poverty_rate` | float ∈ [0,1] | Weighted poverty headcount |
| `poverty_ci` | array[lo, hi] | 95 % CI for `poverty_rate` (cluster-robust; strata if available) |
| `extreme_poverty_rate` | float ∈ [0,1] | Weighted extreme-poverty headcount |
| `extreme_poverty_ci` | array[lo, hi] | 95 % CI for `extreme_poverty_rate` |
| `coverage_poor` | float ∈ [0,1] | Share of **poor** households receiving any support |
| `exclusion_error` | float ∈ [0,1] | `1 − coverage_poor` (share of poor *not* reached) |
| `exclusion_error_ci` | array[lo, hi] | 95 % CI for `exclusion_error` |
| `leakage` | float ∈ [0,1] | Share of **non-poor** households receiving support |
| `leakage_ci` | array[lo, hi] | 95 % CI for `leakage` |
| `financial_access` | float ∈ [0,1] | Share of households with bank or mobile-money account |
| `financial_access_ci` | array[lo, hi] | 95 % CI for `financial_access` |
| `triple_gap` | float ∈ [0,1] | Composite index — see pipeline `05_simulate_and_export.py` for formula |
| `triple_gap_ci` | array[lo, hi] | 95 % CI for `triple_gap` |
| `n_households` | integer | Unweighted household count in the survey sample for this district |
| `small_cell` | bool | `true` when `n_households < min_cell_size_flag` |

`national_averages` has keys: `poverty_rate, extreme_poverty_rate, coverage_poor,
exclusion_error, leakage, financial_access, triple_gap` — all floats in [0,1].

---

## 2. simulator_grid.json — flat list of simulation records

Top-level:

| Field | Type | Notes |
|---|---|---|
| `placeholder`, `note` | — | Same disclosure pattern as above |
| `areas` | string[] | `["national", "Gasabo", "Huye", "Musanze"]` — extend via pipeline. Lowercase `"national"` (not `"NATIONAL"`). |
| `rules` | object[] | `{code:"A"\|"B"\|"C", label: string}` |
| `share_scale_note` | string | Explains that `poor_reached`, `poor_reached_ci`, `extreme_poor_reached` are **shares in [0,1] of the area's poor households**, not counts |
| `rule_A_note` | string | Rule A is 1 record/area at the single *observed* coverage; B and C cover budgets 1 %–50 % |
| `n_records` | integer | 4 areas × (1 A + 50 B + 50 C) = 404 in placeholder |
| `records` | object[] | See row contract below |

Each `records[]` row — contract, order matters:

| Field | Type | Applies to rule | Notes |
|---|---|---|---|
| `area` | string | all | `areas[]` entry, one of `"national", "Gasabo", "Huye", "Musanze"` |
| `budget_share` | float ∈ (0, 1] | all | Fraction of the reference budget. For rule **A** this equals `actual_coverage` |
| `rule` | `"A"` \| `"B"` \| `"C"` | all | A = observed targeting; B = out-of-fold model rank; C = simple scorecard |
| `rule_label` | string | all | Human-readable rule label |
| `poor_reached` | float ∈ [0,1] | all | **Share** (0 %–100 %) of all poor households in the area who are reached. **Not a count.** |
| `poor_reached_ci` | array[lo, hi] floats ∈ [0,1] | all | 95 % CI for `poor_reached` — same share scale, not counts |
| `extreme_poor_reached` | float ∈ [0,1] | all | Share (0 %–100 %) of all *extremely* poor households in the area who are reached |
| `exclusion_error` | float ∈ [0,1] | all | Share of the poor left out at this budget (= `1 − poor_reached`) |
| `leakage` | float ∈ [0,1] | all | Share of beneficiaries who are non-poor |
| `cost_per_poor_reached` | integer (RWF) | all | RWF per extra poor household reached |
| `actual_coverage` | float ∈ (0,1] | **A only** | Observed programme coverage in the area. **Missing key on B and C records — do not assume it exists.** |

The UI should assume rows can be filtered by `area` then pivoted by `rule`. B and C are
guaranteed to have one row each for every integer budget 1 % ≤ p ≤ 50 %. A has exactly
one row per area.

---

## 3. profiles.json — missed poor vs covered poor comparison

Top-level:

| Field | Type | Notes |
|---|---|---|
| `placeholder`, `note` | — | Same disclosure |
| `comparison` | string | `missed poor households vs covered poor households` |
| `areas` | string[] | `["national", "Gasabo", "Huye", "Musanze"]` |
| `traits_metadata` | object[] | `{key, label, type: "numeric" \| "proportion"}` for every trait |
| `by_area` | object[] | Per-area results, see below |

`traits_metadata` defines all 8 traits; the UI should not hard-code trait names — loop over this array:

| `key` | `label` (English) | `type` |
|---|---|---|
| `household_size` | Mean household size (persons) | numeric |
| `electricity_pct` | % with electricity in dwelling | proportion |
| `improved_water_pct` | % with improved drinking water | proportion |
| `improved_toilet_pct` | % with improved sanitation | proportion |
| `head_primary_plus_pct` | % heads with primary+ education | proportion |
| `distance_health_km` | Median distance to nearest health centre (km) | numeric |
| `owns_mobile_phone_pct` | % owning a mobile phone | proportion |
| `agriculture_main_pct` | % main livelihood is agriculture | proportion |

Each `by_area[]` row:

| Field | Type | Notes |
|---|---|---|
| `area` | string | `areas[]` entry |
| `n_poor_households` | integer | Weighted count of all poor households in the area |
| `n_missed_poor` | integer | Weighted count of poor **not** receiving support |
| `n_covered_poor` | integer | Weighted count of poor **receiving** support |
| `small_cell` | bool | `n_poor_households < 30` |
| `traits` | object | Keyed by trait `key`; each value is the comparison block below |

Per-trait comparison block (each `traits.<key>`):

| Field | Type | Notes |
|---|---|---|
| `missed` | float | Mean / proportion for the MISSED poor group |
| `missed_ci` | array[lo, hi] floats | 95 % CI for the missed-group estimate |
| `covered` | float | Mean / proportion for the COVERED poor group |
| `covered_ci` | array[lo, hi] floats | 95 % CI for the covered-group estimate |

If `missed_ci` and `covered_ci` do not overlap the UI can mark the difference with "statistically different" styling.

---

## 4. model_metrics.json — /model screen diagnostics

Top-level:

| Field | Type | Notes |
|---|---|---|
| `placeholder`, `note` | — | Same disclosure |
| `model_spec` | object | Family, sample size, validation design, feature exclusions |
| `validation_design` | object | Confirmation of clustered CV, cluster column, strata status |
| `by_fold` | object[5] | One entry per `cluster_fold_1..5` |
| `overall` | object | Aggregate across folds (mean ± std for AUCs, mean Brier) |
| `decision_metrics_by_budget_pct` | object[4] | Operating point at 10 / 20 / 30 / 40 % budget shares |
| `calibration` | object | `deciles[]` with mean predicted vs mean observed |
| `feature_importance_top10` | object[10] | Ranked feature importance + direction |

`model_spec` fields: `family` (string or null/placeholder), `n_features_used` (int or null),
`target`, `weights`, `cross_validation`, `random_seed`, `features_excluded_note`.

`validation_design` fields: `clustered_cv: true`, `cluster_column: "clust"`, `strata_used: bool`,
`strata_note: string`.

Each `by_fold[]`:

| Field | Type |
|---|---|
| `fold` | string |
| `auc_roc` | float |
| `auc_pr` | float |
| `brier_score` | float |
| `n_households_in_fold` | integer |

`overall`: `auc_roc_mean, auc_roc_std, auc_pr_mean, brier_score_mean`.

Each `decision_metrics_by_budget_pct[]`:

| Field | Type |
|---|---|
| `budget_pct` | 10 \| 20 \| 30 \| 40 |
| `score_threshold_pctl` | float ∈ (0,1) — poverty-risk score cut-off used |
| `precision` | float — P(poor | treated) |
| `recall` | float — P(treated | poor) |
| `f1` | float |
| `exclusion_error` | float — `1 − recall` |
| `leakage` | float — `1 − precision`, bounded [0,1] |
| `poor_reached_n` | integer (weighted) |

`calibration.deciles[]`:

| Field | Type |
|---|---|
| `decile` | 1..10 |
| `mean_predicted` | float ∈ [0,1] |
| `mean_observed` | float ∈ [0,1] |
| `n_households` | integer |

`feature_importance_top10[]`:

| Field | Type |
|---|---|
| `rank` | integer 1..10 |
| `feature` | string |
| `type` | `"binary" \| "categorical" \| "ordinal" \| "numeric"` |
| `importance` | float (sum ≠ 1; higher = more important) |
| `direction` | string (human-readable, e.g. "no access → higher poverty risk") |

---

## Producing these files

The pipeline script `pipeline/05_export.py` writes to both `outputs/` (copy for
archive) and `app/public/data/` (what the Next.js app reads). The four files above
are the **only** JSON contracts the app consumes — do not add new files without
updating this README.
