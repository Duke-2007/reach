# Limitations

1. **District level only.** The survey has 15,054 households, about 480 per district, which is too few for sector-level claims.
2. **Programme counts are small.** Each programme reaches only 2% to 4% of households in the sample, so programme-level district estimates are noisy. The headline is "any support"; small cells are flagged `small_cell`.
3. **Extreme poverty is noisy by district.** Extreme poverty is about 4% of households, so most districts have too few extremely poor households. Compare districts on "poor", not on "extremely poor".
4. **Not a household list.** The survey is anonymous. Reach is a policy design tool and cannot identify real households.
5. **Receiving support can change welfare.** Support can lift a household's consumption above the poverty line, so the "poor but unsupported" share can understate need among beneficiaries, and leakage can be overstated.
6. **Programmes use other criteria.** VUP programmes select households by their own rules (for example labour capacity), not by the survey's poverty line. Rules B and C are judged on the survey's poverty label, which is the label the model is trained to predict, so the comparison is favourable to them by construction. It shows what a poverty-ranked rule could add, not that the programmes are badly run.
7. **Modest model accuracy.** AUC 0.819 means many households are misranked. Household size is the strongest signal; without any size or composition variable the AUC is 0.773.
8. **Rule C is simple by design.** Rare categories can carry noisy points, and the scorecard gives up some accuracy for transparency.
9. **Financial inclusion is measured generously.** A household counts as included if any member has a formal account (mobile money included), so exclusion rates are low and the triple-gap cells are small. A stricter definition would raise exclusion.
10. **Strata.** The poverty file has no strata column; strata are taken from the household file. Intervals use linearisation and ignore the finite-population correction.
11. **Assumed units.** Distances to services are assumed to be in metres.
12. **Data vintage.** EICV7 refers to 2023-24; conditions and programme coverage may have changed.
13. **Cost** is expressed in units of one household supported; it is not a monetary estimate.
14. **Equity.** Ranking by poverty risk does not reach every group equally. At the programmes' coverage, observed targeting already reaches female-headed poor households (20.7%) better than male-headed ones (12.6%), while the scorecard reaches 21.7% of them, about the same as today, so it would give them almost no extra reach. In the Northern Province the gain of the model over observed targeting is not clear (+37 per 1,000, 95% CI -8 to +99). The scorecard should be tested alongside existing criteria, not used in their place.
15. **Group results are national picks.** The equity table applies one national ranking and looks at who is reached; it does not re-optimise the rule for each group or province.
16. **No user validation yet.** The tool has not been tested with district planners or programme staff, and no operational evaluation exists.

