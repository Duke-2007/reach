"""
05b_export_extras.py - extra aggregated files for the web app.

  priority_table.json  one row per district (+ national): weighted number of poor households
                       missed, exclusion error, triple gap, poverty rate, with 95% intervals,
                       small-sample flags and the clear/unclear gain of rules B and C
  equity.json          do the rules reach poor households equally across groups? (03c_equity.py)
  method_facts.json    every number the "Method and limits" page quotes, so the page reads
                       them from the results instead of having them typed in

Same guarantees as 05_export.py: NaN becomes null, schema check, no household-level keys.
Run AFTER 05_export.py:   python pipeline/05b_export_extras.py
"""
import json
from pathlib import Path

import jsonschema
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "outputs"
APP = ROOT / "app" / "public" / "data"
PROC = ROOT / "data" / "processed"
SRC = "NISR EICV7 2023-24 (cross-sectional sample), household-weighted, 95% design-based intervals (strata + clusters)."
FORBIDDEN_KEYS = {"hhid", "pid", "household_id", "clust", "strata_id", "weight"}


def clean(o):
    if isinstance(o, dict):
        return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, (np.bool_, bool)):
        return bool(o)
    if isinstance(o, (np.integer, int)):
        return int(o)
    if isinstance(o, (np.floating, float)):
        return None if not np.isfinite(o) else round(float(o), 4)
    return o


def keys_of(o):
    if isinstance(o, dict):
        for k, v in o.items():
            yield k
            yield from keys_of(v)
    elif isinstance(o, list):
        for v in o:
            yield from keys_of(v)


df = pd.read_parquet(PROC / "households.parquet")
gaps = pd.read_csv(OUT / "tables" / "gaps_by_area.csv")
fin = pd.read_csv(OUT / "tables" / "financial_inclusion.csv").set_index("area")
sim = json.loads((OUT / "simulator_grid_raw.json").read_text())
mm = json.loads((OUT / "model_metrics_raw.json").read_text())
eq = json.loads((OUT / "equity_raw.json").read_text())
sens = json.loads((OUT / "sensitivity.json").read_text()) if (OUT / "sensitivity.json").exists() else None
g = gaps[(gaps.outcome == "got_any_support") & (gaps.poverty_def == "poor")].set_index("area")
province = df.groupby("district")["province"].first()
gain = {(r["area"], r["rule"]): r for r in sim["at_observed_coverage"]}
ci = lambda t, a, c: [t.loc[a, f"{c}_lo"], t.loc[a, f"{c}_hi"]]


def row(a):
    poor_hh = g.loc[a, "wt_poor_supported"] + g.loc[a, "wt_poor_missed"]
    key = "national" if a == "Rwanda" else a
    out = {"district": a, "province": None if a == "Rwanda" else province.get(a),
           "poor_households": int(round(poor_hh)),
           "poor_missed": int(round(g.loc[a, "wt_poor_missed"])),
           "poor_missed_ci": [int(round(g.loc[a, "wt_poor_missed_lo"])), int(round(g.loc[a, "wt_poor_missed_hi"]))],
           "exclusion_error": g.loc[a, "exclusion_error"], "exclusion_error_ci": ci(g, a, "exclusion_error"),
           "poverty_rate": g.loc[a, "poverty_rate"], "poverty_ci": ci(g, a, "poverty_rate"),
           "triple_gap": fin.loc[a, "triple_gap"], "triple_gap_ci": ci(fin, a, "triple_gap"),
           "triple_gap_households": int(round(fin.loc[a, "wt_triple_gap"])),
           "n_households": g.loc[a, "n_households"], "n_poor": g.loc[a, "n_poor"],
           "small_cell": bool(g.loc[a, "small_cell"] or fin.loc[a, "small_cell"])}
    for r in "BC":
        x = gain[(key, r)]
        out[f"gain_{r.lower()}_per_1000"] = x["gain_per_1000_poor"]
        out[f"gain_{r.lower()}_ci"] = x["gain_per_1000_poor_ci"]
        out[f"gain_{r.lower()}_clear"] = x["clear_gain"]
    return out


districts = [row(a) for a in g.index if a != "Rwanda"]
districts.sort(key=lambda r: -r["poor_missed"])
for i, r in enumerate(districts, 1):
    r["rank_missed"] = i
priority = {"placeholder": False,
            "note": f"{SRC} Weighted counts are households. Rank is by the number of poor households with no support. Gains are poor households reached per 1,000 poor households at the programmes' own coverage. {'Small samples are flagged small_cell.'}",
            "national": row("Rwanda"), "districts": districts}

# ---- equity
equity = {"placeholder": False,
          "note": f"{SRC} Each rule picks households nationwide up to the programmes' actual coverage; the table shows the share of each group's poor households that is reached. Gains are per 1,000 poor households of the group.",
          "budget_share": eq["budget_share"], "n_boot": eq["n_boot"], "groups": eq["groups"]}

# ---- method facts
nat = g.loc["Rwanda"]
pw, w = df["pop_wt"], df["weight"]
shares = {c: float((w * df[c]).sum() / w.sum()) for c in
          ["got_any_support", "got_direct_support", "got_classic_public_work", "got_expanded_public_work", "got_nsds"]}
