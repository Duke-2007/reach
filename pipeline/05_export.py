"""
05_export.py - turn the pipeline results into the JSON files the web app reads.

Writes to outputs/ AND app/public/data/ (replacing the placeholder files):
  district_gaps.json, profiles.json, model_metrics.json, simulator_grid.json
Guarantees:
  * strict JSON: NaN/inf become null (browsers cannot parse NaN);
  * the keys the app expects (taken from the current app files) are all present;
  * each file validates against a JSON Schema (written to outputs/schemas/);
  * no household-level keys (hhid, pid, ...) appear anywhere: aggregates only.

Run from the repo root:   python pipeline/05_export.py
"""
import json
from pathlib import Path
import sys

import jsonschema
import numpy as np
import pandas as pd
import pyreadstat

sys.path.insert(0, str(Path(__file__).resolve().parent))
from survey_stats import Design, ci_prop  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app" / "public" / "data"
OUT = ROOT / "outputs"
PROC = ROOT / "data" / "processed"
RAW = ROOT / "data" / "raw"
Z = 1.959964
import importlib  # noqa: E402
LABELS = dict(importlib.import_module("03_model").LABELS)   # same names as the /model screen
LABELS.update({"hh_size_ae": "Household size (adult equivalents)", "s7aq4a": "Cattle owned (number)",
               "s5cq20a": "Internet connection at home", "s5dq3": "Floor material",
               "s5cq22a": "Main cooking fuel", "head_edu_cat": "Head's education"})
UNIT = {"s7aq4a": " cattle", "s5cq2a": " m"}
SRC = "NISR EICV7 2023-24 (cross-sectional sample), household-weighted, 95% design-based intervals (strata + clusters)."
NOT_LIST = "Policy design tool: district-level survey estimates, not a list of real households."


# ---------------------------------------------------------------- helpers
def clean(o):
    """Recursively make JSON-safe: numpy -> python, NaN/inf -> None, floats rounded."""
    if isinstance(o, dict):
        return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, (np.bool_, bool)):
        return bool(o)
    if isinstance(o, (np.integer, int)):
        return int(o)
    if isinstance(o, (np.floating, float)):
        return None if not np.isfinite(o) else round(float(o), 4)
    return o


def key_diff(new, old, path="", skip=("traits", "traits_metadata")):
    """Keys present in the old (placeholder) structure but missing in the new one."""
    problems = []
    if isinstance(old, dict) and isinstance(new, dict):
        for k, v in old.items():
            if k not in new:
                problems.append(f"{path}/{k}")
            elif k not in skip:
                problems += key_diff(new[k], v, f"{path}/{k}", skip)
    elif isinstance(old, list) and isinstance(new, list) and old and new:
        problems += key_diff(new[0], old[0], f"{path}[0]", skip)
    return problems


def mean_ci(design, y, dom, pct):
    ok = dom & np.isfinite(y)
    est, se = design.ratio(np.where(ok, y, 0.0), ok.astype(float))
    return est, (ci_prop(est, se) if pct else (est - Z * se, est + Z * se))


# ---------------------------------------------------------------- load
df = pd.read_parquet(PROC / "households.parquet")
gaps = pd.read_csv(OUT / "tables" / "gaps_by_area.csv")
fin = pd.read_csv(OUT / "tables" / "financial_inclusion.csv").set_index("area")
mm = json.loads((OUT / "model_metrics_raw.json").read_text())
sim = json.loads((OUT / "simulator_grid_raw.json").read_text())
oof = pd.read_parquet(PROC / "oof_risk.parquet")
old = {n: (json.loads((APP / f"{n}.json").read_text(encoding="utf-8")) if (APP / f"{n}.json").exists() else {})
       for n in ["district_gaps", "profiles", "model_metrics", "simulator_grid"]}
design = Design(df)
w = df["weight"].to_numpy(float)
poor = df["poor"].to_numpy(bool)
sup = df["got_any_support"].to_numpy(bool)

# ---------------------------------------------------------------- district_gaps.json
g = gaps[(gaps.outcome == "got_any_support") & (gaps.poverty_def == "poor")].set_index("area")
e = gaps[(gaps.outcome == "got_any_support") & (gaps.poverty_def == "extreme_poor")].set_index("area")


def ci(df_, a, col):
    return [df_.loc[a, f"{col}_lo"], df_.loc[a, f"{col}_hi"]]


