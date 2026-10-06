"""Checks for the simulator (run: python -m pytest tests/test_simulate.py)."""
from pathlib import Path
import importlib
import sys

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
sim = importlib.import_module("04_simulate")
from sim_utils import rule_metrics  # noqa: E402

rng = np.random.default_rng(5)
N = 800
W = rng.random(N) * 100 + 5
POOR = (rng.random(N) < 0.25).astype(int)
EXT = POOR * (rng.random(N) < 0.3).astype(int)
SCORE = POOR * 0.6 + rng.random(N)
B = np.arange(0, 101) / 100.0


def test_curve_matches_rule_metrics():
    c = sim.curve(SCORE, POOR, EXT, W, B)
    for i in (1, 10, 33, 50, 77, 100):
        m = rule_metrics(SCORE, POOR, W, B[i], EXT)
        assert c["poor_reached"][i] == pytest.approx(m["poor_reached"])
        assert c["extreme_poor_reached"][i] == pytest.approx(m["extreme_poor_reached"])
        assert c["leakage"][i] == pytest.approx(m["leakage"])


def test_zero_and_full_budget():
    c = sim.curve(SCORE, POOR, EXT, W, B)
    assert c["poor_reached"][0] == 0.0
    assert c["poor_reached"][-1] == pytest.approx(1.0)
    assert c["exclusion_error"][-1] == pytest.approx(0.0)


def test_monotone_in_budget():
    c = sim.curve(SCORE, POOR, EXT, W, B)
    assert (np.diff(c["poor_reached"]) >= -1e-12).all()
    assert (np.diff(c["extreme_poor_reached"]) >= -1e-12).all()


def test_survives_zero_weights():
    w = W.copy()
    w[:100] = 0
    c = sim.curve(SCORE, POOR, EXT, w, B)
    assert np.isfinite(c["poor_reached"]).all()
