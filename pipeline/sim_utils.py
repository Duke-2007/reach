"""
sim_utils.py - helpers shared by the model and the simulator.

cluster_multipliers : design-based bootstrap. Within every stratum, clusters are
                      resampled with replacement; the result is a matrix of
                      multiplicities (n_boot x n_clusters). Multiplying the survey
                      weights by these gives one bootstrap replicate.
rule_metrics        : what a targeting rule achieves at a given budget.
"""
import numpy as np
import pandas as pd


def cluster_multipliers(df, n_boot, seed, strata="strata_id", cluster="clust"):
    """Return (M, cl): M[b, c] = times cluster c is drawn in replicate b; cl = cluster code per row."""
    rng = np.random.default_rng(seed)
    s = pd.Series(df[strata].to_numpy()).astype(int)
    key = s.astype(str) + "_" + pd.Series(df[cluster].to_numpy()).astype(int).astype(str)
    cl, uniques = pd.factorize(key)
    cl_strata = np.zeros(len(uniques), dtype=np.int64)
    cl_strata[cl] = s.to_numpy()
    M = np.zeros((n_boot, len(uniques)))
    for h in np.unique(cl_strata):
        idx = np.where(cl_strata == h)[0]
        n_h = len(idx)
        M[:, idx] = rng.multinomial(n_h, np.full(n_h, 1.0 / n_h), size=n_boot)
    return M, cl


def rule_metrics(score, poor, w, budget, extreme=None):
    """
    Rank households by `score` (highest first) and support them until the budget
    (a share of all households, by weight) is used; the last household is taken
    fractionally so the budget is hit exactly and results are monotone in budget.
    Returns weighted poor_reached, extreme_poor_reached, exclusion_error, leakage.
    """
    order = np.argsort(-np.asarray(score, float), kind="stable")
    ws, ps = w[order], poor[order].astype(float)
    cum = np.cumsum(ws)
    cap = budget * cum[-1]
    frac = np.zeros_like(ws)                              # share of each household selected
    pos = ws > 0                                          # bootstrap replicates can give weight 0
    frac[pos] = np.clip((cap - (cum[pos] - ws[pos])) / ws[pos], 0.0, 1.0)
    sel = ws * frac
    reached = float((sel * ps).sum() / (ws * ps).sum())
    out = {"poor_reached": reached, "exclusion_error": 1.0 - reached,
           "leakage": float((sel * (1 - ps)).sum() / sel.sum()) if sel.sum() > 0 else np.nan}
    if extreme is not None:
        es = extreme[order].astype(float)
        out["extreme_poor_reached"] = float((sel * es).sum() / (ws * es).sum())
    return out
