"""
06b_rwanda_mask.py - Rwanda's national outline and a "mask" that hides everything outside it.

The road basemap (OpenFreeMap) shows the whole world. Drawing the mask on top of it, below the
districts, makes the map show Rwanda only: other countries' roads, towns and labels are covered.

How: the 30 district polygons are dissolved into one national outline; the mask is a world-sized
rectangle with that outline cut out. The file also holds the outline (for a border line) and a
bounding box with padding (for restricting panning).

Needs the optional package shapely (pip install shapely). The result is committed, so shapely is
only needed to regenerate it.

Run from the repo root:   python pipeline/06b_rwanda_mask.py
"""
import json
from pathlib import Path

try:
    from shapely.geometry import MultiPolygon, Polygon, mapping, shape
    from shapely.geometry.polygon import orient
    from shapely.ops import unary_union
except ImportError as exc:                                    # pragma: no cover
    raise SystemExit("This step needs shapely: pip install shapely  (the committed file works without it)") from exc

ROOT = Path(__file__).resolve().parent.parent
GEO = ROOT / "app" / "public" / "data" / "districts.geojson"
APP = ROOT / "app" / "public" / "data"
OUT = ROOT / "outputs"
CLOSE = 0.0004            # degrees (about 45 m): closes hairline gaps between neighbouring districts
PAD = 0.25                # degrees of padding around Rwanda for the allowed panning area


def national_outline():
    feats = json.loads(GEO.read_text(encoding="utf-8"))["features"]
    union = unary_union([shape(f["geometry"]).buffer(0) for f in feats])
    union = union.buffer(CLOSE).buffer(-CLOSE)                # dissolve slivers between districts
    union = union.simplify(0.0008)
    polys = [union] if isinstance(union, Polygon) else list(union.geoms)
    polys = [Polygon(p.exterior) for p in polys]              # drop interior holes: Rwanda has none
    return MultiPolygon(polys) if len(polys) > 1 else polys[0]


def build():
    outline = national_outline()
    polys = [outline] if isinstance(outline, Polygon) else list(outline.geoms)
    world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]
    holes = [list(orient(p, sign=-1.0).exterior.coords) for p in polys]          # holes wind clockwise
    minx, miny, maxx, maxy = outline.bounds
    bbox = [round(minx, 4), round(miny, 4), round(maxx, 4), round(maxy, 4)]
    return {"type": "FeatureCollection",
            "bbox": bbox,
            "properties": {"max_bounds": [[round(minx - PAD, 3), round(miny - PAD, 3)], [round(maxx + PAD, 3), round(maxy + PAD, 3)]],
                           "note": "mask = world rectangle with Rwanda cut out; outline = Rwanda's border (districts dissolved). Source: geoBoundaries gbOpen RWA ADM2, CC BY 4.0."},
            "features": [
                {"type": "Feature", "properties": {"kind": "mask"}, "geometry": {"type": "Polygon", "coordinates": [world] + [[[round(x, 5), round(y, 5)] for x, y in h] for h in holes]}},
                {"type": "Feature", "properties": {"kind": "outline"}, "geometry": {"type": "MultiPolygon", "coordinates": [[[[round(x, 5), round(y, 5)] for x, y in orient(p, sign=1.0).exterior.coords]] for p in polys]}}]}


def main():
    data = build()
    text = json.dumps(data, separators=(",", ":"))
    for d in (APP, OUT):
        d.mkdir(parents=True, exist_ok=True)
        (d / "rwanda_mask.geojson").write_text(text, encoding="utf-8")
    n = len(data["features"][1]["geometry"]["coordinates"])
    print(f"rwanda_mask.geojson: {len(text) / 1024:.0f} KB, {n} polygon(s), bbox {data['bbox']}")
    print("max bounds for the map:", data["properties"]["max_bounds"])


if __name__ == "__main__":
    main()
