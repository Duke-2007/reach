# App data exports

The frontend consumes four aggregated JSON exports from this directory. The current exports are real pipeline outputs (`placeholder: false`); the `note` fields describe their survey source and methods. The UI displays the placeholder disclosure only when an export sets `placeholder: true`. These district and national summaries are survey estimates, not household lists.

## `district_gaps.json`

Top level: `placeholder`, `note`, `survey_design`, `n_districts`, `districts`, `national_averages`, `min_cell_size_flag`.

`survey_design` contains `weight_column`, `cluster_column`, `strata_column_used`, optional `strata_column`, and `note`. Each district row contains its name, poverty and extreme-poverty rates with 95% CIs, poor-household coverage, exclusion error and CI, leakage and CI, financial access and CI, triple-gap share and CI, unweighted `n_households`, and `small_cell`. `national_averages` gives the seven corresponding rates without CIs. The current file contains 30 districts. Match map features by district name, case-insensitively.

## `simulator_grid.json`

Top level: `placeholder`, `note`, `areas`, `rules`, `rule_A_note`, `share_scale_note`, `n_records`, `records`, `at_observed_coverage`, and `scorecard`. `areas` currently includes national and all 30 districts. Rule A rows represent observed targeting and carry `actual_coverage`; rules B and C contain results by budget share. `poor_reached`, its CI, `exclusion_error`, and `leakage` are shares. `at_observed_coverage` compares B/C against observed targeting for each area and includes `gain_per_1000_poor`, its CI, and `clear_gain`. Scorecard points include feature labels, bands, scores, and descriptions. The current export has 3,131 records.

## `profiles.json`

Top level: `placeholder`, `note`, `comparison`, `areas`, `traits_metadata`, `by_area`. `areas` is the authoritative selector list; it currently contains national plus the 22 districts with sufficient covered-poor sample. Rows include weighted poor, missed-poor and covered-poor counts, `small_cell`, and a `traits` mapping. Trait keys currently include household size, electricity, water, toilet, education, health-centre distance, livestock ownership (`owns_livestock_pct`), and female-headed households (`head_female_pct`). Traits have `missed`, `missed_ci`, `covered`, and `covered_ci`; values and intervals can be null and the UI should show an en dash.

## `model_metrics.json`

Top level includes `placeholder`, `note`, `model_spec`, `validation_design`, `by_fold`, `overall`, `decision_metrics_by_budget_pct`, `calibration`, `feature_importance_top10`, `pooled_auc_roc`, `pooled_auc_roc_ci`, and `comparison_at_observed_coverage`. Feature-importance entries include `rank`, `feature`, human-readable `label`, `type`, `importance`, and `direction`. `comparison_at_observed_coverage` has `budget_share` and `observed`, `model`, and `random` poor-reach/exclusion/leakage estimates.

## `priority_table.json`

Top level: `placeholder`, `note`, `national`, and `districts`. The national row and 30 district rows contain survey-weighted poor-household totals, poor households with no support (`poor_missed`) with 95% intervals, exclusion error, poverty rate, triple-gap share, and Rule B/Rule C gains per 1,000 poor households with intervals and clear-gain flags. `small_cell` marks estimates requiring care. Counts are survey estimates and the priority table rounds displayed counts to the nearest 100.

## `equity.json`

Top level: `placeholder`, `note`, `budget_share`, `n_boot`, and `groups`. Each group row describes its share of all poor households, observed reach (`reach_A`), Rule B and Rule C reach, each with 95% intervals, plus Rule B gain per 1,000 poor households with interval and clear-gain flag. `small_cell` marks groups requiring care. Shares and reach fields are proportions.

`districts.geojson` supplies map boundaries and is also fetched by the gap map. Keep exported JSON aggregated; never publish raw microdata here.
