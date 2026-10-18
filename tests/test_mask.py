"""Checks for Rwanda's outline and mask (run: python -m pytest tests/test_mask.py)."""
from pathlib import Path
import importlib
import json
import sys

import pytest

pytest.importorskip("shapely")
from shapely.geometry import Point, shape  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
mk = importlib.import_module("06b_rwanda_mask")
pytestmark = pytest.mark.skipif(not mk.GEO.exists(), reason="district boundaries not present")


def test_outline_covers_every_district_and_has_no_gaps():
    feats = json.loads(mk.GEO.read_text(encoding="utf-8"))["features"]
    outline = mk.national_outline()
    for f in feats:
        c = shape(f["geometry"]).representative_point()
        assert outline.contains(c), f["properties"]["shapeName"]
    assert outline.geom_type == "Polygon"                       # one country, no interior holes


def test_mask_hides_neighbours_but_not_rwanda():
    data = mk.build()
    mask = shape(data["features"][0]["geometry"])
    assert not mask.contains(Point(30.06, -1.94))               # Kigali is inside the hole: not masked
    assert mask.contains(Point(29.2, -1.7))                     # Goma (DR Congo) is masked
    assert mask.contains(Point(29.35, -3.38))                   # Bujumbura (Burundi) is masked
    assert mask.contains(Point(31.8, -1.3))                     # Tanzania (Kagera) is masked
