"""
04_simulate.py - targeting simulator: rules A, B, C over a grid of budgets.

  Rule A  OBSERVED: who actually received any support (one point per area, at that
          area's actual coverage).
  Rule B  MODEL-RANKED: households ranked by OUT-OF-FOLD poverty risk (03_model.py),
          so no household is scored by a model that saw it in training.
  Rule C  SCORECARD: a transparent integer-point score from the 6 most important
          features; numeric features are cut into quintile bands, points are the
          rounded logistic coefficients (largest = 10).  Points for every household
          are also out-of-fold (fitted inside each cluster-grouped fold).

Budget = share of ALL households in the area that can be supported (1% ... 50%).
For B and C the highest-scoring households are supported until the budget is used.
Everything is weighted (household weight); 95% intervals come from a design-based
bootstrap (clusters resampled within strata, N_BOOT replicates, seed in config).
Cost per poor household reached = UNIT_COST * budget / (poor_reached * poverty_rate).

Run from the repo root:   python pipeline/04_simulate.py
"""
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.preprocessing import OneHotEncoder

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sim_utils import cluster_multipliers  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PROC = ROOT / "data" / "processed"
SEED, N_BOOT, UNIT_COST = 42, 200, 1.0
BUDGETS = np.arange(1, 51) / 100.0
N_POINTS_FEATURES = 6


def curve(score, poor, extreme, w, budgets):
    """Metrics of 'support the top-scoring households' for all budgets at once (fractional last household)."""
    order = np.argsort(-np.asarray(score, float), kind="stable")
    ws, ps, es = w[order], poor[order].astype(float), extreme[order].astype(float)
    n = len(ws)
    cum = np.cumsum(ws)
    tot = cum[-1]
    cp = np.concatenate([[0.0], np.cumsum(ws * ps)])
    ce = np.concatenate([[0.0], np.cumsum(ws * es)])
    caps = np.asarray(budgets, float) * tot
    k = np.searchsorted(cum, caps, side="right")          # households taken in full
    prev = np.concatenate([[0.0], cum])[k]
    rem = caps - prev                                      # weight taken from the next household
    j = np.minimum(k, n - 1)
    take = k < n
    sel_poor = cp[k] + np.where(take, rem * ps[j], 0.0)
    sel_ext = ce[k] + np.where(take, rem * es[j], 0.0)
    reach = sel_poor / cp[-1]
    return {"poor_reached": reach, "extreme_poor_reached": sel_ext / ce[-1],
            "exclusion_error": 1 - reach,
            "leakage": np.where(caps > 0, 1 - sel_poor / np.where(caps > 0, caps, 1), np.nan)}


def observed_rule(sup, poor, extreme, w):
    cov = (w * sup).sum() / w.sum()
    return {"actual_coverage": cov,
            "poor_reached": (w * poor * sup).sum() / (w * poor).sum(),
            "extreme_poor_reached": (w * extreme * sup).sum() / (w * extreme).sum(),
            "leakage": (w * (1 - poor) * sup).sum() / (w * sup).sum()}


def band(train, test, is_num):
    """Turn a feature into integer categories (numeric -> quintile bands; blanks -> own category)."""
    t, s = np.asarray(train, float), np.asarray(test, float)
    if is_num and len(np.unique(t[~np.isnan(t)])) > 8:
        edges = np.unique(np.nanquantile(t, [0.2, 0.4, 0.6, 0.8]))
        f = lambda v: np.where(np.isnan(v), -1, np.digitize(np.nan_to_num(v), edges))
    else:
        f = lambda v: np.where(np.isnan(v), -1, v).astype(int)
    return f(t), f(s)


