"""
01_load_clean.py - build ONE clean household-level table from the raw EICV7 files.

Output: data/processed/households.parquet  (one row per household, gitignored)

Design choices (see docs/data-notes.md for the evidence):
  * Base table = poverty file (15,054 households). It has the survey weights, the
    cluster, district, and the poverty flags, which are coded 0/100 and are
    recoded here to 0/1.
  * strata_id is NOT in the poverty file, so it is taken from the household file
    (complete there) and checked to be constant within a household.
  * Support files are person-level and mostly blank: a household "received" a
    program if ANY row of that household says Yes (code 1).
  * Consumption, expenditure and poverty columns are never carried into the
    feature set (FORBIDDEN_COLUMNS), because poverty is defined from them.
Run from the repo root:   python pipeline/01_load_clean.py
"""
from pathlib import Path

import numpy as np
import pandas as pd
import pyreadstat

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed" / "households.parquet"

# ---- column groups ---------------------------------------------------------
# Household-level, non-consumption predictors from CS_S01_S5_S7_Household.
# Codes are kept as numbers; they are categorical codes and will be one-hot
# encoded in the model step.
CATEGORICAL_FEATURES = [
    "s5aq1",   # type of habitat
    "s5aq2",   # type of dwelling
    "s5aq7",   # owner of the dwelling
    "s5cq1",   # main water source
    "s5cq3",   # main drinking water source
    "s5cq14",  # connected to the electricity grid
    "s5cq16",  # main lighting energy
    "s5cq20a", # internet connection
    "s5cq21",  # cook stove type
    "s5cq22a", # main cooking fuel
    "s5cq25",  # toilet type
    "s5cq26",  # toilet shared
    "s5dq1",   # wall material
    "s5dq2",   # roof material
    "s5dq3",   # floor material
    "s7aq4",   # owns livestock
]
NUMERIC_FEATURES = [
    "s5aq3",   # rooms for sleeping
    "s5cq2a",  # distance to water source (m)
    "s5cq2b",  # time to fetch water (min)
    "s7aq4a", "s7aq4b", "s7aq4c", "s7aq4d", "s7aq4e", "s7aq4f",  # livestock counts
]
# Money amounts / support receipt / consumption: NEVER features.
FORBIDDEN_COLUMNS = [
    "exp1", "exp2", "exp3", "exp4", "exp5", "exp6", "exp7", "exp8", "exp9",
    "exp10", "exp11", "Food_at_school", "hh_index", "sol_jan", "quintile",
    "food", "cons1", "cons1ae", "pov_jan", "poverty", "epov_jan",
    "Poverty_line", "Extreme_line",
    "s5bq1", "s5bq2a", "s5bq3a", "s5bq5a", "s5bq8", "s5cq9b", "s5cq11",
    "s5cq12", "s5cq20",            # rent, dwelling value, water/electricity money
    "s7a2q1", "s7a2q4",            # animals received from government/NGO (= support)
]
# District names as spelled in the map file (geoBoundaries ADM2).
MAP_NAMES = {
    "Bugesera", "Burera", "Gakenke", "Gasabo", "Gatsibo", "Gicumbi", "Gisagara",
    "Huye", "Kamonyi", "Karongi", "Kayonza", "Kicukiro", "Kirehe", "Muhanga",
    "Musanze", "Ngoma", "Ngororero", "Nyabihu", "Nyagatare", "Nyamagabe",
    "Nyamasheke", "Nyanza", "Nyarugenge", "Nyaruguru", "Rubavu", "Ruhango",
    "Rulindo", "Rusizi", "Rutsiro", "Rwamagana",
}


# ---- helpers ---------------------------------------------------------------
def read(stem, usecols=None):
    """Read a .dta file (some NISR files use a legacy encoding)."""
    hits = list(RAW.rglob(stem + ".dta"))
    if len(hits) != 1:
        raise SystemExit(f"Expected exactly one file named {stem}.dta, found {len(hits)}")
    last = None
    for enc in (None, "latin1", "cp1252"):
        try:
            return pyreadstat.read_dta(str(hits[0]), usecols=usecols, encoding=enc)
        except UnicodeDecodeError as exc:
            last = exc
    raise last


def num(s):
    """Convert to numbers; blanks and text become NaN (columns are often 'object')."""
    return pd.to_numeric(s, errors="coerce")


