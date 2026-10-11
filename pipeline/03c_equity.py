"""
03c_equity.py - equity check: does each targeting rule reach poor households equally across groups?

Groups: urban / rural, female- / male-headed households, and the five provinces.
For every group the share of its POOR households that is reached is computed under
  Rule A  observed support (any support),
  Rule B  model-ranked (out-of-fold risk),
  Rule C  scorecard (out-of-fold points),
with the NATIONAL budget set to the programmes' actual coverage (rule A's share of all
households), i.e. each rule picks households nationwide and we look at who is reached.
Intervals: design-based bootstrap (clusters resampled within strata, same seed as the
other scripts).  Gains (B-A, C-A) are per 1,000 poor households of the group.

Run AFTER 03_model.py:   python pipeline/03c_equity.py
"""
import importlib
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold

sys.path.insert(0, str(Path(__file__).resolve().parent))
sim = importlib.import_module("04_simulate")          # reuse the scorecard code (definitions only)
from sim_utils import cluster_multipliers  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PROC = ROOT / "data" / "processed"
SEED, N_BOOT = 42, 200


def selection_fraction(score, w, budget):
    """Share of each household selected when the best-scoring households are supported up to the budget."""
    order = np.argsort(-np.asarray(score, float), kind="stable")
    ws = w[order]
    cum = np.cumsum(ws)
    cap = budget * cum[-1]
    fs = np.zeros_like(ws)
    pos = ws > 0
    fs[pos] = np.clip((cap - (cum[pos] - ws[pos])) / ws[pos], 0.0, 1.0)
    frac = np.empty_like(fs)
    frac[order] = fs
    return frac


def main():
    df = pd.read_parquet(PROC / "households.parquet")
    risk_df = pd.read_parquet(PROC / "oof_risk.parquet")
    mm = json.loads((ROOT / "outputs" / "model_metrics_raw.json").read_text())
    spec = json.loads((PROC / "feature_columns.json").read_text())
    assert (risk_df["hhid"].to_numpy() == df["hhid"].to_numpy()).all(), "oof_risk rows differ from households"
    risk_b = risk_df[f"oof_{mm['best_model']}_poor"].to_numpy()
    poor = df["poor"].to_numpy(float)
    w = df["weight"].to_numpy(float)
    sup = df["got_any_support"].to_numpy(float)

    feats = [i["feature"] for i in mm["feature_importance"] if i["feature"] in df.columns][:sim.N_POINTS_FEATURES]
    X = df[feats].apply(pd.to_numeric, errors="coerce")
    folds = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=SEED).split(X, poor.astype(int), df["clust"].to_numpy())
    score_c = np.zeros(len(df))
    for tr, te in folds:
        score_c[te], _ = sim.fit_scorecard(X.iloc[tr], poor[tr].astype(int), w[tr], X.iloc[te], feats, set(spec["numeric"]))

    budget = float((w * sup).sum() / w.sum())             # programmes' actual coverage
    M, cl = cluster_multipliers(df, N_BOOT, SEED)
    groups = [("Area", "Urban", df["urban"].to_numpy() == 1), ("Area", "Rural", df["urban"].to_numpy() == 0),
              ("Head of household", "Female-headed", df["head_female"].to_numpy() == 1),
              ("Head of household", "Male-headed", df["head_female"].to_numpy() == 0)]
    groups += [("Province", p, (df["province"] == p).to_numpy()) for p in sorted(df["province"].unique())]

    def reach_all(wb):
        fr = {"A": sup, "B": selection_fraction(risk_b, wb, budget), "C": selection_fraction(score_c, wb, budget)}
        return {name: {r: float((wb * poor * fr[r] * g).sum() / (wb * poor * g).sum()) for r in "ABC"}
                for _, name, g in groups}

    point = reach_all(w)
    reps = [reach_all(w * M[b][cl]) for b in range(N_BOOT)]
    rows = []
    for dim, name, g in groups:
        row = {"dimension": dim, "group": name, "n_households": int(g.sum()), "n_poor": int((g & (poor == 1)).sum()),
               "share_of_poor_households": float((w * poor * g).sum() / (w * poor).sum()),
               "poverty_rate": float((w * poor * g).sum() / (w * g).sum())}
        for r in "ABC":
            v = [x[name][r] for x in reps]
            row[f"reach_{r}"] = point[name][r]
            row[f"reach_{r}_ci"] = [float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))]
        for r in "BC":
            d = [(x[name][r] - x[name]["A"]) * 1000 for x in reps]
            row[f"gain_{r}_per_1000"] = (point[name][r] - point[name]["A"]) * 1000
            row[f"gain_{r}_ci"] = [float(np.percentile(d, 2.5)), float(np.percentile(d, 97.5))]
            row[f"gain_{r}_clear"] = bool(np.percentile(d, 2.5) > 0)
        row["small_cell"] = bool(row["n_poor"] < 30)
        rows.append(row)

    (ROOT / "outputs" / "tables").mkdir(parents=True, exist_ok=True)
    (ROOT / "outputs" / "equity_raw.json").write_text(json.dumps({"budget_share": budget, "n_boot": N_BOOT, "groups": rows}))
    pd.DataFrame(rows).to_csv(ROOT / "outputs" / "tables" / "equity_reach.csv", index=False)

    print(f"Equity check at the programmes' coverage ({budget:.1%} of households). Poor households reached:")
    print(f"{'group':16s}{'poor share':>11s}{'A observed':>12s}{'B model':>9s}{'C scorecard':>12s}   B gain/1,000 (95% CI)")
    for r in rows:
        print(f"{r['group']:16s}{r['share_of_poor_households']:11.0%}{r['reach_A']:12.1%}{r['reach_B']:9.1%}{r['reach_C']:12.1%}"
              f"   {r['gain_B_per_1000']:+5.0f} ({r['gain_B_ci'][0]:+.0f} to {r['gain_B_ci'][1]:+.0f}){'' if r['gain_B_clear'] else '  not clear'}"
              f"{'  [small]' if r['small_cell'] else ''}")
    print("Saved outputs/equity_raw.json and outputs/tables/equity_reach.csv")


if __name__ == "__main__":
    main()
