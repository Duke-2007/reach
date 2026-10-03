#!/usr/bin/env python3
"""
Check that all t("...") keys in the code exist in both en.json and rw.json.
"""

import json
import re
import sys
from pathlib import Path

# Get the app directory
app_dir = Path(__file__).parent.parent

# Load i18n files
en_file = app_dir / "i18n" / "en.json"
rw_file = app_dir / "i18n" / "rw.json"

with open(en_file, "r", encoding="utf-8") as f:
    en_data = json.load(f)

with open(rw_file, "r", encoding="utf-8") as f:
    rw_data = json.load(f)

def get_all_keys(obj, prefix=""):
    """Recursively get all keys from a nested object."""
    keys = set()
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f"{prefix}.{key}" if prefix else key
            keys.add(full_key)
            keys.update(get_all_keys(value, full_key))
    return keys

en_keys = get_all_keys(en_data)
rw_keys = get_all_keys(rw_data)

# Find all t("...") calls in the code
code_dirs = [
    app_dir / "app",
    app_dir / "components",
    app_dir / "hooks",
    app_dir / "lib",
]

t_keys = set()
t_pattern = re.compile(r't\(["\']([a-zA-Z_][a-zA-Z0-9_.]*)["\']')

for code_dir in code_dirs:
    if not code_dir.exists():
        continue
    for file_path in code_dir.rglob("*.tsx"):
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            matches = t_pattern.findall(content)
            for match in matches:
                t_keys.add(match)

# Check for missing keys
missing_in_en = t_keys - en_keys
missing_in_rw = t_keys - rw_keys

if missing_in_en:
    print("ERROR: Keys missing from en.json:")
    for key in sorted(missing_in_en):
        print(f"  - {key}")
    print()

if missing_in_rw:
    print("ERROR: Keys missing from rw.json:")
    for key in sorted(missing_in_rw):
        print(f"  - {key}")
    print()

if missing_in_en or missing_in_rw:
    sys.exit(1)
else:
    print("OK: All t(...) keys found in both en.json and rw.json")
    sys.exit(0)