def hid(s):
    """Household id is stored as a float; make it an exact integer for joins."""
    return np.rint(num(s)).astype("int64")


def any_flag(stem, col, rule, hh_index):
    """Household flag = True if ANY row of that household satisfies `rule(series)`."""
    d, _ = read(stem, usecols=["hhid", col])
    d["hhid"] = hid(d["hhid"])
    d["flag"] = rule(num(d[col])).fillna(False).astype(bool)
    return d.groupby("hhid")["flag"].max().reindex(hh_index).fillna(False).astype(bool)


def wshare(mask, w):
    return float((w * mask).sum() / w.sum())


# ---- 1. base table from the poverty file ----------------------------------
pov, pmeta = read("CS_EICV7_poverty_file")
base = pd.DataFrame({
    "hhid": hid(pov["hhid"]),
    "clust": hid(pov["clust"]),
    "province_code": hid(pov["province"]),
    "district_code": hid(pov["district"]),
    "urban": (num(pov["ur"]) == 1).astype(int),
    "hh_size": num(pov["member"]),
    "hh_size_ae": num(pov["ae"]),
    "weight": num(pov["weight"]),        # household weight
    "pop_wt": num(pov["pop_wt"]),        # population weight
    # Poverty flags are coded 0 / 100 in the file: recode to 0 / 1.
    "poor": (num(pov["pov_jan"]) == 100).astype(int),
    "extreme_poor": (num(pov["epov_jan"]) == 100).astype(int),
})
dist_labels = {int(round(k)): v for k, v in pmeta.variable_value_labels["district"].items()}
prov_labels = {int(round(k)): v for k, v in pmeta.variable_value_labels["province"].items()}
base["district"] = base["district_code"].map(dist_labels)
base["province"] = base["province_code"].map(prov_labels)

assert base["hhid"].is_unique, "duplicate household ids in the poverty file"
assert (base["weight"] > 0).all(), "non-positive household weights"
assert base["district"].notna().all(), "household without a district name"
print(f"Households in poverty file: {len(base):,}")
unmatched = sorted(set(base["district"]) - MAP_NAMES)
print(f"Districts: {base['district'].nunique()}; names not in the map file: {unmatched or 'none'}")

# ---- 2. strata + household features from the household file ---------------
feat_cols = CATEGORICAL_FEATURES + NUMERIC_FEATURES
hh_all, _ = read("CS_S01_S5_S7_Household")
missing_cols = [c for c in feat_cols if c not in hh_all.columns]
if missing_cols:
    print("WARNING: feature columns not found (check docs/data-notes.md):", missing_cols)
feat_cols = [c for c in feat_cols if c in hh_all.columns]
assert not set(feat_cols) & set(FORBIDDEN_COLUMNS), "forbidden column used as a feature"

hh_all["hhid"] = hid(hh_all["hhid"])
hh_all["clust"] = hid(hh_all["clust"])
hh_all["strata_id"] = hid(hh_all["strata_id"])
assert (hh_all.groupby("hhid")["strata_id"].nunique() == 1).all(), "strata_id varies within a household"
hh_one = hh_all.drop_duplicates("hhid").set_index("hhid")
assert base["hhid"].isin(hh_one.index).all(), "households missing from the household file"
base = base.join(hh_one[["strata_id"] + feat_cols], on="hhid")
assert (hh_one.loc[base["hhid"], "clust"].to_numpy() == base["clust"].to_numpy()).all(), \
    "cluster differs between the poverty and household files"
for c in feat_cols:
    base[c] = num(base[c])
base["rooms_per_person"] = base["s5aq3"] / base["hh_size"]
print(f"Strata: {base['strata_id'].nunique()}   Clusters: {base['clust'].nunique()}")

# ---- 3. support programs (household = any member received) ----------------
idx = pd.Index(base["hhid"])
is1 = lambda s: s == 1                     # 1 = Yes, 2 = No
base["got_direct_support"] = any_flag("CS_S9D1_Direct_Support", "s9d1q2", is1, idx).to_numpy()
base["got_classic_public_work"] = any_flag("CS_S9D2_Classic_Public_Work", "s9d2q1", is1, idx).to_numpy()
base["got_expanded_public_work"] = any_flag("CS_S9D3_Expanded_Public_Work", "s9d3q1", is1, idx).to_numpy()
base["got_nsds"] = any_flag("CS_S9D4_NSDS", "s9d4q1", is1, idx).to_numpy()
base["vup_any_component"] = any_flag("CS_S9D1_Direct_Support", "s9d1q1", is1, idx).to_numpy()
# Headline definition: any of the four transfer programs.
base["got_any_support"] = (base["got_direct_support"] | base["got_classic_public_work"]
                           | base["got_expanded_public_work"] | base["got_nsds"])
