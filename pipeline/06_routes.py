"""
06_routes.py - district centres, straight-line distance and driving routes from Kigali.

For each of the 30 districts this writes (app/public/data/district_routes.json):
  centre       a point well inside the district (used for the map pin)
  straight_km  great-circle distance from Kigali city centre to that point
  road_km, duration_min, route   driving distance, time and line, from OSRM (OpenStreetMap roads)

The app never calls a routing service: routes are computed ONCE here and stored (simplified to about
150 points each). The OSRM public demo server is for reasonable, non-commercial use, at most 1 request per
second, with no uptime guarantee, and requires attribution (OpenStreetMap, ODbL; OSRM). So:
  * requests are 1.5 s apart, with an identifying User-Agent (set REACH_CONTACT to your contact);
  * answers are cached in data/processed/osrm_cache (re-runs make no new requests);
  * if the server is unreachable the straight-line values are still written and any road values
    already in district_routes.json are kept.
The target is the district's interior centre snapped to the nearest road by OSRM, not the district
headquarters, so road distances are approximate.

Run from the repo root:   python pipeline/06_routes.py
"""
import datetime
import json
import math
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
GEO = ROOT / "app" / "public" / "data" / "districts.geojson"
APP = ROOT / "app" / "public" / "data"
OUT = ROOT / "outputs"
CACHE = ROOT / "data" / "processed" / "osrm_cache"
ORIGIN = {"name": "Kigali city centre", "lon": 30.0619, "lat": -1.9441}
URL = ("https://router.project-osrm.org/route/v1/driving/{o_lon},{o_lat};{d_lon},{d_lat}"
       "?overview=simplified&geometries=geojson")
UA = f"Reach-NISR-Hackathon-2026/1.0 (one-off precomputation of 30 routes; contact: {os.environ.get('REACH_CONTACT', 'see project README')})"
ATTRIBUTION = "Routes: OSRM (FOSSGIS demo server). Road data (c) OpenStreetMap contributors, ODbL."
PAUSE_S = 1.5


# ---------------------------------------------------------------- geometry
def haversine_km(lon1, lat1, lon2, lat2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(a))


def polygons(geom):
    return [geom["coordinates"]] if geom["type"] == "Polygon" else list(geom["coordinates"])


def ring_area(ring):
    r = np.asarray(ring, float)
    return abs(float(np.dot(r[:-1, 0], r[1:, 1]) - np.dot(r[1:, 0], r[:-1, 1]))) / 2


def inside_ring(px, py, ring):
    """Vectorised ray casting: True where (px, py) lies inside the ring."""
    r = np.asarray(ring, float)
    x1, y1, x2, y2 = r[:-1, 0], r[:-1, 1], r[1:, 0], r[1:, 1]
    px, py = px[:, None], py[:, None]
    cross = ((y1 > py) != (y2 > py)) & (px < (x2 - x1) * (py - y1) / np.where(y2 == y1, 1e-12, y2 - y1) + x1)
    return cross.sum(axis=1) % 2 == 1


def seg_distance(points, rings, k):
    """Distance from each point to the nearest ring segment (degrees, longitude scaled by cos latitude)."""
    best = np.full(len(points), np.inf)
    for ring in rings:
        r = np.asarray(ring, float) * np.array([k, 1.0])
        a, b = r[:-1], r[1:]
        ab = b - a
        denom = np.maximum((ab ** 2).sum(axis=1), 1e-18)
        t = np.clip(((points[:, None, :] - a) * ab).sum(axis=2) / denom, 0, 1)
        proj = a + t[..., None] * ab
        best = np.minimum(best, np.sqrt(((points[:, None, :] - proj) ** 2).sum(axis=2)).min(axis=1))
    return best


def interior_point(geom, n=36):
    """The grid point inside the largest polygon that is farthest from its boundary (a robust 'centre')."""
    polys = polygons(geom)
    poly = max(polys, key=lambda p: ring_area(p[0]))
    outer = np.asarray(poly[0], float)
    k = math.cos(math.radians(outer[:, 1].mean()))
    xs = np.linspace(outer[:, 0].min(), outer[:, 0].max(), n)
    ys = np.linspace(outer[:, 1].min(), outer[:, 1].max(), n)
    gx, gy = np.meshgrid(xs, ys)
    px, py = gx.ravel(), gy.ravel()
    ok = inside_ring(px, py, poly[0])
    for hole in poly[1:]:
        ok &= ~inside_ring(px, py, hole)
    if not ok.any():                                       # tiny polygon: fall back to the vertex mean
        return float(outer[:, 0].mean()), float(outer[:, 1].mean())
    pts = np.column_stack([px[ok] * k, py[ok]])
    d = seg_distance(pts, poly, k)
    i = int(np.argmax(d))
    return float(px[ok][i]), float(py[ok][i])


