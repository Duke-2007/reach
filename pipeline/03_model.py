"""
03_model.py - poverty targeting model with leakage-safe validation.

Target: poor (second target: extreme_poor).  Features: ONLY the non-consumption
columns listed in data/processed/feature_columns.json (see 01b_add_features.py);
a runtime check refuses any forbidden consumption/poverty column.

Models: (a) weighted logistic regression (standardised numerics, one-hot
categoricals), (b) HistGradientBoosting with sample weights.
Validation: 5-fold cross-validation GROUPED BY CLUSTER (households of one cluster
never sit in both train and test).  Every household gets an OUT-OF-FOLD risk,
saved to data/processed/oof_risk.parquet; the simulator uses these so it cannot
be over-optimistic.

Preprocessing choices (documented, not hidden):
  * livestock counts are blank when the household owns no livestock -> set to 0;
  * features with more than 40% missing values are dropped (e.g. school distances,
    mostly "not applicable");
  * remaining numeric blanks -> median + a 'was missing' indicator.
All metrics are survey-weighted (household weight) with design-based bootstrap CIs.
Run from the repo root:   python pipeline/03_model.py
"""
import json
from pathlib import Path
import sys
import warnings

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sim_utils import cluster_multipliers, rule_metrics  # noqa: E402

warnings.filterwarnings("ignore", category=UserWarning)
ROOT = Path(__file__).resolve().parent.parent
PROC = ROOT / "data" / "processed"
SEED = 42
N_BOOT = 200
MAX_MISSING = 0.40
BUDGETS = [0.10, 0.20, 0.30, 0.40]
LIVESTOCK = ["s7aq4a", "s7aq4b", "s7aq4c", "s7aq4d", "s7aq4e", "s7aq4f"]
FORBIDDEN = {"exp1", "exp2", "exp3", "exp4", "exp5", "exp6", "exp7", "exp8", "exp9", "exp10",
             "exp11", "Food_at_school", "hh_index", "sol_jan", "quintile", "food", "cons1",
             "cons1ae", "pov_jan", "poverty", "epov_jan", "Poverty_line", "Extreme_line",
             "poor", "extreme_poor", "weight", "pop_wt", "s5bq1", "s5bq2a", "s5bq3a", "s5bq5a",
             "s5bq8", "s5cq9b", "s5cq11", "s5cq12", "s5cq20", "s7a2q1", "s7a2q4"}
LABELS = {
    "s5aq1": "Type of habitat", "s5aq2": "Type of dwelling", "s5aq3": "Sleeping rooms",
    "s5aq7": "Dwelling ownership", "s5cq1": "Main water source", "s5cq3": "Drinking water source",
    "s5cq2a": "Distance to water (m)", "s5cq2b": "Water fetching time (min)",
    "s5cq14": "Connected to grid", "s5cq16": "Lighting energy", "s5cq20a": "Internet at home",
    "s5cq21": "Cook stove type", "s5cq22a": "Cooking fuel", "s5cq25": "Toilet type",
    "s5cq26": "Toilet shared", "s5dq1": "Wall material", "s5dq2": "Roof material",
    "s5dq3": "Floor material", "s7aq4": "Owns livestock", "s7aq4a": "Cattle", "s7aq4b": "Goats",
    "s7aq4c": "Sheep", "s7aq4d": "Pigs", "s7aq4e": "Poultry", "s7aq4f": "Other livestock",
    "rooms_per_person": "Rooms per person", "urban": "Urban area", "hh_size": "Household size",
    "hh_size_ae": "Household size (adult equiv.)", "head_female": "Female head",
    "head_age": "Head's age", "head_marital": "Head's marital status",
    "head_edu_cat": "Head's education", "head_primary_plus": "Head attended primary+",
    "head_never_school": "Head never at school", "n_children": "Children (0-14)",
    "n_under5": "Children under 5", "n_elderly": "Elderly (65+)", "n_adults": "Adults (15-64)",
    "share_children": "Share of children", "dependency_ratio": "Dependency ratio",
    "any_secondary_plus": "Anyone with secondary+", "no_adult_women": "No adult woman",
    "dist_km_water": "Distance: water (km)", "dist_km_market": "Distance: market (km)",
    "dist_km_transport": "Distance: transport (km)", "dist_km_road": "Distance: road (km)",
    "dist_km_primary_school": "Distance: primary school (km)",
    "dist_km_secondary_school": "Distance: secondary school (km)",
    "dist_km_district_hospital": "Distance: district hospital (km)",
    "dist_km_health_centre": "Distance: health centre (km)",
    "dist_km_sector_office": "Distance: sector office (km)",
}


def wauc(y, p, w):
    return roc_auc_score(y, p, sample_weight=w)


