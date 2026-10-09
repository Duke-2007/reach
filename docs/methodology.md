# Methodology

## 1. Unit of analysis and weights
The unit is the **household**. The base table is the EICV7 poverty file (15,054 households). Every estimate uses the household weight (`weight`). The population weight (`pop_wt`) is used only to check the national poverty headcount against the published figures: persons 27.4% poor and 5.4% extremely poor (the household-weighted figures are 23.4% and 4.1%, because poor households are larger).

## 2. Survey design and confidence intervals
Strata come from the household file (`strata_id`, complete there and checked to be constant within a household); the poverty file has no strata column. The sample has 60 strata and 1,674 clusters.

- Intervals use **Taylor linearisation** for a stratified, clustered sample (clusters resampled with replacement within strata, no finite-population correction).
- For sub-populations (a district, "poor households", "supported households") the estimate is a ratio over the whole sample with zeros outside the domain; the variance is computed over the whole sample, not on a filtered table.
- Intervals for proportions use the logit scale so they stay inside [0, 1].
- Model and simulator intervals use a **design-based bootstrap**: clusters are resampled within strata (200 replicates, seed 42) and the survey weights are multiplied by the draw counts.

## 3. The four-box table
For each area, support outcome and poverty definition (poor, extremely poor):

|  | Supported | Not supported |
|---|---|---|
| Poor | covered poor | **missed (exclusion)** |
| Not poor | **leakage** | not poor, no support |

- `coverage_poor` = share of poor households that are supported.
- `exclusion_error` = 1 - `coverage_poor`.
- `leakage` = share of **supported** households that are not poor.
- A row is flagged `small_cell` when it has fewer than 30 poor households or fewer than 10 supported households.

**Support** is a household-level flag: a household is supported if any member received it. "Any support" combines direct support (VUP-DS), classic public works, expanded public works and nutrition-sensitive direct support (NSDS), all from the VUP files. VUP financial-service loans are treated as financial inclusion, not as support.

## 4. Financial inclusion
- `has_savings`: any member has an account or takes part in a tontine.
- `has_credit`: any member owes money.
- `has_formal_financial_service`: any member has an account at a bank, microfinance institution, cooperative bank, SACCO, mobile-money provider or Mokash; or the household has a formal loan or an approved VUP loan.
- `financially_excluded`: none of the formal services above. Informal-only households (tontine, relatives) count as excluded.
- **Triple gap:** poor AND financially excluded AND receiving no support.

## 5. Predicting poverty
**Target:** household is poor (second target: extremely poor).

**Features (non-consumption only):** housing materials, dwelling type and ownership, water source and distance, lighting and cooking energy, toilet, internet at home, livestock, household size and composition, head of household (sex, age, marital status, education), and distance to nine services (water, market, transport, road, district hospital, health centre, sector office; school distances were dropped for missing values).

**Never used:** `exp1`-`exp11`, `Food_at_school`, `hh_index`, `sol_jan`, `quintile`, `food`, `cons1`, `cons1ae`, the poverty flags and lines, and money amounts that track consumption (rent, dwelling value, water and electricity payments). Receipt of animals from government or NGO schemes is also excluded, because it is itself a form of support. A runtime check stops the script if any forbidden column enters the feature list.

**Preprocessing:** livestock counts are blank when the household owns no livestock, so blanks become 0; features with more than 40% missing values are dropped; remaining numeric blanks are set to the median with a "was missing" indicator; categories are one-hot encoded; numeric features are standardised for the logistic model.

**Models:** (a) weighted logistic regression; (b) gradient boosting (HistGradientBoosting) with sample weights.

**Validation:** 5-fold cross-validation grouped by cluster (stratified for balance, seed 42), so households from one cluster never appear in both training and testing. Every household receives an **out-of-fold** risk score. Reported metrics (AUC, average precision, Brier score, calibration by decile) are survey-weighted. Importance is the drop in AUC when a feature is permuted on the held-out fold.

**Sensitivity check:** the logistic model without any size or composition variable (AUC 0.773) and with housing, water, energy and livestock only (AUC 0.762), against 0.819 for all features.

## 6. Simulating targeting rules
Budget is the share of all households in the area that can be supported (1% to 50%).

- **Rule A, observed:** who actually received any support. It has a single point per area, at that area's actual coverage.
- **Rule B, model-ranked:** households ranked by out-of-fold risk; the highest-risk households are supported until the budget is used (the last household is taken fractionally so the budget is met exactly and results are monotone).
- **Rule C, scorecard:** the six most important features; numeric features are cut into quintile bands; points are the rounded logistic coefficients (largest = 10); a household's score is the sum of its points. Scores are also out-of-fold (fitted within each fold).

For each rule and budget the simulator reports the share of poor and extremely poor households reached, exclusion error, leakage and cost per poor household reached (cost of supporting one household = 1 unit). Rules B and C are compared with A at A's actual coverage, with a bootstrap interval for the difference.

## 7. Aggregation and publication
Only aggregated results are exported: district and national tables, model diagnostics, simulator records and the scorecard. A schema check and a scan for household-level keys run before export.

## 8. Tests
`tests/` checks the variance formula against a known case, that the four boxes sum to 1, that coverage and exclusion add up, and that the budget logic reaches nobody at 0%, every poor household at 100%, is monotone in budget, and survives zero weights. The web app has unit tests for the scenario look-up.

## 9. Assumptions
- Distances to services are taken to be in metres (the values look like walking minutes converted at about 83 m per minute).
- A household counts as supported if any member received the programme.
- Poverty status comes from the survey's own consumption-based flags.
