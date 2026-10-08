"""
peek_contract.py - print (1) the structure of the four app data files, (2) the code labels
needed to read the scorecard and build the missed-vs-covered traits, (3) a NaN count in the
simulator output.  Prints structure, labels and counts only - no data rows.

Run from the repo root:   python pipeline/peek_contract.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "app" / "public" / "data"


def shape(o, depth=0, maxdepth=3):
    pad = "  " * depth
    if isinstance(o, dict):
        for k, v in o.items():
            if isinstance(v, (dict, list)) and depth < maxdepth:
                kind = f"list[{len(v)}]" if isinstance(v, list) else "object"
                print(f"{pad}{k}: {kind}")
                shape(v, depth + 1, maxdepth)
            else:
                s = repr(v)
                print(f"{pad}{k}: {s[:70] + '...' if len(s) > 70 else s}")
    elif isinstance(o, list) and o:
        if isinstance(o[0], (dict, list)):
            print(f"{pad}[0] ->")
            shape(o[0], depth + 1, maxdepth)
        else:
            print(f"{pad}values like: {o[:4]}")


for name in ["district_gaps", "profiles", "model_metrics", "simulator_grid"]:
    print(f"\n==================== {name}.json")
    try:
        d = json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))
        if name == "simulator_grid":                     # keep it short: show 1 record per rule only
            recs = d.get("records", [])
            d = {k: v for k, v in d.items() if k != "records"}
            d["records"] = [next(r for r in recs if r["rule"] == "A"), next(r for r in recs if r["rule"] == "B")]
        shape(d)
    except Exception as exc:
        print("could not read:", exc)

print("\n==================== code labels (from docs/data-notes.md)")
t = (ROOT / "docs" / "data-notes.md").read_text(encoding="utf-8")
sec = [x for x in t.split("\n## ") if x.startswith("CS_S01_S5_S7")][0]
for col in ["s5cq14", "s5cq3", "s5cq25", "s5cq20a", "s5cq22a", "s5dq3", "s5dq2", "s5aq7", "s7aq4a"]:
    hit = [l for l in sec.splitlines() if l.startswith(f"- `{col}`")]
    print(hit[0] if hit else f"- `{col}`: no labels stored")

print("\n==================== NaN check in outputs/simulator_grid_raw.json")
raw = (ROOT / "outputs" / "simulator_grid_raw.json").read_text(encoding="utf-8")
print("NaN occurrences:", raw.count("NaN"))
if raw.count("NaN"):
    d = json.loads(raw)
    bad = sorted({(r["area"], r["rule"]) for r in d["records"]
                  if any(isinstance(v, float) and v != v for v in r.values())})
    print("areas/rules with empty estimates:", bad[:12])
