export type AreaKey = "national" | "Gasabo" | "Huye" | "Musanze";

export type RuleCode = "A" | "B" | "C";

export interface PriorityDistrictRow {
  district: string; province: string; poor_households: number; poor_missed: number;
  poor_missed_ci: Ci; exclusion_error: number; exclusion_error_ci: Ci;
  poverty_rate: number; poverty_ci: Ci; triple_gap: number; triple_gap_ci: Ci;
  small_cell: boolean; gain_b_per_1000: number; gain_b_ci: Ci; gain_b_clear: boolean;
  gain_c_per_1000: number; gain_c_ci: Ci; gain_c_clear: boolean; rank_missed?: number;
}
export interface PriorityTable { placeholder: boolean; note: string; national: PriorityDistrictRow; districts: PriorityDistrictRow[]; }
export interface EquityGroup {
  dimension: string; group: string; share_of_poor_households: number; reach_A: number; reach_A_ci: Ci;
  reach_B: number; reach_B_ci: Ci; reach_C: number; reach_C_ci: Ci;
  gain_B_per_1000: number; gain_B_ci: Ci; gain_B_clear: boolean; small_cell: boolean;
}
export interface Equity { placeholder: boolean; note: string; budget_share: number; groups: EquityGroup[]; }

export interface MethodSensitivity {
  feature_set: string;
  n_features: number;
  auc: number | null;
  auc_ci: Ci | null;
  poor_reached_at_observed_coverage: number | null;
  observed_coverage: number | null;
}
export interface MethodFacts {
  placeholder: boolean;
  note: string;
  data: { survey: string; n_households: number; n_districts: number; n_strata: number; n_clusters: number };
  poverty: { households_poor: number | null; households_poor_ci: Ci | null; persons_poor: number | null; persons_extreme_poor: number | null };
  support: { households_reached: number | null; by_programme: Record<string, number | null> };
  headline: { coverage_poor: number | null; coverage_poor_ci: Ci | null; exclusion_error: number | null; exclusion_error_ci: Ci | null; leakage: number | null; leakage_ci: Ci | null; financially_excluded_all: number | null; financially_excluded_poor: number | null; financially_excluded_poor_ci: Ci | null };
  model: { best_model: string; auc: number | null; auc_ci: Ci | null; n_features: number; sensitivity: MethodSensitivity[] | null };
  rules_at_observed_coverage: { budget_share: number | null; observed_poor_reached: number | null; B: { poor_reached: number | null; poor_reached_ci: Ci | null; gain_per_1000: number | null; gain_ci: Ci | null }; C: { poor_reached: number | null; poor_reached_ci: Ci | null; gain_per_1000: number | null; gain_ci: Ci | null }; districts_where_B_clearly_better: number; districts_where_C_clearly_better: number };
}

export type Ci<T = number> = [T, T];

export interface PlaceholderMixin {
  placeholder: boolean;
  note: string;
}

// ---------- district_gaps.json ----------
export interface SurveyDesign {
  weight_column: string;
  cluster_column: string;
  strata_column_used: boolean;
  strata_column?: string;
  note: string;
}

export interface DistrictRow {
  district: string;
  poverty_rate: number;
  poverty_ci: Ci;
  extreme_poverty_rate: number;
  extreme_poverty_ci: Ci;
  coverage_poor: number;
  exclusion_error: number;
  exclusion_error_ci?: Ci;
  leakage: number;
  leakage_ci?: Ci;
  financial_access: number;
  financial_access_ci?: Ci;
  triple_gap: number;
  triple_gap_ci?: Ci;
  n_households: number;
  small_cell: boolean;
}

export interface NationalAverages {
  poverty_rate: number;
  extreme_poverty_rate: number;
  coverage_poor: number;
  exclusion_error: number;
  leakage: number;
  financial_access: number;
  triple_gap: number;
}

export interface DistrictGaps extends PlaceholderMixin {
  survey_design: SurveyDesign;
  n_districts: number;
  districts: DistrictRow[];
  national_averages: NationalAverages;
  min_cell_size_flag: number;
}

// ---------- simulator_grid.json ----------
export interface RuleMeta {
  code: RuleCode;
  label: string;
}

export interface SimulatorRecordBase {
  area: AreaKey | string;
  budget_share: number;
  rule: RuleCode;
  rule_label: string;
  poor_reached: number | null;
  poor_reached_ci: Ci | null;
  extreme_poor_reached: number | null;
  exclusion_error: number | null;
  leakage: number | null;
  cost_per_poor_reached: number | null;
}

export interface SimulatorRecordA extends SimulatorRecordBase {
  rule: "A";
  actual_coverage: number;
}

export type SimulatorRecordBC =
  | (SimulatorRecordBase & { rule: "B" })
  | (SimulatorRecordBase & { rule: "C" });

