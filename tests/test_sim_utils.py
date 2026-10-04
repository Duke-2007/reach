"""Checks for the budget/targeting helpers (run: python -m pytest tests/test_sim_utils.py)."""
from pathlib import Path
import sys

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
from sim_utils import rule_metrics  # noqa: E402

rng = np.random.default_rng(0)
N = 500
W = rng.random(N) * 100 + 10
POOR = (rng.random(N) < 0.3).astype(int)
SCORE = POOR * 0.5 + rng.random(N)          # informative but imperfect


def test_zero_budget_reaches_nobody():
    assert rule_metrics(SCORE, POOR, W, 0.0)["poor_reached"] == 0.0


def test_full_budget_reaches_every_poor_household():
    m = rule_metrics(SCORE, POOR, W, 1.0)
    assert m["poor_reached"] == pytest.approx(1.0)
    assert m["exclusion_error"] == pytest.approx(0.0)


def test_reach_is_monotone_in_budget():
    reach = [rule_metrics(SCORE, POOR, W, b)["poor_reached"] for b in np.linspace(0, 1, 21)]
    assert all(b >= a - 1e-12 for a, b in zip(reach, reach[1:]))


def test_good_score_beats_random_and_perfect_score_is_best():
    b = 0.2
    informative = rule_metrics(SCORE, POOR, W, b)["poor_reached"]
    perfect = rule_metrics(POOR + 0.0, POOR, W, b)["poor_reached"]
    assert informative > b                       # better than random targeting
    assert perfect >= informative


def test_zero_weight_households_do_not_break_it():
    w = W.copy()
    w[:50] = 0.0
    m = rule_metrics(SCORE, POOR, w, 0.3)
    assert 0 <= m["poor_reached"] <= 1 and np.isfinite(m["leakage"])
