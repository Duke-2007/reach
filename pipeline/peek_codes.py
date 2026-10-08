"""
peek_codes.py - show how a few columns are coded (labels + COUNTS per code).

Prints only metadata and aggregated counts (how many rows have each value).
No row of data is printed, so the output is safe to paste into a chat.

Run from the repo root:   python pipeline/peek_codes.py
"""
from pathlib import Path

import pandas as pd
import pyreadstat

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
SPEC = {
    "CS_S0_S1_S2_S3_S4_S6A_S6B_S6C_Person": ["s1q1", "s1q2", "s1q4", "s4aq1", "s4aq2", "s4aq2a"],
    "CS_S5F_access_to_services": ["s5fq0", "s5fq0d", "s5fq3a", "s5fq4"],
}


def read(path, **kw):
    last = None
    for enc in (None, "latin1", "cp1252"):
        try:
            return pyreadstat.read_dta(str(path), encoding=enc, **kw)
        except UnicodeDecodeError as exc:
            last = exc
    raise last


for stem, cols in SPEC.items():
    hits = list(RAW.rglob(stem + ".dta"))
    if len(hits) != 1:
        print(f"\n### {stem}: file not found")
        continue
    _, meta = read(hits[0], metadataonly=True)
    labels = meta.variable_value_labels
    df, _ = read(hits[0], usecols=cols)
    print(f"\n######## {stem}  ({len(df):,} rows)")
    for c in cols:
        print(f"\n--- {c}")
        if labels.get(c):
            print("labels:", "; ".join(f"{k}={v}" for k, v in labels[c].items()))
        else:
            print("labels: none stored in the file")
        s = df[c]
        if s.nunique(dropna=True) <= 30 or s.dtype == object:
            vc = s.value_counts(dropna=False).head(30)
            print("counts:", "; ".join(f"{k}: {v:,}" for k, v in vc.items()))
        else:
            print(s.describe().round(2).to_string())