export type SimulatorRecord = SimulatorRecordA | SimulatorRecordBC;

export interface AtObservedCoverage {
  area: AreaKey | string;
  rule: "B" | "C";
  budget_share: number;
  poor_reached: number;
  poor_reached_ci: Ci;
  observed_poor_reached: number;
  gain_per_1000_poor: number;
  gain_per_1000_poor_ci: Ci;
  clear_gain: boolean;
}

export interface ScorecardPoint {
  feature: string;
  feature_label?: string | null;
  band_or_code: string | null;
  points: number | null;
  description: string | null;
}

export interface Scorecard {
  features: string[];
  feature_labels?: Record<string, string>;
  points: ScorecardPoint[];
  note?: string;
}

export interface SimulatorGrid extends PlaceholderMixin {
  areas: (AreaKey | string)[];
  rules: RuleMeta[];
  rule_A_note: string;
  share_scale_note?: string;
  n_records: number;
  records: SimulatorRecord[];
  at_observed_coverage: AtObservedCoverage[];
  scorecard: Scorecard;
}

export interface BriefTargeting extends PlaceholderMixin {
  at_observed_coverage: AtObservedCoverage[];
}

// ---------- profiles.json ----------
export type TraitType = "numeric" | "proportion" | "percent";

export interface TraitMeta {
  key: string;
  label: string;
  type: TraitType;
}

export interface TraitComparison {
  missed: number | null;
  missed_ci: Ci | null;
  covered: number | null;
  covered_ci: Ci | null;
}

export interface ProfileByArea {
  area: AreaKey | string;
  n_poor_households: number;
  n_missed_poor: number;
  n_covered_poor: number;
  small_cell: boolean;
  traits: Record<string, TraitComparison>;
}

export interface Profiles extends PlaceholderMixin {
  comparison: string;
  areas: string[];
  traits_metadata: TraitMeta[];
  by_area: ProfileByArea[];
}

// ---------- model_metrics.json ----------
export interface ModelSpec {
  family: string | null;
  n_features_used: number | null;
  target: string;
  weights: string;
  cross_validation: string;
  random_seed: number;
  features_excluded_note: string;
}

export interface ValidationDesign {
  clustered_cv: boolean;
  cluster_column: string;
  strata_used: boolean;
  strata_note: string;
}

export interface FoldMetric {
  fold: string;
  auc_roc: number;
  auc_pr: number;
  brier_score: number;
  n_households_in_fold: number;
}

export interface OverallMetrics {
  auc_roc_mean: number;
  auc_roc_std: number;
  auc_pr_mean: number;
  brier_score_mean: number;
}

export interface DecisionPoint {
  budget_pct: 10 | 20 | 30 | 40;
  score_threshold_pctl: number;
  precision: number;
  recall: number;
  f1: number;
  exclusion_error: number;
  leakage: number;
  poor_reached_n: number;
}

export interface CalibrationDecile {
  decile: number;
  mean_predicted: number;
  mean_observed: number;
  n_households: number;
}

export interface Calibration {
  deciles: CalibrationDecile[];
}

export type FeatureType = "binary" | "categorical" | "ordinal" | "numeric";

export interface FeatureImportance {
  rank: number;
  feature: string;
  label: string;
  type: FeatureType;
  importance: number;
  direction: string;
}

export interface ModelMetrics extends PlaceholderMixin {
  model_spec: ModelSpec;
  validation_design: ValidationDesign;
  by_fold: FoldMetric[];
  overall: OverallMetrics;
  decision_metrics_by_budget_pct: DecisionPoint[];
  calibration: Calibration;
  feature_importance_top10: FeatureImportance[];
  pooled_auc_roc: number;
  pooled_auc_roc_ci: Ci;
  comparison_at_observed_coverage: {
    budget_share: number;
    observed: TargetingComparisonPoint & { coverage: number };
    model: TargetingComparisonPoint & {
      extreme_poor_reached: number;
      poor_reached_ci: Ci;
    };
    random: TargetingComparisonPoint;
  };
}

export interface TargetingComparisonPoint {
  poor_reached: number;
  exclusion_error: number;
  leakage: number;
}

// ---------- All bundles ----------
export interface PlaceholderStatus {
  district_gaps: boolean;
  simulator_grid: boolean;
  profiles: boolean;
  model_metrics: boolean;
  any: boolean;
  notes: {
    district_gaps?: string;
    simulator_grid?: string;
    profiles?: string;
    model_metrics?: string;
  };
}

export type AllDataFiles = {
  district_gaps: DistrictGaps;
  simulator_grid: SimulatorGrid;
  profiles: Profiles;
  model_metrics: ModelMetrics;
};
