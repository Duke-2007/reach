"""
02b_financial_inclusion.py - financial inclusion and the "triple gap", by district.

For Rwanda and every district: weighted household rates (95% design-based CIs) of
has_savings, has_credit, has_formal_financial_service and financially_excluded;
four segments (poor/non-poor x formally served/excluded); and the TRIPLE GAP:
poor AND financially excluded AND receiving no support.

Definitions (see 01_load_clean.py): a household is financially excluded if no
member has a formal account (bank, microfinance, SACCO, mobile money, Mokash) and
it has no formal or VUP loan. Informal-only households (tontine, relatives) count
as excluded. This is generous (any member counts), so exclusion rates are low and
triple-gap cells are small: small_cell flags fewer than 10 triple-gap households
or fewer than 30 poor households.

Run from the repo root:   python pipeline/02b_financial_inclusion.py
"""
from pathlib import Path
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from survey_stats import Design, ci_prop, ci_total  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "processed" / "households.parquet"
OUT = ROOT / "outputs" / "tables" / "financial_inclusion.csv"
FLAGS = ["has_savings", "has_credit", "has_formal_financial_service", "financially_excluded"]


def prop_cols(design, y, domain, name):
    p, se = design.proportion(y, domain)
    lo, hi = ci_prop(p, se)
    return {name: p, f"{name}_lo": lo, f"{name}_hi": hi}


def area_row(design, df, area, level):
    m = np.ones(len(df), bool) if level == "national" else (df["district"] == area).to_numpy()
    poor = df["poor"].to_numpy().astype(bool)
    served = df["has_formal_financial_service"].to_numpy().astype(bool)
    nosup = ~df["got_any_support"].to_numpy().astype(bool)
    row = {"area": area, "level": level, "n_households": int(m.sum()), "n_poor": int((m & poor).sum())}
    for f in FLAGS:
        row.update(prop_cols(design, df[f].to_numpy().astype(bool), m, f))
        row.update(prop_cols(design, df[f].to_numpy().astype(bool), m & poor, f + "_among_poor"))
    segments = {"poor_served": poor & served, "poor_excluded": poor & ~served,
                "nonpoor_served": ~poor & served, "nonpoor_excluded": ~poor & ~served}
    for k, seg in segments.items():
        row.update(prop_cols(design, seg, m, f"share_{k}"))
        row[f"wt_{k}"] = design.total((m & seg).astype(float))[0]
    triple = poor & ~served & nosup
    row.update(prop_cols(design, triple, m, "triple_gap"))
    row.update(prop_cols(design, triple, m & poor, "triple_gap_among_poor"))
    t, se = design.total((m & triple).astype(float))
    row["wt_triple_gap"], (row["wt_triple_gap_lo"], row["wt_triple_gap_hi"]) = t, ci_total(t, se)
    row["n_triple_gap"] = int((m & triple).sum())
    row["small_cell"] = bool(row["n_triple_gap"] < 10 or row["n_poor"] < 30)
    return row


def main():
    df = pd.read_parquet(DATA)
    design = Design(df)
    rows = [area_row(design, df, "Rwanda", "national")]
    rows += [area_row(design, df, d, "district") for d in sorted(df["district"].unique())]
    res = pd.DataFrame(rows)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    res.to_csv(OUT, index=False)

    seg = [c for c in res.columns if c.startswith("share_") and not c.endswith(("_lo", "_hi"))]
    assert np.allclose(res[seg].sum(axis=1), 1.0), "segments do not sum to 1"
    assert np.allclose(res["has_formal_financial_service"] + res["financially_excluded"], 1.0)

    n = res.iloc[0]
    print(f"Rwanda: formal service {n.has_formal_financial_service:.1%}, excluded {n.financially_excluded:.1%}, "
          f"has credit {n.has_credit:.1%}, has savings {n.has_savings:.1%}")
    print(f"Among POOR households: excluded {n.financially_excluded_among_poor:.1%} "
          f"({n.financially_excluded_among_poor_lo:.1%}-{n.financially_excluded_among_poor_hi:.1%})")
    print(f"TRIPLE GAP (poor + excluded + no support): {n.triple_gap:.2%} of all households "
          f"({n.triple_gap_lo:.2%}-{n.triple_gap_hi:.2%}); about {n.wt_triple_gap:,.0f} households")
    top = res[res.level == "district"].sort_values("triple_gap", ascending=False).head(5)
    print("\nTop 5 districts by triple-gap share of households (95% CI):")
    for _, r in top.iterrows():
        print(f"  {r.area:12s} {r.triple_gap:6.2%} ({r.triple_gap_lo:.2%}-{r.triple_gap_hi:.2%})  "
              f"n={r.n_triple_gap}{'  [small sample]' if r.small_cell else ''}")
    print(f"\nDistricts flagged small_cell: {int(res[res.level == 'district'].small_cell.sum())} of 30")
    print(f"Saved {OUT}")


if __name__ == "__main__":
    main()