best = mm["models"][f"poor_{mm['best_model']}"]
nat_gain = {r: gain[("national", r)] for r in "BC"}
facts = {"placeholder": False,
         "note": f"{SRC} Every number on the method page comes from this file.",
         "data": {"survey": "EICV7 2023-24", "n_households": len(df), "n_districts": int(df["district"].nunique()),
                  "n_strata": int(df["strata_id"].nunique()), "n_clusters": int(df["clust"].nunique())},
         "poverty": {"households_poor": nat.poverty_rate, "households_poor_ci": ci(g, "Rwanda", "poverty_rate"),
                     "persons_poor": float((pw * df["poor"]).sum() / pw.sum()),
                     "persons_extreme_poor": float((pw * df["extreme_poor"]).sum() / pw.sum())},
         "support": {"households_reached": shares["got_any_support"], "by_programme": {
             "direct_support": shares["got_direct_support"], "classic_public_work": shares["got_classic_public_work"],
             "expanded_public_work": shares["got_expanded_public_work"], "nsds": shares["got_nsds"]}},
         "headline": {"coverage_poor": nat.coverage_poor, "coverage_poor_ci": ci(g, "Rwanda", "coverage_poor"),
                      "exclusion_error": nat.exclusion_error, "exclusion_error_ci": ci(g, "Rwanda", "exclusion_error"),
                      "leakage": nat.leakage, "leakage_ci": ci(g, "Rwanda", "leakage"),
                      "financially_excluded_all": fin.loc["Rwanda", "financially_excluded"],
                      "financially_excluded_poor": fin.loc["Rwanda", "financially_excluded_among_poor"],
                      "financially_excluded_poor_ci": ci(fin, "Rwanda", "financially_excluded_among_poor")},
         "model": {"best_model": mm["best_model"], "auc": best["auc"], "auc_ci": best["auc_ci"],
                   "n_features": len(mm["features_used"]), "sensitivity": sens},
         "rules_at_observed_coverage": {
             "budget_share": nat_gain["B"]["budget_share"], "observed_poor_reached": nat_gain["B"]["observed_poor_reached"],
             "B": {"poor_reached": nat_gain["B"]["poor_reached"], "poor_reached_ci": nat_gain["B"]["poor_reached_ci"],
                   "gain_per_1000": nat_gain["B"]["gain_per_1000_poor"], "gain_ci": nat_gain["B"]["gain_per_1000_poor_ci"]},
             "C": {"poor_reached": nat_gain["C"]["poor_reached"], "poor_reached_ci": nat_gain["C"]["poor_reached_ci"],
                   "gain_per_1000": nat_gain["C"]["gain_per_1000_poor"], "gain_ci": nat_gain["C"]["gain_per_1000_poor_ci"]},
             "districts_where_B_clearly_better": int(sum(r["gain_b_clear"] for r in districts)),
             "districts_where_C_clearly_better": int(sum(r["gain_c_clear"] for r in districts))}}

share = {"type": ["number", "null"], "minimum": 0, "maximum": 1}
SCHEMAS = {
    "priority_table": {"type": "object", "required": ["placeholder", "national", "districts"], "properties": {
        "placeholder": {"const": False},
        "districts": {"type": "array", "minItems": 30, "maxItems": 30, "items": {
            "type": "object", "required": ["district", "rank_missed", "poor_missed", "poor_missed_ci", "exclusion_error", "small_cell"],
            "properties": {"exclusion_error": share, "poverty_rate": share, "triple_gap": share, "small_cell": {"type": "boolean"}}}}}},
    "equity": {"type": "object", "required": ["placeholder", "budget_share", "groups"], "properties": {
        "placeholder": {"const": False}, "budget_share": share,
        "groups": {"type": "array", "minItems": 9, "items": {"type": "object", "required": ["dimension", "group", "reach_A", "reach_B", "reach_C"]}}}},
    "method_facts": {"type": "object", "required": ["placeholder", "data", "poverty", "support", "headline", "model", "rules_at_observed_coverage"],
                     "properties": {"placeholder": {"const": False}}},
}
files = {"priority_table": priority, "equity": equity, "method_facts": facts}
print(f"{'file':16s}{'size':>9s}   checks")
for name, obj in files.items():
    obj = clean(obj)
    jsonschema.validate(obj, SCHEMAS[name])
    bad = FORBIDDEN_KEYS & set(keys_of(obj))
    if bad:
        raise SystemExit(f"{name}: household-level keys found: {bad}")
    text = json.dumps(obj, separators=(",", ":"), allow_nan=False)
    for d in (OUT, APP):
        d.mkdir(parents=True, exist_ok=True)
        (d / f"{name}.json").write_text(text, encoding="utf-8")
    (OUT / "schemas").mkdir(exist_ok=True)
    (OUT / "schemas" / f"{name}.schema.json").write_text(json.dumps(SCHEMAS[name], indent=2))
    print(f"{name:16s}{len(text) / 1024:7.0f} KB   schema ok, no household-level keys")

print("\nTop 5 districts by poor households missed (weighted, 95% CI):")
for r in districts[:5]:
    print(f"  {r['rank_missed']}. {r['district']:12s} {r['poor_missed']:7,d} ({r['poor_missed_ci'][0]:,d}-{r['poor_missed_ci'][1]:,d})"
          f"  exclusion {r['exclusion_error']:.0%}{'  [small sample]' if r['small_cell'] else ''}")
print("Districts where B / C clearly beat observed targeting:",
      facts["rules_at_observed_coverage"]["districts_where_B_clearly_better"], "/",
      facts["rules_at_observed_coverage"]["districts_where_C_clearly_better"], "of", len(districts))
