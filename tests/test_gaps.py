"""Checks for the weighted gap tables (run: python -m pytest tests/test_gaps.py)."""
from pathlib import Path
import sys

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
from survey_stats import Design, ci_prop  # noqa: E402

TABLE = ROOT / "outputs" / "tables" / "gaps_by_area.csv"


def test_variance_matches_simple_case():
    """One stratum, equal weights, clusters of size 1: SE of a mean = sd/sqrt(n)."""
    rng = np.random.default_rng(1)
    y = (rng.random(400) < 0.3).astype(float)
    df = pd.DataFrame({"weight": 1.0, "strata_id": 1, "clust": np.arange(400)})
    p, se = Design(df).proportion(y)
    assert p == pytest.approx(y.mean())
    assert se == pytest.approx(np.sqrt(y.var(ddof=1) / 400), rel=1e-6)


def test_ci_inside_unit_interval():
    lo, hi = ci_prop(0.02, 0.01)
    assert 0 <= lo < 0.02 < hi <= 1


@pytest.mark.skipif(not TABLE.exists(), reason="run 02_weighted_gaps.py first")
def test_boxes_sum_to_one_and_exclusion_plus_coverage():
    t = pd.read_csv(TABLE)
    boxes = [c for c in t.columns if c.startswith("share_")]
    assert np.allclose(t[boxes].sum(axis=1), 1.0)
    # An estimate may be empty only when its group has no households at all.
    empty = t["exclusion_error"].isna()
    assert (t.loc[empty, "n_poor"] == 0).all()
    ok = t[~empty]
    assert np.allclose(ok["coverage_poor"] + ok["exclusion_error"], 1.0)
    assert (ok["exclusion_error_lo"] <= ok["exclusion_error"] + 1e-9).all()
    assert (ok["exclusion_error"] <= ok["exclusion_error_hi"] + 1e-9).all()
