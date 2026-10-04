"""
survey_stats.py - weighted estimates with design-based confidence intervals.

Method: Taylor linearisation for a stratified, clustered sample (strata_id,
clust = primary sampling units), with-replacement approximation and no finite
population correction (the sampling fraction is tiny).  Chosen over a bootstrap
because it is exact to compute, fast and reproducible.

DOMAIN ESTIMATION: for a sub-population (a district, "poor households", ...) the
estimate is a ratio  R = sum(w*y*d) / sum(w*d)  where d marks the domain.  The
variance is computed over the WHOLE sample (rows outside the domain contribute
zeros), which is the correct way; filtering the table first would understate
the variance.

Intervals for proportions use the logit scale, so they stay inside [0, 1].
"""
import numpy as np
import pandas as pd

Z95 = 1.959964


class Design:
    def __init__(self, df, weight="weight", strata="strata_id", cluster="clust"):
        self.w = df[weight].to_numpy(float)
        strata_v = df[strata].to_numpy()
        key = pd.Series(strata_v).astype(int).astype(str) + "_" + \
            pd.Series(df[cluster].to_numpy()).astype(int).astype(str)
        self.cl, uniques = pd.factorize(key)
        self.n_cl = len(uniques)
        # stratum of each cluster
        cl_strata = np.zeros(self.n_cl, dtype=np.int64)
        cl_strata[self.cl] = pd.Series(strata_v).astype(int).to_numpy()
        self.cl_strata = cl_strata
        self.n_strata = len(np.unique(cl_strata))

    def _var_total(self, z):
        """Variance of sum(z) under stratified cluster sampling."""
        t = np.bincount(self.cl, weights=z, minlength=self.n_cl)
        d = pd.DataFrame({"h": self.cl_strata, "t": t})
        g = d.groupby("h")["t"]
        n = g.transform("size").to_numpy(float)
        m = g.transform("mean").to_numpy(float)
        ok = n > 1  # strata with a single cluster cannot give a variance
        return float(((n[ok] / (n[ok] - 1)) * (t[ok] - m[ok]) ** 2).sum())

    def total(self, y):
        """Weighted total of y with its standard error."""
        z = self.w * y
        return float(z.sum()), float(np.sqrt(self._var_total(z)))

    def ratio(self, num, den):
        """Ratio estimator sum(w*num)/sum(w*den); returns (estimate, se)."""
        den_tot = float((self.w * den).sum())
        if den_tot <= 0:
            return np.nan, np.nan
        r = float((self.w * num).sum() / den_tot)
        z = self.w * (num - r * den) / den_tot
        return r, float(np.sqrt(self._var_total(z)))

    def proportion(self, y, domain=None):
        """Weighted share of y inside `domain` (default: everyone)."""
        d = np.ones_like(self.w) if domain is None else domain.astype(float)
        return self.ratio(y.astype(float) * d, d)


def ci_prop(p, se, z=Z95):
    """95% CI for a proportion on the logit scale (falls back to p,p at 0/1)."""
    if not np.isfinite(p) or not np.isfinite(se):
        return np.nan, np.nan
    if p <= 0 or p >= 1 or se == 0:
        return float(p), float(p)
    logit = np.log(p / (1 - p))
    s = se / (p * (1 - p))
    lo, hi = logit - z * s, logit + z * s
    return float(1 / (1 + np.exp(-lo))), float(1 / (1 + np.exp(-hi)))


def ci_total(t, se, z=Z95):
    return max(0.0, t - z * se), t + z * se