def fit_scorecard(Xtr, ytr, wtr, Xte, feats, num):
    """Return (scores for Xte, points table). Points = rounded logistic coefficients, max |10|."""
    cols_tr, cols_te = [], []
    for f in feats:
        a, b = band(Xtr[f].to_numpy(), Xte[f].to_numpy(), f in num)
        cols_tr.append(a)
        cols_te.append(b)
    tr, te = np.column_stack(cols_tr).astype(str), np.column_stack(cols_te).astype(str)
    enc = OneHotEncoder(handle_unknown="ignore", sparse_output=False).fit(tr)
    lr = LogisticRegression(C=0.5, max_iter=2000).fit(enc.transform(tr), ytr, sample_weight=wtr / wtr.mean())
    pts = np.rint(lr.coef_[0] / np.abs(lr.coef_[0]).max() * 10)
    table = []
    for name, p in zip(enc.get_feature_names_out(), pts):
        idx, cat = int(name.split("_")[0][1:]), name.split("_", 1)[1]
        table.append({"feature": feats[idx], "band_or_code": cat, "points": int(p)})
    return enc.transform(te) @ pts, table


def main():
    df = pd.read_parquet(PROC / "households.parquet")
    risk_df = pd.read_parquet(PROC / "oof_risk.parquet")
    mm = json.loads((ROOT / "outputs" / "model_metrics_raw.json").read_text())
    spec = json.loads((PROC / "feature_columns.json").read_text())
    num = set(spec["numeric"])
    assert (risk_df["hhid"].to_numpy() == df["hhid"].to_numpy()).all(), "oof_risk rows differ from households"
    best = mm["best_model"]
    risk_b = risk_df[f"oof_{best}_poor"].to_numpy()

    poor, ext = df["poor"].to_numpy(int), df["extreme_poor"].to_numpy(int)
    w = df["weight"].to_numpy(float)
    sup = df["got_any_support"].to_numpy(float)
    feats = [i["feature"] for i in mm["feature_importance"] if i["feature"] in df.columns][:N_POINTS_FEATURES]
    X = df[feats].copy()
    for c in X.columns:
        X[c] = pd.to_numeric(X[c], errors="coerce")

    # Rule C: out-of-fold scorecard scores (same folds as 03_model.py)
    folds = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=SEED).split(X, poor, df["clust"].to_numpy())
    score_c = np.zeros(len(df))
    for tr, te in folds:
        score_c[te], _ = fit_scorecard(X.iloc[tr], poor[tr], w[tr], X.iloc[te], feats, num)
    _, card = fit_scorecard(X, poor, w, X, feats, num)      # final table for display
    print(f"Scorecard features: {feats}")

    M, cl = cluster_multipliers(df, N_BOOT, SEED)
    areas = [("national", np.ones(len(df), bool))] + \
            [(d, (df["district"] == d).to_numpy()) for d in sorted(df["district"].unique())]
    records, at_obs = [], []
    for name, m in areas:
        pm, em, wm, sm = poor[m], ext[m], w[m], sup[m]
        scores = {"B": risk_b[m], "C": score_c[m]}
        mult = [M[b][cl][m] for b in range(N_BOOT)]
        pov_rate = (wm * pm).sum() / wm.sum()
        # --- rule A (single point)
        a0 = observed_rule(sm, pm, em, wm)
        reps = [observed_rule(sm, pm, em, wm * mu) for mu in mult]
        ci = lambda key: [float(np.percentile([r[key] for r in reps], 2.5)), float(np.percentile([r[key] for r in reps], 97.5))]
        records.append({"area": name, "budget_share": a0["actual_coverage"], "rule": "A",
                        "poor_reached": a0["poor_reached"], "poor_reached_ci": ci("poor_reached"),
                        "extreme_poor_reached": a0["extreme_poor_reached"],
                        "exclusion_error": 1 - a0["poor_reached"], "leakage": a0["leakage"],
                        "cost_per_poor_reached": UNIT_COST * a0["actual_coverage"] / (a0["poor_reached"] * pov_rate),
                        "actual_coverage": a0["actual_coverage"]})
        # --- rules B and C: full grid + the point at A's actual coverage
        grid = np.concatenate([BUDGETS, [a0["actual_coverage"]]])
        for rule, sc in scores.items():
            c0 = curve(sc, pm, em, wm, grid)
            cr = [curve(sc, pm, em, wm * mu, grid) for mu in mult]
            for i, b in enumerate(BUDGETS):
                reach_reps = [r["poor_reached"][i] for r in cr]
                records.append({"area": name, "budget_share": float(b), "rule": rule,
                                "poor_reached": float(c0["poor_reached"][i]),
                                "poor_reached_ci": [float(np.percentile(reach_reps, 2.5)), float(np.percentile(reach_reps, 97.5))],
                                "extreme_poor_reached": float(c0["extreme_poor_reached"][i]),
                                "exclusion_error": float(c0["exclusion_error"][i]), "leakage": float(c0["leakage"][i]),
                                "cost_per_poor_reached": float(UNIT_COST * b / (c0["poor_reached"][i] * pov_rate))})
            last = len(grid) - 1                              # budget = A's actual coverage
            diff = [r["poor_reached"][last] - rr["poor_reached"] for r, rr in zip(cr, reps)]
            at_obs.append({"area": name, "rule": rule, "budget_share": float(a0["actual_coverage"]),
                           "poor_reached": float(c0["poor_reached"][last]),
                           "poor_reached_ci": [float(np.percentile([r["poor_reached"][last] for r in cr], 2.5)),
                                               float(np.percentile([r["poor_reached"][last] for r in cr], 97.5))],
                           "observed_poor_reached": float(a0["poor_reached"]),
                           "gain_per_1000_poor": float((c0["poor_reached"][last] - a0["poor_reached"]) * 1000),
                           "gain_per_1000_poor_ci": [float(np.percentile(diff, 2.5) * 1000), float(np.percentile(diff, 97.5) * 1000)],
                           "clear_gain": bool(np.percentile(diff, 2.5) > 0)})
    out = {"unit_cost": UNIT_COST, "n_boot": N_BOOT, "seed": SEED, "scorecard_features": feats,
           "scorecard_points": card, "records": records, "at_observed_coverage": at_obs}
    (ROOT / "outputs").mkdir(exist_ok=True)
    (ROOT / "outputs" / "simulator_grid_raw.json").write_text(json.dumps(out))
    (ROOT / "outputs" / "tables").mkdir(parents=True, exist_ok=True)
    pd.DataFrame(at_obs).to_csv(ROOT / "outputs" / "tables" / "simulation_at_observed_coverage.csv", index=False)

    nat = [r for r in at_obs if r["area"] == "national"]
    a = next(r for r in records if r["area"] == "national" and r["rule"] == "A")
    print(f"\nNATIONAL, at the observed coverage of {a['actual_coverage']:.1%} of households (95% CI):")
    print(f"  Rule A observed : poor reached {a['poor_reached']:.1%} ({a['poor_reached_ci'][0]:.1%}-{a['poor_reached_ci'][1]:.1%})  leakage {a['leakage']:.1%}")
    for r in nat:
        print(f"  Rule {r['rule']} {'model    ' if r['rule'] == 'B' else 'scorecard'}: poor reached {r['poor_reached']:.1%} "
              f"({r['poor_reached_ci'][0]:.1%}-{r['poor_reached_ci'][1]:.1%})  "
              f"gain {r['gain_per_1000_poor']:+.0f} per 1,000 poor ({r['gain_per_1000_poor_ci'][0]:+.0f} to {r['gain_per_1000_poor_ci'][1]:+.0f})"
              f"{'' if r['clear_gain'] else '  NOT clearly different'}")
    d = [r for r in at_obs if r["area"] != "national"]
    for rule in ["B", "C"]:
        dd = [r for r in d if r["rule"] == rule]
        print(f"Districts where rule {rule} clearly beats A: {sum(r['clear_gain'] for r in dd)} of {len(dd)}")
    print("\nScorecard points (code or quintile band -> points):")
    for t in card:
        print(f"  {t['feature']:10s} {t['band_or_code']:>6s} -> {t['points']:+d}")
    print(f"\nSaved outputs/simulator_grid_raw.json ({len(records)} records)")


if __name__ == "__main__":
    main()