def simplify(line, tol=0.0004):
    """Douglas-Peucker on [lon, lat] points (tolerance in degrees, about 40 m)."""
    pts = np.asarray(line, float)
    if len(pts) <= 2:
        return pts.tolist()
    keep = np.zeros(len(pts), bool)
    keep[[0, -1]] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        s, e = stack.pop()
        if e <= s + 1:
            continue
        a, b = pts[s], pts[e]
        ab = b - a
        denom = max(float((ab ** 2).sum()), 1e-18)
        t = np.clip(((pts[s + 1:e] - a) @ ab) / denom, 0, 1)
        d = np.linalg.norm(pts[s + 1:e] - (a + t[:, None] * ab), axis=1)
        i = int(np.argmax(d))
        if d[i] > tol:
            keep[s + 1 + i] = True
            stack += [(s, s + 1 + i), (s + 1 + i, e)]
    return pts[keep].tolist()


# ---------------------------------------------------------------- routing
def fetch_route(o_lon, o_lat, d_lon, d_lat, retries=2):
    url = URL.format(o_lon=o_lon, o_lat=o_lat, d_lon=d_lon, d_lat=d_lat)
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            if data.get("code") != "Ok" or not data.get("routes"):
                return None
            r = data["routes"][0]
            return {"road_km": r["distance"] / 1000, "duration_min": r["duration"] / 60,
                    "route": r["geometry"]["coordinates"]}
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            print(f"    request failed ({exc}); {'retrying' if attempt < retries else 'giving up'}")
            time.sleep(PAUSE_S * (attempt + 2))
    return None


def build(routing=True):
    feats = json.loads(GEO.read_text(encoding="utf-8"))["features"]
    old = {}
    if (APP / "district_routes.json").exists():
        old = json.loads((APP / "district_routes.json").read_text(encoding="utf-8")).get("routes", {})
    CACHE.mkdir(parents=True, exist_ok=True)
    routes, requests_made = {}, 0
    for f in sorted(feats, key=lambda f: f["properties"]["shapeName"]):
        name = f["properties"]["shapeName"]
        lon, lat = interior_point(f["geometry"])
        entry = {"centre": [round(lon, 5), round(lat, 5)],
                 "straight_km": round(haversine_km(ORIGIN["lon"], ORIGIN["lat"], lon, lat), 1),
                 "road_km": None, "duration_min": None, "route": None}
        cache_file = CACHE / f"{name}.json"
        got = None
        if cache_file.exists():
            got = json.loads(cache_file.read_text(encoding="utf-8"))
        elif routing:
            if requests_made:
                time.sleep(PAUSE_S)
            print(f"  routing Kigali -> {name} ...")
            got = fetch_route(ORIGIN["lon"], ORIGIN["lat"], lon, lat)
            requests_made += 1
            if got:
                cache_file.write_text(json.dumps(got), encoding="utf-8")
        if not got and old.get(name, {}).get("road_km"):      # keep earlier good values
            got = {k: old[name][k] for k in ("road_km", "duration_min", "route")}
        if got:
            entry.update(road_km=round(got["road_km"], 1), duration_min=round(got["duration_min"]),
                         route=[[round(x, 4), round(y, 4)] for x, y in simplify(got["route"])])
        routes[name] = entry
    return routes


def main():
    routing = os.environ.get("REACH_ROUTES_OFFLINE") != "1"
    routes = build(routing)
    out = {"placeholder": False,
           "note": "Distances and routes from Kigali city centre to an interior point of each district. Straight-line distance is exact geometry; road distance and time come from OSRM on OpenStreetMap roads and are approximate (the target is snapped to the nearest road, not the district headquarters).",
           "attribution": ATTRIBUTION, "generated": datetime.date.today().isoformat(), "origin": ORIGIN, "routes": routes}
    text = json.dumps(out, separators=(",", ":"))
    for d in (APP, OUT):
        d.mkdir(parents=True, exist_ok=True)
        (d / "district_routes.json").write_text(text, encoding="utf-8")
    with_road = [n for n, r in routes.items() if r["road_km"]]
    print(f"{len(routes)} districts; road routes for {len(with_road)}; file {len(text) / 1024:.0f} KB")
    print(f"{'district':14s}{'straight km':>12s}{'road km':>9s}{'min':>6s}{'points':>8s}")
    for n, r in routes.items():
        print(f"{n:14s}{r['straight_km']:12.1f}{(r['road_km'] or float('nan')):9.1f}{(r['duration_min'] or 0):6d}{len(r['route'] or []):8d}")
    odd = [n for n in with_road if not 0.95 <= routes[n]["road_km"] / max(routes[n]["straight_km"], 0.1) <= 3.0]
    if odd:
        print("CHECK these (road/straight ratio outside 0.95-3.0):", odd)
    if not with_road:
        print("No road routes: the routing server was unreachable. Straight-line values were written; re-run later.")


if __name__ == "__main__":
    main()
