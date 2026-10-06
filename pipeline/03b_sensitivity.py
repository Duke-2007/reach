"""
03b_sensitivity.py - how much does the model rely on household size / composition?

Household size (adult equivalents) is by far the strongest feature. Consumption is
measured per adult equivalent, so size is partly mechanically related to poverty.
This script re-fits the logistic model (same folds, same preprocessing as
03_model.py) without the size/composition variables, and with housing and assets
only, then compares weighted out-of-fold AUC and the share of poor reached at the
observed programme coverage.

Run AFTER 03_model.py:   python pipeline/03b_sensitivity.py
"""
import importlib
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold

sys.path.insert(0, str(Path(__file__).resolve().parent))
m = importlib.import_module("03_model")          # reuse its helpers and constants
from sim_utils import cluster_multipliers, rule_metrics  # noqa: E402

SIZE_VARS = ["hh_size", "hh_size_ae", "n_children", "n_under5", "n_elderly", "n_adults",
             "share_children", "dependency_ratio", "rooms_per_person", "no_adult_women"]


def main():
    df = pd.read_parquet(m.PROC / "households.parquet")
    spec = json.loads((m.PROC / "feature_columns.json").read_text())
    cat, num = list(spec["categorical"]), list(spec["numeric"])
    X = df[cat + num].copy()
    for c in m.LIVESTOCK:
        if c in X:
            X[c] = X[c].fillna(0)
    miss = X.isna().mean()
    drop = set(miss[miss > m.MAX_MISSING].index)
    cat, num = [c for c in cat if c not in drop], [c for c in num if c not in drop]
    y, w = df["poor"].to_numpy(int), df["weight"].to_numpy(float)
    sw = w / w.mean()
    folds = list(StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=m.SEED)
                 .split(X, y, df["clust"].to_numpy()))
    M, cl = cluster_multipliers(df, 100, m.SEED)
    obs_cov = float((w * df["got_any_support"]).sum() / w.sum())

    housing = [c for c in cat + num if c.startswith(("s5", "s7")) or c == "urban"]
    sets = {"all features (as in 03_model)": cat + num,
            "without size / composition": [c for c in cat + num if c not in SIZE_VARS],
            "housing, water, energy, livestock only": housing}
    print(f"{'feature set':42s}{'n':>4s}  {'AUC (95% CI)':>24s}  {'poor reached @ ' + format(obs_cov, '.1%'):>20s}")
    for name, cols in sets.items():
        c_, n_ = [c for c in cols if c in cat], [c for c in cols if c in num]
        p = np.zeros(len(df))
        for tr, te in folds:
            pipe = m.make_pipeline("logistic", c_, n_)
            pipe.fit(X.iloc[tr][c_ + n_], y[tr], clf__sample_weight=sw[tr])
            p[te] = pipe.predict_proba(X.iloc[te][c_ + n_])[:, 1]
        auc = m.wauc(y, p, w)
        boots = [m.wauc(y, p, w * M[b][cl]) for b in range(100)]
        reach = rule_metrics(p, y, w, obs_cov)["poor_reached"]
        print(f"{name:42s}{len(cols):4d}  {auc:.3f} ({np.percentile(boots, 2.5):.3f}-{np.percentile(boots, 97.5):.3f})"
              f"{reach:20.1%}")


if __name__ == "__main__":
    main()