for c in ["got_direct_support", "got_classic_public_work", "got_expanded_public_work",
          "got_nsds", "got_any_support", "vup_any_component"]:
    assert base[c].sum() > 0, f"{c} has no beneficiaries: check how the column is coded"

# ---- 4. financial inclusion -----------------------------------------------
# Formal institutions in s10cq5: 1 commercial bank, 2 microfinance, 3 cooperative
# bank, 4 SACCO, 5 mobile money, 6 Mokash.  7 = other (not counted as formal).
sav, _ = read("CS_S10C_Savings", usecols=["hhid", "s10cq4", "s10cq5", "s10cq8"])
sav["hhid"] = hid(sav["hhid"])
acct = num(sav["s10cq4"]) == 1
sav["account"] = acct
sav["formal_account"] = acct & num(sav["s10cq5"]).isin([1, 2, 3, 4, 5, 6])
sav["tontine"] = num(sav["s10cq8"]) == 1
sg = sav.groupby("hhid")[["account", "formal_account", "tontine"]].max().reindex(idx).fillna(False).astype(bool)

cred, _ = read("CS_S10A1_A2_credits", usecols=["hhid", "s10aq3", "s10aq6"])
cred["hhid"] = hid(cred["hhid"])
cred["owes"] = num(cred["s10aq3"]) == 1
# Formal loan sources: 2 bank, 4 credit cooperative, 7 microfinance, 8 VUP loan,
# 9 SACCO, 10 Mokash.  Relatives, tontines, informal lenders are informal.
cred["formal_loan"] = num(cred["s10aq6"]).isin([2, 4, 7, 8, 9, 10])
cg = cred.groupby("hhid")[["owes", "formal_loan"]].max().reindex(idx).fillna(False).astype(bool)
vup_loan = any_flag("CS_S9D5_Financial_Services", "s9d5q2", is1, idx)   # approved VUP loan

base["has_savings"] = (sg["account"] | sg["tontine"]).to_numpy()
base["has_credit"] = cg["owes"].to_numpy()
# financially_excluded: NO formal account AND NO formal or VUP loan.
# (Informal-only households, e.g. tontine or relatives, count as excluded.)
base["has_formal_financial_service"] = (sg["formal_account"] | cg["formal_loan"] | vup_loan).to_numpy()
base["financially_excluded"] = ~base["has_formal_financial_service"]

# ---- 5. save and sanity-check ----------------------------------------------
OUT.parent.mkdir(parents=True, exist_ok=True)
base.to_parquet(OUT, index=False)
print(f"\nSaved {OUT}  rows={len(base):,}  columns={base.shape[1]}")

w, pw = base["weight"], base["pop_wt"]
print("\n== Poverty check against the published EICV7 figures (27.4% and 5.4%) ==")
print(f"Persons  (pop_wt): poverty {wshare(base['poor'], pw):.1%}   extreme {wshare(base['extreme_poor'], pw):.1%}")
print(f"Households (weight): poverty {wshare(base['poor'], w):.1%}   extreme {wshare(base['extreme_poor'], w):.1%}")
print("\n== Support (weighted share of households; unweighted count) ==")
for c in ["got_direct_support", "got_classic_public_work", "got_expanded_public_work",
          "got_nsds", "got_any_support", "vup_any_component"]:
    print(f"{c:28s} {wshare(base[c], w):6.1%}   n={int(base[c].sum()):,}")
print("\n== Financial inclusion (weighted share of households) ==")
for c in ["has_savings", "has_credit", "has_formal_financial_service", "financially_excluded"]:
    print(f"{c:30s} {wshare(base[c], w):6.1%}")
print("\nShare of POOR households with no support:",
      f"{wshare(~base.loc[base.poor == 1, 'got_any_support'], w[base.poor == 1]):.1%}")
