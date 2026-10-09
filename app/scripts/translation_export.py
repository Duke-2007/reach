"""
translation_export.py - write every Kinyarwanda string to a CSV you can review in Excel.

Columns: key, english, kinyarwanda, reviewed
  * kinyarwanda starts as the current draft (the TODO_TRANSLATE marker removed): correct it.
  * put "yes" in `reviewed` for every row you have checked (or fixed).
Then run:  python app/scripts/translation_import.py

Run from the repo root:  python app/scripts/translation_export.py
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
EN = ROOT / "app" / "i18n" / "en.json"
RW = ROOT / "app" / "i18n" / "rw.json"
OUT = ROOT / "docs" / "translation-review.csv"
MARK = "TODO_TRANSLATE"


def flatten(o, prefix=""):
    for k, v in o.items():
        path = f"{prefix}{k}"
        if isinstance(v, dict):
            yield from flatten(v, path + ".")
        else:
            yield path, v


en = dict(flatten(json.loads(EN.read_text(encoding="utf-8"))))
rw = dict(flatten(json.loads(RW.read_text(encoding="utf-8"))))
rows, todo = [], 0
for key, english in en.items():
    current = str(rw.get(key, ""))
    pending = MARK in current
    todo += pending
    rows.append({"key": key, "english": english,
                 "kinyarwanda": current.replace(MARK, "").strip(), "reviewed": "" if pending else "yes"})
OUT.parent.mkdir(exist_ok=True)
with open(OUT, "w", newline="", encoding="utf-8-sig") as f:      # utf-8-sig: Excel shows accents correctly
    w = csv.DictWriter(f, fieldnames=["key", "english", "kinyarwanda", "reviewed"])
    w.writeheader()
    w.writerows(rows)
print(f"{len(rows)} strings written to {OUT}; {todo} still marked {MARK}.")
print("Review the 'kinyarwanda' column, put yes in 'reviewed', save as CSV, then run translation_import.py")