def district_row(a):
    return {"district": a, "poverty_rate": g.loc[a, "poverty_rate"], "poverty_ci": ci(g, a, "poverty_rate"),
            "extreme_poverty_rate": e.loc[a, "poverty_rate"], "extreme_poverty_ci": ci(e, a, "poverty_rate"),
            "coverage_poor": g.loc[a, "coverage_poor"], "exclusion_error": g.loc[a, "exclusion_error"],
            "leakage": g.loc[a, "leakage"], "financial_access": fin.loc[a, "has_formal_financial_service"],
            "triple_gap": fin.loc[a, "triple_gap"], "n_households": g.loc[a, "n_households"],
            "small_cell": bool(g.loc[a, "small_cell"] or fin.loc[a, "small_cell"]),
            "exclusion_error_ci": ci(g, a, "exclusion_error"), "leakage_ci": ci(g, a, "leakage"),
            "financial_access_ci": ci(fin, a, "has_formal_financial_service"),
            "triple_gap_ci": ci(fin, a, "triple_gap")}


districts = sorted(a for a in g.index if a != "Rwanda")
nat = g.loc["Rwanda"]
district_gaps = {
    "placeholder": False,
    "note": f"{SRC} {NOT_LIST} Poverty rates are shares of HOUSEHOLDS; 'any support' = direct support, classic or expanded public works, or nutrition-sensitive direct support (VUP). Extreme-poverty estimates are noisy at district level.",
    "survey_design": {"weight_column": "weight", "cluster_column": "clust", "strata_column_used": True,
                      "strata_column": "strata_id",
                      "note": "Strata taken from the household file; intervals by Taylor linearisation."},
    "n_districts": len(districts), "districts": [district_row(a) for a in districts],
    "national_averages": {"poverty_rate": nat.poverty_rate, "extreme_poverty_rate": e.loc["Rwanda", "poverty_rate"],
                          "coverage_poor": nat.coverage_poor, "exclusion_error": nat.exclusion_error,
                          "leakage": nat.leakage, "financial_access": fin.loc["Rwanda", "has_formal_financial_service"],
                          "triple_gap": fin.loc["Rwanda", "triple_gap"]},
    "min_cell_size_flag": 30}

# ---------------------------------------------------------------- profiles.json
old_types = {t["key"]: t.get("type") for t in old["profiles"].get("traits_metadata", [])} if old["profiles"] else {}
livestock = df[[c for c in ["s7aq4a", "s7aq4b", "s7aq4c", "s7aq4d", "s7aq4e", "s7aq4f"] if c in df]].fillna(0).sum(axis=1)
TRAITS = [  # key, label, array, is_percent, type-from-old-key
    ("household_size", "Mean household size (persons)", df["hh_size"].to_numpy(float), False, "household_size", "numeric"),
    ("electricity_pct", "% with electricity (grid or solar)", df["s5cq14"].isin([1, 2, 3]).astype(float).to_numpy(), True, "electricity_pct", "percent"),
    ("improved_water_pct", "% with improved drinking water (piped, tap, borehole, protected source, rain)", df["s5cq3"].isin([1, 2, 3, 4, 5, 6, 8, 10]).astype(float).to_numpy(), True, "improved_water_pct", "percent"),
    ("improved_toilet_pct", "% with improved toilet type (flush, VIP, slab, composting)", df["s5cq25"].isin([1, 2, 3, 4, 5, 6]).astype(float).to_numpy(), True, "improved_toilet_pct", "percent"),
    ("head_primary_plus_pct", "% heads who attended primary or higher", df["head_primary_plus"].astype(float).to_numpy(), True, "head_primary_plus_pct", "percent"),
    ("distance_health_km", "Mean distance to nearest health centre (km)", df["dist_km_health_centre"].to_numpy(float), False, "distance_health_km", "numeric"),
    ("owns_livestock_pct", "% owning livestock", (livestock > 0).astype(float).to_numpy(), True, "owns_mobile_phone_pct", "percent"),
    ("head_female_pct", "% female-headed households", df["head_female"].astype(float).to_numpy(), True, "agriculture_main_pct", "percent"),
]
by_area, areas = [], []
for name in ["national"] + districts:
    m = np.ones(len(df), bool) if name == "national" else (df["district"] == name).to_numpy()
    mis, cov = m & poor & ~sup, m & poor & sup
    n_mis, n_cov = int(mis.sum()), int(cov.sum())
    if name != "national" and (n_mis < 10 or n_cov < 10):
        continue                                   # too few covered poor households to compare
    traits = {}
    for key, _, arr, pct, _, _ in TRAITS:
        em, cm = mean_ci(design, arr, mis, pct), mean_ci(design, arr, cov, pct)
        traits[key] = {"missed": em[0], "missed_ci": list(em[1]), "covered": cm[0], "covered_ci": list(cm[1])}
    by_area.append({"area": name, "n_poor_households": n_mis + n_cov, "n_missed_poor": n_mis,
                    "n_covered_poor": n_cov, "small_cell": bool(n_mis < 30 or n_cov < 30), "traits": traits})
    areas.append(name)
