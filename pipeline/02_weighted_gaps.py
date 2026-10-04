"""
02_weighted_gaps.py - four-box targeting tables by district, with design-based CIs.

For each area (Rwanda and every district), each support outcome and each poverty
definition (poor, extreme poor) the household table is split into four boxes:

                    supported            not supported
    poor            covered poor         MISSED (exclusion)
    non-poor        LEAKAGE              non-poor, no support

  coverage_poor   = share of poor households that are supported
  exclusion_error = 1 - coverage_poor  (share of poor households MISSED)
  leakage         = share of SUPPORTED households that are not poor

All counts are weighted (household weight) and all intervals respect the survey
design (strata + clusters), see survey_stats.py.  small_cell flags rows with
fewer than 30 poor households or fewer than 10 supported households: program
level estimates in a single district are noisy, so lead with got_any_support.

Run from the repo root:   python pipeline/02_weighted_gaps.py
"""
from pathlib import Path
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from survey_stats import Design, ci_prop, ci_total  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "processed" / "households.parquet"
OUT = ROOT / "outputs" / "tables"

OUTCOMES = ["got_any_support", "got_direct_support", "got_classic_public_work",
            "got_expanded_public_work", "got_nsds"]
POVERTY_DEFS = {"poor": "poor", "extreme_poor": "extreme_poor"}
MIN_POOR, MIN_SUPPORTED = 30, 10


def area_rows(design, df, area, level):
    """All outcome x poverty-definition rows for one area (mask over the full sample)."""
    in_area = np.ones(len(df), bool) if level == "national" else (df["district"] == area).to_numpy()
    rows = []
    for outcome in OUTCOMES:
        sup = df[outcome].to_numpy().astype(bool)
        for pname, pcol in POVERTY_DEFS.items():
            poor = df[pcol].to_numpy().astype(bool)
            a = in_area.astype(float)
            boxes = {
                "poor_supported": in_area & poor & sup,
                "poor_missed": in_area & poor & ~sup,
                "nonpoor_supported": in_area & ~poor & sup,
                "nonpoor_unsupported": in_area & ~poor & ~sup,
            }
            wt = {k: design.total(m.astype(float)) for k, m in boxes.items()}
            wt_all = sum(v[0] for v in wt.values())

            pov_p, pov_se = design.proportion(poor, in_area)
            cov, cov_se = design.proportion(sup, in_area & poor)
            exc, exc_se = design.proportion(~sup, in_area & poor)
            leak, leak_se = design.proportion(~poor, in_area & sup)
            n_poor = int((in_area & poor).sum())
            n_sup = int((in_area & sup).sum())
            row = {
                "area": area, "level": level, "outcome": outcome, "poverty_def": pname,
                "n_households": int(in_area.sum()), "n_poor": n_poor, "n_supported": n_sup,
                "n_missed": int(boxes["poor_missed"].sum()),
                "wt_households": wt_all,
                "poverty_rate": pov_p, "poverty_rate_lo": ci_prop(pov_p, pov_se)[0],
                "poverty_rate_hi": ci_prop(pov_p, pov_se)[1],
                "coverage_poor": cov, "coverage_poor_lo": ci_prop(cov, cov_se)[0],
                "coverage_poor_hi": ci_prop(cov, cov_se)[1],
                "exclusion_error": exc, "exclusion_error_lo": ci_prop(exc, exc_se)[0],
                "exclusion_error_hi": ci_prop(exc, exc_se)[1],
                "leakage": leak, "leakage_lo": ci_prop(leak, leak_se)[0],
                "leakage_hi": ci_prop(leak, leak_se)[1],
                "small_cell": bool(n_poor < MIN_POOR or n_sup < MIN_SUPPORTED),
            }
            for k, (t, se) in wt.items():
                row[f"wt_{k}"] = t
                row[f"share_{k}"] = t / wt_all if wt_all else np.nan
            lo, hi = ci_total(*wt["poor_missed"])
            row["wt_poor_missed_lo"], row["wt_poor_missed_hi"] = lo, hi
            rows.append(row)
    return rows


def main():
    df = pd.read_parquet(DATA)
    design = Design(df)
    districts = sorted(df["district"].unique())
    rows = area_rows(design, df, "Rwanda", "national")
    for d in districts:
        rows += area_rows(design, df, d, "district")
    res = pd.DataFrame(rows)
    OUT.mkdir(parents=True, exist_ok=True)
    res.to_csv(OUT / "gaps_by_area.csv", index=False)

    # ---- sanity checks ------------------------------------------------------
    box_cols = [f"share_{k}" for k in ["poor_supported", "poor_missed",
                                      "nonpoor_supported", "nonpoor_unsupported"]]
    assert np.allclose(res[box_cols].sum(axis=1), 1.0), "four boxes do not sum to 1"
    nat = res[(res.level == "national") & (res.outcome == "got_any_support") &
              (res.poverty_def == "poor")].iloc[0]
    n_strata, n_cl = design.n_strata, design.n_cl
    print(f"Design: {n_strata} strata, {n_cl} clusters, {len(df):,} households")
    print(f"Weighted households represented (sum of weights): {nat.wt_households:,.0f}")
    print(f"\nRwanda, ANY support, poor households (95% CI):")
    print(f"  household poverty rate {nat.poverty_rate:.1%} ({nat.poverty_rate_lo:.1%}-{nat.poverty_rate_hi:.1%})")
    print(f"  coverage of the poor   {nat.coverage_poor:.1%} ({nat.coverage_poor_lo:.1%}-{nat.coverage_poor_hi:.1%})")
    print(f"  exclusion error        {nat.exclusion_error:.1%} ({nat.exclusion_error_lo:.1%}-{nat.exclusion_error_hi:.1%})")
    print(f"  leakage                {nat.leakage:.1%} ({nat.leakage_lo:.1%}-{nat.leakage_hi:.1%})")

    d = res[(res.level == "district") & (res.outcome == "got_any_support") &
            (res.poverty_def == "poor")].sort_values("wt_poor_missed", ascending=False).head(5)
    print("\nTop 5 districts by NUMBER of poor households missed (weighted, 95% CI):")
    for _, r in d.iterrows():
        print(f"  {r.area:12s} {r.wt_poor_missed:9,.0f} ({r.wt_poor_missed_lo:,.0f}-{r.wt_poor_missed_hi:,.0f})"
              f"   exclusion error {r.exclusion_error:.0%} ({r.exclusion_error_lo:.0%}-{r.exclusion_error_hi:.0%})"
              f"{'  [small sample]' if r.small_cell else ''}")
    flagged = res[(res.level == "district") & (res.outcome == "got_any_support") & res.small_cell]
    print(f"\nDistricts flagged small_cell for any support: {len(flagged)}")
    print(f"Saved {OUT / 'gaps_by_area.csv'}  ({len(res)} rows)")


if __name__ == "__main__":
    main()
