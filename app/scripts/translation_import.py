"""
translation_import.py - write reviewed Kinyarwanda back into app/i18n/rw.json.

Only rows with reviewed = yes are written (the TODO_TRANSLATE marker disappears for them).
Safety checks: {placeholders} such as {trait} must be identical in English and Kinyarwanda,
and no reviewed row may be empty.  Finally it reports how many strings still need review.

Run from the repo root:  python app/scripts/translation_import.py
"""
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
EN = ROOT / "app" / "i18n" / "en.json"
RW = ROOT / "app" / "i18n" / "rw.json"
CSV = ROOT / "docs" / "translation-review.csv"
MARK = "TODO_TRANSLATE"
tokens = lambda s: sorted(re.findall(r"\{[^}]+\}", str(s)))


def get(o, path):
    for p in path.split("."):
        o = o[p]
    return o


def put(o, path, value):
    parts = path.split(".")
    for p in parts[:-1]:
        o = o[p]
    o[parts[-1]] = value


en = json.loads(EN.read_text(encoding="utf-8"))
rw = json.loads(RW.read_text(encoding="utf-8"))
applied, problems = 0, []
with open(CSV, newline="", encoding="utf-8-sig") as f:
    for row in csv.DictReader(f):
        if row["reviewed"].strip().lower() not in ("yes", "y", "1"):
            continue
        text = row["kinyarwanda"].strip()
        if not text:
            problems.append(f"{row['key']}: marked reviewed but empty")
        elif tokens(text) != tokens(row["english"]):
            problems.append(f"{row['key']}: placeholders differ: English {tokens(row['english'])} vs Kinyarwanda {tokens(text)}")
        else:
            put(rw, row["key"], text)
            applied += 1
if problems:
    print("NOT applied, please fix these rows first:")
    print("\n".join("  " + p for p in problems))
    raise SystemExit(1)
RW.write_text(json.dumps(rw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def count(o):
    return sum(count(v) if isinstance(v, dict) else MARK in str(v) for v in o.values())


print(f"{applied} strings written to rw.json. Still marked {MARK}: {count(rw)}")