profiles = {
    "placeholder": False,
    "note": f"{SRC} Comparison of poor households with and without any support. District comparisons rest on few covered households: look at small_cell.",
    "comparison": "missed poor households vs covered poor households", "areas": areas,
    "traits_metadata": [{"key": k, "label": lab, "type": old_types.get(oldk, default)} for k, lab, _, _, oldk, default in TRAITS],
    "by_area": by_area}

# ---------------------------------------------------------------- model_metrics.json
best = mm["best_model"]
feat_type = lambda f: "categorical" if f in json.loads((PROC / "feature_columns.json").read_text())["categorical"] else "numeric"
folds = [f for f in mm["folds"] if f["target"] == "poor" and f["model"] == best]
aucs = [f["auc"] for f in folds]
W_POOR = float((w * poor).sum())
risk = oof[f"oof_{best}_poor"].to_numpy()
dec = pd.qcut(pd.Series(risk).rank(method="first"), 10, labels=False).to_numpy()
cal = []
for r in mm["calibration"]:
    cal.append({"decile": r["decile"], "mean_predicted": r["predicted"], "mean_observed": r["observed"],
                "n_households": int((dec == r["decile"] - 1).sum())})
decision = []
for r in mm["decision_metrics"]:
    if r["is_observed_coverage"]:
        continue
    reach, leak = r["model"]["poor_reached"], r["model"]["leakage"]
    prec = 1 - leak
    decision.append({"budget_pct": int(round(r["budget_share"] * 100)), "score_threshold_pctl": 1 - r["budget_share"],
                     "precision": prec, "recall": reach, "f1": 2 * prec * reach / (prec + reach),
                     "exclusion_error": 1 - reach, "leakage": leak, "poor_reached_n": int(round(reach * W_POOR))})
at_obs = next(r for r in mm["decision_metrics"] if r["is_observed_coverage"])
model_metrics = {
    "placeholder": False,
    "note": f"{SRC} All predictions are out-of-fold (cluster-grouped 5-fold CV). Accuracy is modest; this is not a household list.",
    "model_spec": {"family": "Weighted logistic regression (best of logistic regression and gradient boosting by out-of-fold AUC)" if best == "logistic" else "Gradient boosting (best of logistic regression and gradient boosting by out-of-fold AUC)",
                   "n_features_used": len(mm["features_used"]), "target": "household below the national poverty line (pov_jan = 100)",
                   "weights": "household weight (weight) applied throughout", "cross_validation": "grouped by cluster (clust), k=5, seed 42",
                   "random_seed": 42,
                   "features_excluded_note": "Consumption, expenditure, income-derived, quintile and poverty columns, and money amounts that track consumption, are never used as features."},
    "validation_design": {"clustered_cv": True, "cluster_column": "clust", "strata_used": True,
                          "strata_note": "Folds group by cluster; intervals use a bootstrap that resamples clusters within strata."},
    "by_fold": [{"fold": f"cluster_fold_{f['fold']}", "auc_roc": f["auc"], "auc_pr": f["average_precision"],
                 "brier_score": f["brier"], "n_households_in_fold": f["n_households"]} for f in folds],
    "overall": {"auc_roc_mean": float(np.mean(aucs)), "auc_roc_std": float(np.std(aucs, ddof=1)),
                "auc_pr_mean": float(np.mean([f["average_precision"] for f in folds])),
                "brier_score_mean": float(np.mean([f["brier"] for f in folds]))},
    "decision_metrics_by_budget_pct": decision,
    "calibration": {"deciles": cal},
    "feature_importance_top10": [{"rank": i["rank"], "feature": i["feature"], "label": i["label"],
                                  "type": feat_type(i["feature"]), "importance": i["importance_auc_drop"],
                                  "direction": i["direction"]} for i in mm["feature_importance"]],
    "pooled_auc_roc": mm["models"][f"poor_{best}"]["auc"], "pooled_auc_roc_ci": mm["models"][f"poor_{best}"]["auc_ci"],
    "comparison_at_observed_coverage": {
        "budget_share": at_obs["budget_share"],
        "observed": mm["observed_rule"],
        "model": {**at_obs["model"], "poor_reached_ci": at_obs["model_poor_reached_ci"]},
        "random": at_obs["random"]}}

