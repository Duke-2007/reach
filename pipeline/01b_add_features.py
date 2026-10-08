"""
01b_add_features.py - add head-of-household, household-composition and
access-to-services features to data/processed/households.parquet.

Run AFTER 01_load_clean.py.  Safe to re-run (it replaces the columns it adds).

Evidence for the codes (from pipeline/peek_codes.py output):
  s1q1  1 Male, 2 Female               s1q2  1 = household head (one per household)
  s4aq1 1 ever attended school, 2 never
  s4aq2 highest level: 1 ECD, 2 nursery, 3 primary, 4 vocational (Ingoboka),
        5 lower secondary, 6 upper secondary, 7 tertiary
  CS_S5F is LONG: one row per household x service (ids 1-15); s5fq4 = distance to
  the nearest service.  Values (415, 830, 1660 ...) look like metres imputed from
  minutes of walking, so metres are ASSUMED; check against the questionnaire.

Only non-consumption variables are used; the forbidden-column check at the end
protects against leakage.

Run from the repo root:   python pipeline/01b_add_features.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pyreadstat

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
DATA = ROOT / "data" / "processed" / "households.parquet"
FEATURE_JSON = ROOT / "data" / "processed" / "feature_columns.json"

# Features created by 01_load_clean.py (copied here so the model step has ONE list).
CAT_FROM_01 = ["s5aq1", "s5aq2", "s5aq7", "s5cq1", "s5cq3", "s5cq14", "s5cq16", "s5cq20a",
               "s5cq21", "s5cq22a", "s5cq25", "s5cq26", "s5dq1", "s5dq2", "s5dq3", "s7aq4"]
NUM_FROM_01 = ["s5aq3", "s5cq2a", "s5cq2b", "s7aq4a", "s7aq4b", "s7aq4c", "s7aq4d", "s7aq4e",
               "s7aq4f", "rooms_per_person", "urban", "hh_size", "hh_size_ae"]
FORBIDDEN_COLUMNS = {
    "exp1", "exp2", "exp3", "exp4", "exp5", "exp6", "exp7", "exp8", "exp9", "exp10", "exp11",
    "Food_at_school", "hh_index", "sol_jan", "quintile", "food", "cons1", "cons1ae", "pov_jan",
    "poverty", "epov_jan", "Poverty_line", "Extreme_line", "poor", "extreme_poor",
    "s5bq1", "s5bq2a", "s5bq3a", "s5bq5a", "s5bq8", "s5cq9b", "s5cq11", "s5cq12", "s5cq20",
    "s7a2q1", "s7a2q4",
}
# Services kept as features (ids from CS_S5F value labels).
SERVICES = {1: "water", 2: "market", 4: "transport", 5: "road", 7: "primary_school",
            8: "secondary_school", 9: "district_hospital", 10: "health_centre",
            12: "sector_office"}
EDU_ORDER = {1: 1, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6}   # 0 = never attended


def read(stem, usecols):
    hits = list(RAW.rglob(stem + ".dta"))
    if len(hits) != 1:
        raise SystemExit(f"Expected exactly one {stem}.dta, found {len(hits)}")
    last = None
    for enc in (None, "latin1", "cp1252"):
        try:
            return pyreadstat.read_dta(str(hits[0]), usecols=usecols, encoding=enc)[0]
        except UnicodeDecodeError as exc:
            last = exc
    raise last


num = lambda s: pd.to_numeric(s, errors="coerce")
hid = lambda s: np.rint(num(s)).astype("int64")

hh = pd.read_parquet(DATA)
new_cols = []

# ---- person file: household head + composition ----------------------------
p = read("CS_S0_S1_S2_S3_S4_S6A_S6B_S6C_Person",
         ["hhid", "s1q1", "s1q2", "s1q3y", "s1q4", "s4aq1", "s4aq2"])
p["hhid"] = hid(p["hhid"])
p["age"] = num(p["s1q3y"])
p["female"] = num(p["s1q1"]) == 2
rel = num(p["s1q2"])
heads = p[rel == 1].set_index("hhid")
assert heads.index.is_unique, "more than one household head in a household"
assert hh["hhid"].isin(heads.index).all(), "households without a head"
heads = heads.reindex(hh["hhid"])

lvl = num(heads["s4aq2"]).to_numpy()
never = (num(heads["s4aq1"]) == 2).to_numpy()
edu = pd.Series(lvl).map(EDU_ORDER)
edu = edu.where(~never, 0.0)                      # never attended -> 0
feat = pd.DataFrame({
    "head_female": heads["female"].astype(int).to_numpy(),
    "head_age": heads["age"].to_numpy(),
    "head_marital": num(heads["s1q4"]).to_numpy(),               # categorical code
    "head_edu_cat": edu.to_numpy(),                              # categorical (0-6)
    "head_primary_plus": pd.Series(lvl).isin([3, 4, 5, 6, 7]).astype(int).to_numpy(),
    "head_never_school": never.astype(int),
}, index=hh.index)

age = p["age"]
p["child"] = age < 15
p["under5"] = age < 5
p["elder"] = age >= 65
p["adult"] = (age >= 15) & (age < 65)
p["adult_f"] = p["adult"] & p["female"]
p["sec_plus"] = num(p["s4aq2"]).isin([5, 6, 7])
agg = p.groupby("hhid").agg(n_persons=("age", "size"), n_children=("child", "sum"),
                            n_under5=("under5", "sum"), n_elderly=("elder", "sum"),
                            n_adults=("adult", "sum"), n_adult_women=("adult_f", "sum"),
                            any_secondary_plus=("sec_plus", "max")).reindex(hh["hhid"])
agg.index = hh.index
feat["n_children"] = agg["n_children"]
feat["n_under5"] = agg["n_under5"]
feat["n_elderly"] = agg["n_elderly"]
feat["n_adults"] = agg["n_adults"]
feat["share_children"] = agg["n_children"] / agg["n_persons"]
feat["dependency_ratio"] = (agg["n_children"] + agg["n_elderly"]) / agg["n_adults"].clip(lower=1)
feat["any_secondary_plus"] = agg["any_secondary_plus"].astype(int)
feat["no_adult_women"] = (agg["n_adult_women"] == 0).astype(int)
print(f"Persons without age: {int(age.isna().sum())} of {len(p):,}")

# ---- access to services (long -> wide, metres -> km) -----------------------
s = read("CS_S5F_access_to_services", ["hhid", "s5fq0", "s5fq4"])
s["hhid"] = hid(s["hhid"])
s["svc"] = num(s["s5fq0"]).round().astype("Int64").map(SERVICES)
s = s[s["svc"].notna()]
wide = s.pivot_table(index="hhid", columns="svc", values="s5fq4", aggfunc="mean") / 1000.0
wide.columns = [f"dist_km_{c}" for c in wide.columns]
wide = wide.reindex(hh["hhid"])
wide.index = hh.index
feat = feat.join(wide)

# ---- attach (replace earlier versions of these columns) --------------------
new_cols = list(feat.columns)
hh = hh.drop(columns=[c for c in new_cols if c in hh.columns])
hh = pd.concat([hh, feat], axis=1)

cat = CAT_FROM_01 + ["head_marital", "head_edu_cat"]
numf = NUM_FROM_01 + [c for c in new_cols if c not in ("head_marital", "head_edu_cat")]
cat = [c for c in cat if c in hh.columns]
numf = [c for c in numf if c in hh.columns]
assert not (set(cat) | set(numf)) & FORBIDDEN_COLUMNS, "forbidden column among features"
assert not set(cat) & set(numf), "column listed as both categorical and numeric"
hh.to_parquet(DATA, index=False)
FEATURE_JSON.write_text(json.dumps({"categorical": cat, "numeric": numf}, indent=2))
print(f"Saved {DATA}  rows={len(hh):,}  columns={hh.shape[1]}")
print(f"Features: {len(cat)} categorical + {len(numf)} numeric  -> {FEATURE_JSON.name}")

# ---- sanity checks ----------------------------------------------------------
miss = hh[cat + numf].isna().mean().sort_values(ascending=False)
print("\nFeatures with missing values (share):")
print(miss[miss > 0].round(3).to_string() if (miss > 0).any() else "none")

w = hh["weight"]
def wmean(col, mask):
    m = mask & hh[col].notna()
    return float((w[m] * hh.loc[m, col]).sum() / w[m].sum())
print("\nSanity: poor vs non-poor households (weighted means; poor should be larger, less educated)")
print(f"{'':28s}{'poor':>9s}{'non-poor':>10s}")
for col in ["hh_size", "head_female", "head_age", "head_primary_plus", "head_never_school",
            "dependency_ratio", "any_secondary_plus", "dist_km_health_centre", "dist_km_secondary_school"]:
    if col in hh.columns:
        print(f"{col:28s}{wmean(col, hh['poor'] == 1):9.2f}{wmean(col, hh['poor'] == 0):10.2f}")
