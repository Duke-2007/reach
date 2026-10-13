#!/usr/bin/env python3
"""Check literal and registered dynamic translation keys against both dictionaries."""
import json
import re
import sys
from pathlib import Path

app_dir = Path(__file__).parent.parent
with (app_dir / "i18n" / "en.json").open(encoding="utf-8") as f:
    en_data = json.load(f)
with (app_dir / "i18n" / "rw.json").open(encoding="utf-8") as f:
    rw_data = json.load(f)

def get_all_keys(obj, prefix=""):
    keys = set()
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f"{prefix}.{key}" if prefix else key
            keys.add(full_key)
            keys.update(get_all_keys(value, full_key))
    return keys

en_keys = get_all_keys(en_data)
rw_keys = get_all_keys(rw_data)
t_keys = set()
unknown_dynamic = set()
code_dirs = [app_dir / "app", app_dir / "components", app_dir / "hooks", app_dir / "lib"]
literal_t = re.compile(r'\bt\(["\']([a-zA-Z_][a-zA-Z0-9_.]*)["\']')
template_t = re.compile(r'\bt\(\s*`([^`]*)`')

# Variable domains correspond to the finite unions used by these UI controls.
# The checker expands each dynamic call family, so a missing sibling key fails CI.
dynamic_families = {
    "nav.*": [f"nav.{x}" for x in ("home", "missed", "model", "simulate", "priority", "brief")],
    "map.layer_*": [f"map.layer_{x}" for x in ("poverty", "exclusion", "leakage", "financial", "triple")],
    "map.takeaway_*": [f"map.takeaway_{x}" for x in ("poverty", "exclusion", "leakage", "financial", "triple")],
    "map.*": [f"map.{kind}_{x}" for kind in ("layer", "takeaway") for x in ("poverty", "exclusion", "leakage", "financial", "triple")],
    "simulate.rule_*_title": [f"simulate.rule_{x}_title" for x in ("a", "b", "c")],
    "simulate.rule_*_desc": [f"simulate.rule_{x}_desc" for x in ("a", "b", "c")],
    "simulate.rule_*_short": [f"simulate.rule_{x}_short" for x in ("A", "B", "C")],
    "simulate.callout_gain_no_rule*": [f"simulate.callout_gain_no_rule{x}" for x in ("B", "C")],
    "brief.metric_*": [f"brief.metric_{x}" for x in ("poverty_rate", "exclusion_error", "leakage", "financial_access", "triple_gap")],
    "brief.meaning_*": [f"brief.meaning_{x}" for x in ("above", "below", "similar")],
    "brief.*": [f"brief.{x}" for x in ("action_targeting", "action_access", "action_screening_both", "action_screening_model", "action_screening_scorecard", "action_small_cell", "action_monitor", "action_outreach", "action_evaluate", "action_review", "action_review2", "action_review3")],
    "profiles.trait_*": [f"profiles.trait_{x}" for x in ("household_size", "electricity_pct", "improved_water_pct", "improved_toilet_pct", "head_primary_plus_pct", "distance_health_km", "owns_livestock_pct", "head_female_pct")],
}
# Also validate keys passed through the missed-page trait-to-insight lookup table.
lookup_keys = {
    "missed.insight_household_size_higher_missed", "missed.insight_household_size_higher_covered",
    "missed.insight_electricity_higher_missed", "missed.insight_electricity_higher_covered",
    "missed.insight_water_higher_missed", "missed.insight_water_higher_covered",
    "missed.insight_toilet_higher_missed", "missed.insight_toilet_higher_covered",
    "missed.insight_education_higher_missed", "missed.insight_education_higher_covered",
    "missed.insight_distance_higher_missed", "missed.insight_distance_higher_covered",
    "missed.insight_phone_higher_missed", "missed.insight_phone_higher_covered",
    "missed.insight_agriculture_higher_missed", "missed.insight_agriculture_higher_covered",
}

for code_dir in code_dirs:
    if not code_dir.exists():
        continue
    for file_path in code_dir.rglob("*.tsx"):
        content = file_path.read_text(encoding="utf-8")
        t_keys.update(literal_t.findall(content))
        for template in template_t.findall(content):
            normalized = re.sub(r"\$\{[^}]+\}", "*", template)
            family = dynamic_families.get(normalized)
            if family is None:
                unknown_dynamic.add(f"{file_path.relative_to(app_dir)}: {template}")
            else:
                t_keys.update(family)

# Catch references embedded in lookup objects, such as t(keys.higher_missed).
for code_dir in code_dirs:
    if code_dir.exists():
        for file_path in code_dir.rglob("*.tsx"):
            content = file_path.read_text(encoding="utf-8")
            t_keys.update(re.findall(r'["\'](missed\.insight_[a-zA-Z0-9_.]+)["\']', content))
t_keys.update(lookup_keys)

missing_en = sorted(t_keys - en_keys)
missing_rw = sorted(t_keys - rw_keys)
if unknown_dynamic:
    print("ERROR: Unregistered dynamic translation template(s):")
    print("\n".join(f"  - {item}" for item in sorted(unknown_dynamic)))
if missing_en:
    print("ERROR: Keys missing from en.json:")
    print("\n".join(f"  - {key}" for key in missing_en))
if missing_rw:
    print("ERROR: Keys missing from rw.json:")
    print("\n".join(f"  - {key}" for key in missing_rw))
if unknown_dynamic or missing_en or missing_rw:
    sys.exit(1)
print("OK: All literal and registered dynamic translation keys found in both dictionaries")