# ---------------------------------------------------------------- simulator_grid.json
LABEL = {"A": "Observed / current targeting", "B": "Model-ranked targeting (out-of-fold risk)", "C": "Simple scorecard"}
records = [{**r, "rule_label": LABEL[r["rule"]]} for r in sim["records"]]
records = [{k: r[k] for k in ["area", "budget_share", "rule", "rule_label", "poor_reached", "poor_reached_ci",
                              "extreme_poor_reached", "exclusion_error", "leakage", "cost_per_poor_reached"]
            + (["actual_coverage"] if r["rule"] == "A" else [])} for r in records]


def card_labels():
    """Readable descriptions for scorecard codes/bands (labels read from the household file)."""
    hits = list(RAW.rglob("CS_S01_S5_S7_Household.dta"))
    vl = {}
    if hits:
        for enc in (None, "latin1", "cp1252"):
            try:
                vl = pyreadstat.read_dta(str(hits[0]), metadataonly=True, encoding=enc)[1].variable_value_labels
                break
            except UnicodeDecodeError:
                continue
    edu = {0: "Never attended school", 1: "Pre-primary", 2: "Primary", 3: "Vocational (Ingoboka)",
           4: "Lower secondary", 5: "Upper secondary", 6: "Tertiary"}
    spec = json.loads((PROC / "feature_columns.json").read_text())
    out = []
    for p in sim["scorecard_points"]:
        f, c = p["feature"], p["band_or_code"]
        num_feature = f in spec["numeric"]
        x = pd.to_numeric(df[f], errors="coerce").to_numpy(float)
        xv = x[~np.isnan(x)]
        unit = UNIT.get(f, "")
        if num_feature and len(np.unique(xv)) > 8:
            is_int = bool(np.all(np.mod(xv, 1) == 0))
            fmt = (lambda v: str(int(v))) if is_int else (lambda v: "%.1f" % v)
            edges = np.unique(np.nanquantile(x, [0.2, 0.4, 0.6, 0.8]))
            k = int(c)
            if k == -1:
                desc = "None reported (no livestock owned)" if f.startswith("s7aq4") else "Blank / not applicable"
            elif k == 0:
                desc = "below " + fmt(edges[0]) + unit
            elif k >= len(edges):
                desc = fmt(edges[-1]) + " or more" + unit
            else:
                lo, hi = edges[k - 1], edges[k]
                if is_int and hi - lo == 1:
                    desc = fmt(lo) + unit
                elif is_int:
                    desc = f"{fmt(lo)} to {fmt(hi - 1)}{unit}"
                else:
                    desc = f"{fmt(lo)} to below {fmt(hi)}{unit}"
        elif f == "head_edu_cat":
            desc = edu.get(int(float(c)), c)
        elif c == "-1":
            desc = "Blank / not applicable"
        else:
            labels = {int(round(float(k))): v for k, v in vl.get(f, {}).items()}
            desc = labels.get(int(float(c)), f"code {c}")
        out.append({**p, "feature_label": LABELS.get(f, f), "description": desc})
    order = {f: i for i, f in enumerate(sim["scorecard_features"])}
    out.sort(key=lambda r: (order.get(r["feature"], 99), float(r["band_or_code"])))   # numeric, not text, order
    return out


simulator_grid = {
    "placeholder": False,
    "note": f"{SRC} Out-of-fold model scores; {sim['n_boot']} cluster-bootstrap replicates, seed {sim['seed']}. Budget = share of all households supported. Cost is in units of the cost of supporting one household (=1).",
    "areas": ["national"] + districts,
    "rules": [{"code": c, "label": LABEL[c]} for c in "ABC"],
    "rule_A_note": "Rule A has exactly 1 record per area, at that area's observed actual_coverage; B and C cover budgets 1% to 50%.",
    "share_scale_note": "poor_reached, poor_reached_ci and extreme_poor_reached are fractions in [0,1] of the area's poor (or extreme-poor) households, not counts.",
    "n_records": len(records), "records": records,
    "at_observed_coverage": sim["at_observed_coverage"],
    "scorecard": {"features": sim["scorecard_features"], "feature_labels": {f: LABELS.get(f, f) for f in sim["scorecard_features"]}, "points": card_labels(),
                  "note": "Points are rounded logistic coefficients (largest = 10); a household's score is the sum of its points."}}