def make_pipeline(kind, cat, num):
    ohe = OneHotEncoder(handle_unknown="infrequent_if_exist", min_frequency=30, sparse_output=False)
    if kind == "logistic":
        pre = ColumnTransformer([
            ("cat", ohe, cat),
            ("num", Pipeline([("imp", SimpleImputer(strategy="median", add_indicator=True)),
                              ("sc", StandardScaler())]), num)])
        clf = LogisticRegression(C=0.5, max_iter=3000)
    else:
        pre = ColumnTransformer([("cat", ohe, cat), ("num", "passthrough", num)])
        clf = HistGradientBoostingClassifier(learning_rate=0.05, max_iter=300, max_depth=4,
                                             min_samples_leaf=40, l2_regularization=1.0,
                                             early_stopping=True, validation_fraction=0.15,
                                             random_state=SEED)
    return Pipeline([("pre", pre), ("clf", clf)])


def main():
    df = pd.read_parquet(PROC / "households.parquet")
    spec = json.loads((PROC / "feature_columns.json").read_text())
    cat, num = list(spec["categorical"]), list(spec["numeric"])
    for c in cat + num:
        if c in FORBIDDEN:
            raise SystemExit(f"FORBIDDEN column used as a feature: {c}")
    X = df[cat + num].copy()
    for c in LIVESTOCK:
        if c in X:
            X[c] = X[c].fillna(0)            # blank = owns no livestock
    miss = X.isna().mean()
    dropped = sorted(miss[miss > MAX_MISSING].index)
    cat = [c for c in cat if c not in dropped]
    num = [c for c in num if c not in dropped]
    X = X[cat + num]
    print(f"Features used: {len(cat)} categorical + {len(num)} numeric; "
          f"dropped for >{MAX_MISSING:.0%} missing: {dropped or 'none'}")

    w = df["weight"].to_numpy(float)
    sw = w / w.mean()                         # keeps regularisation sensible
    targets = {"poor": df["poor"].to_numpy(int), "extreme_poor": df["extreme_poor"].to_numpy(int)}
    groups = df["clust"].to_numpy()
    folds = list(StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=SEED)
                 .split(X, targets["poor"], groups))
    M, cl = cluster_multipliers(df, N_BOOT, SEED)

    oof, fold_rows, results = {}, [], {}
    for tname, y in targets.items():
        for kind in ["logistic", "gboost"]:
            p = np.zeros(len(df))
            for k, (tr, te) in enumerate(folds):
                pipe = make_pipeline(kind, cat, num)
                pipe.fit(X.iloc[tr], y[tr], clf__sample_weight=sw[tr])
                p[te] = pipe.predict_proba(X.iloc[te])[:, 1]
                fold_rows.append({"target": tname, "model": kind, "fold": k + 1,
                                  "auc": wauc(y[te], p[te], w[te]),
                                  "average_precision": average_precision_score(y[te], p[te], sample_weight=w[te]),
                                  "brier": brier_score_loss(y[te], p[te], sample_weight=w[te]),
                                  "n_households": len(te)})
            oof[(tname, kind)] = p
            boots = [wauc(y, p, w * M[b][cl]) for b in range(N_BOOT)]
            results[(tname, kind)] = {
                "auc": wauc(y, p, w), "auc_ci": [float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))],
                "average_precision": average_precision_score(y, p, sample_weight=w),
                "prevalence": float((w * y).sum() / w.sum())}
            r = results[(tname, kind)]
            print(f"{tname:12s} {kind:9s} AUC {r['auc']:.3f} ({r['auc_ci'][0]:.3f}-{r['auc_ci'][1]:.3f})  "
                  f"AP {r['average_precision']:.3f}  (prevalence {r['prevalence']:.1%})")
            if r["auc"] > 0.95:
                raise SystemExit("AUC above 0.95: STOP and check for leakage before continuing.")

    best = max(["logistic", "gboost"], key=lambda k: results[("poor", k)]["auc"])
    print(f"\nBest model for 'poor' (out-of-fold weighted AUC): {best}")
    y = targets["poor"]
    risk = oof[("poor", best)]

    # ---- decision metrics: model vs random vs observed, with bootstrap CIs ----
    obs_cov = float((w * df["got_any_support"]).sum() / w.sum())
    base_leak = 1 - results[("poor", best)]["prevalence"]
    rows = []
    for b in BUDGETS + [obs_cov]:
        m = rule_metrics(risk, y, w, b, targets["extreme_poor"])
        reps = [rule_metrics(risk, y, w * M[i][cl], b)["poor_reached"] for i in range(N_BOOT)]
        rows.append({"budget_share": b, "is_observed_coverage": b == obs_cov,
                     "model": m, "model_poor_reached_ci": [float(np.percentile(reps, 2.5)), float(np.percentile(reps, 97.5))],
                     "random": {"poor_reached": b, "exclusion_error": 1 - b, "leakage": base_leak}})
    sup = df["got_any_support"].to_numpy(bool)
    observed = {"coverage": obs_cov, "poor_reached": float((w * y * sup).sum() / (w * y).sum())}
    observed["exclusion_error"] = 1 - observed["poor_reached"]
    observed["leakage"] = float((w * (1 - y) * sup).sum() / (w * sup).sum())
    print(f"\n{'budget':>9s} {'model reach':>12s} {'(95% CI)':>16s} {'random':>8s} {'model leak':>11s}")
    for r in rows:
        tag = "  <- observed coverage" if r["is_observed_coverage"] else ""
        print(f"{r['budget_share']:9.1%} {r['model']['poor_reached']:12.1%} "
              f"({r['model_poor_reached_ci'][0]:.1%}-{r['model_poor_reached_ci'][1]:.1%}) "
              f"{r['random']['poor_reached']:8.1%} {r['model']['leakage']:11.1%}{tag}")
    print(f"Observed rule: covers {observed['coverage']:.1%} of households, reaches "
          f"{observed['poor_reached']:.1%} of poor, leakage {observed['leakage']:.1%}")

    # ---- calibration by decile (out-of-fold, best model) ----
    dec = pd.qcut(pd.Series(risk).rank(method="first"), 10, labels=False)
    calib = [{"decile": int(d) + 1,
              "predicted": float(np.average(risk[dec == d], weights=w[dec == d])),
              "observed": float(np.average(y[dec == d], weights=w[dec == d]))} for d in range(10)]

    # ---- permutation importance on each validation fold (best model) ----
    imps = []
    for tr, te in folds:
        pipe = make_pipeline(best, cat, num)
        pipe.fit(X.iloc[tr], y[tr], clf__sample_weight=sw[tr])
        r = permutation_importance(pipe, X.iloc[te], y[te], scoring="roc_auc", n_repeats=3,
                                   random_state=SEED, sample_weight=w[te])
        imps.append(r.importances_mean)
    imp = pd.Series(np.mean(imps, axis=0), index=cat + num).sort_values(ascending=False)
    importance = []
    for rank, (f, v) in enumerate(imp.head(10).items(), 1):
        direction = "categorical"
        if f in num:
            direction = "higher = more poverty" if np.corrcoef(X[f].fillna(X[f].median()), y)[0, 1] > 0 else "higher = less poverty"
        importance.append({"rank": rank, "feature": f, "label": LABELS.get(f, f),
                           "importance_auc_drop": float(v), "direction": direction})
    print("\nTop features (drop in AUC when shuffled):")
    for i in importance:
        print(f"  {i['rank']:2d}. {i['label']:34s} {i['importance_auc_drop']:.4f}  {i['direction']}")

    # ---- save ----
    out = pd.DataFrame({"hhid": df["hhid"]})
    for (tname, kind), p in oof.items():
        out[f"oof_{kind}_{tname}"] = p
    out.to_parquet(PROC / "oof_risk.parquet", index=False)
    metrics = {
        "note": "Model results from EICV7 out-of-fold predictions; weighted; cluster-grouped CV.",
        "best_model": best, "features_used": cat + num, "features_dropped_missing": dropped,
        "models": {f"{t}_{k}": v for (t, k), v in results.items()},
        "folds": fold_rows, "decision_metrics": rows, "observed_rule": observed,
        "calibration": calib, "feature_importance": importance}
    (ROOT / "outputs").mkdir(exist_ok=True)
    (ROOT / "outputs" / "model_metrics_raw.json").write_text(json.dumps(metrics, indent=2))
    (ROOT / "docs").mkdir(exist_ok=True)
    r = results[("poor", best)]
    notes = f"""# Model notes (generated by pipeline/03_model.py)

**Target:** household is poor (EICV7 national poverty line). Second target: extreme poor.
**Features:** {len(cat) + len(num)} non-consumption household traits (housing, utilities, assets,
household composition, head of household, distance to services). No consumption, expenditure,
quintile or poverty variable is used.
**Validation:** 5-fold cross-validation grouped by cluster; all predictions are out-of-fold.
**Best model:** {best}. Weighted AUC {r['auc']:.3f} (95% CI {r['auc_ci'][0]:.3f}-{r['auc_ci'][1]:.3f}).

## Honest limitations
- Accuracy is modest: a model built from easy-to-observe traits misclassifies many households.
- It is trained on a survey sample and is only meaningful at district level or above.
- It does not identify real households and must not be used as a household list.
- Receiving support can itself raise consumption, so households that look better off may have
  been supported; this blurs the link between observed support and need.
"""
    (ROOT / "docs" / "model-notes.md").write_text(notes, encoding="utf-8")
    print("\nSaved outputs/model_metrics_raw.json, data/processed/oof_risk.parquet, docs/model-notes.md")


if __name__ == "__main__":
    main()
