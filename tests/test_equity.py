"""Checks for the equity helper (run: python -m pytest tests/test_equity.py)."""
from pathlib import Path
import importlib
import sys

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
eq = importlib.import_module("03c_equity")

rng = np.random.default_rng(11)
W = rng.random(400) * 50 + 5
SCORE = rng.random(400)


def test_selected_weight_equals_budget():
    for b in (0.0, 0.1, 0.37, 1.0):
        frac = eq.selection_fraction(SCORE, W, b)
        assert (frac * W).sum() == pytest.approx(b * W.sum())
        assert ((frac >= 0) & (frac <= 1)).all()


def test_best_scores_are_selected_first():
    frac = eq.selection_fraction(SCORE, W, 0.2)
    assert frac[np.argmax(SCORE)] == 1.0 and frac[np.argmin(SCORE)] == 0.0


def test_zero_weights_do_not_break_it():
    w = W.copy()
    w[:60] = 0
    frac = eq.selection_fraction(SCORE, w, 0.3)
    assert np.isfinite(frac).all() and (frac * w).sum() == pytest.approx(0.3 * w.sum())