# ---------------------------------------------------------------- validate + write
share = {"type": "number", "minimum": 0, "maximum": 1}
share_or_null = {"type": ["number", "null"], "minimum": 0, "maximum": 1}
ci_pair = {"type": "array", "minItems": 2, "maxItems": 2, "items": share_or_null}
base_props = {"placeholder": {"const": False}, "note": {"type": "string"}}
SCHEMAS = {
    "district_gaps": {"type": "object", "required": ["placeholder", "note", "districts", "national_averages"],
                      "properties": {**base_props, "districts": {"type": "array", "minItems": 30, "maxItems": 30, "items": {
                          "type": "object", "required": ["district", "poverty_rate", "poverty_ci", "exclusion_error", "leakage", "n_households", "small_cell"],
                          "properties": {"district": {"type": "string"}, "poverty_rate": share, "poverty_ci": ci_pair,
                                         "exclusion_error": share_or_null, "leakage": share_or_null,
                                         "small_cell": {"type": "boolean"}}}}}},
    "profiles": {"type": "object", "required": ["placeholder", "note", "by_area", "traits_metadata"],
                 "properties": {**base_props, "by_area": {"type": "array", "minItems": 1}}},
    "model_metrics": {"type": "object", "required": ["placeholder", "by_fold", "overall", "decision_metrics_by_budget_pct", "calibration", "feature_importance_top10"],
                      "properties": {**base_props, "by_fold": {"type": "array", "minItems": 5, "maxItems": 5},
                                     "decision_metrics_by_budget_pct": {"type": "array", "minItems": 4, "maxItems": 4},
                                     "feature_importance_top10": {"type": "array", "minItems": 10, "maxItems": 10}}},
    "simulator_grid": {"type": "object", "required": ["placeholder", "areas", "rules", "records"],
                       "properties": {**base_props, "records": {"type": "array", "minItems": 1, "items": {
                           "type": "object", "required": ["area", "budget_share", "rule", "poor_reached", "poor_reached_ci", "exclusion_error", "leakage"],
                           "properties": {"rule": {"enum": ["A", "B", "C"]}, "budget_share": share, "poor_reached": share,
                                          "poor_reached_ci": ci_pair, "exclusion_error": share, "leakage": share_or_null}}}}}}
FORBIDDEN_KEYS = {"hhid", "pid", "household_id", "clust", "strata_id", "weight"}


def keys_of(o):
    if isinstance(o, dict):
        for k, v in o.items():
            yield k
            yield from keys_of(v)
    elif isinstance(o, list):
        for v in o:
            yield from keys_of(v)


files = {"district_gaps": district_gaps, "profiles": profiles, "model_metrics": model_metrics, "simulator_grid": simulator_grid}
(OUT / "schemas").mkdir(parents=True, exist_ok=True)
APP.mkdir(parents=True, exist_ok=True)
print(f"{'file':20s}{'size':>10s}   checks")
for name, obj in files.items():
    obj = clean(obj)
    missing = key_diff(obj, old[name])
    if missing:
        raise SystemExit(f"{name}: keys the app expects are missing: {missing}")
    jsonschema.validate(obj, SCHEMAS[name])
    bad = FORBIDDEN_KEYS & set(keys_of(obj))
    if bad:
        raise SystemExit(f"{name}: household-level keys found: {bad}")
    text = json.dumps(obj, separators=(",", ":"), allow_nan=False)
    for d in (OUT, APP):
        (d / f"{name}.json").write_text(text, encoding="utf-8")
    (OUT / "schemas" / f"{name}.schema.json").write_text(json.dumps(SCHEMAS[name], indent=2))
    print(f"{name:20s}{len(text) / 1024:8.0f} KB   keys ok, schema ok, no household-level keys")
print(f"\nDistricts: {len(districts)}; profile areas: {len(areas)} (national + districts with >=10 covered poor households)")
print(f"Simulator records: {len(records)}; scorecard rows: {len(simulator_grid['scorecard']['points'])}")
print("Files written to outputs/ and app/public/data/ - the placeholder banner will disappear.")
