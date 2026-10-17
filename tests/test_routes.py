"""Checks for the district centres and routes (run: python -m pytest tests/test_routes.py)."""
from pathlib import Path
import importlib
import json
import sys

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
rt = importlib.import_module("06_routes")


def test_haversine_known_value():
    assert rt.haversine_km(0, 0, 1, 0) == pytest.approx(111.195, abs=0.05)


def test_interior_point_is_inside_a_concave_polygon():
    # An L-shape whose plain centroid falls outside the shape.
    ring = [[0, 0], [10, 0], [10, 1], [1, 1], [1, 10], [0, 10], [0, 0]]
    lon, lat = rt.interior_point({"type": "Polygon", "coordinates": [ring]})
    assert rt.inside_ring(np.array([lon]), np.array([lat]), ring)[0]


def test_simplify_keeps_ends_and_removes_points():
    line = [[x / 100, 0.00001 * (x % 2)] for x in range(200)]
    s = rt.simplify(line)
    assert s[0] == line[0] and s[-1] == line[-1] and len(s) < 20


@pytest.mark.skipif(not rt.GEO.exists(), reason="district boundaries not present")
def test_every_real_district_centre_is_inside_its_district():
    feats = json.loads(rt.GEO.read_text(encoding="utf-8"))["features"]
    assert len(feats) == 30
    for f in feats:
        lon, lat = rt.interior_point(f["geometry"])
        inside = any(rt.inside_ring(np.array([lon]), np.array([lat]), poly[0])[0] for poly in rt.polygons(f["geometry"]))
        assert inside, f["properties"]["shapeName"]


def test_build_with_mocked_routing_and_offline_fallback(tmp_path, monkeypatch):
    monkeypatch.setattr(rt, "CACHE", tmp_path / "cache")
    monkeypatch.setattr(rt, "APP", tmp_path / "app")
    monkeypatch.setattr(rt, "PAUSE_S", 0)
    calls = []

    def fake(o_lon, o_lat, d_lon, d_lat, retries=2):
        calls.append(1)
        return {"road_km": 1.3 * rt.haversine_km(o_lon, o_lat, d_lon, d_lat), "duration_min": 30.0,
                "route": [[o_lon, o_lat], [(o_lon + d_lon) / 2, (o_lat + d_lat) / 2 + 0.01], [d_lon, d_lat]]}
    monkeypatch.setattr(rt, "fetch_route", fake)
    routes = rt.build(True)
    assert len(calls) == 30 and all(r["road_km"] > r["straight_km"] for r in routes.values())
    routes2 = rt.build(True)                       # second run uses the cache: no new requests
    assert len(calls) == 30 and routes2 == routes
