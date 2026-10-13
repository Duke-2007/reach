# Impact

## Who would use it
District planners and social-protection programme managers who decide which households to screen and support when only a fixed share of households can be reached.

## The decision it supports
How to choose households under a fixed budget, and where to look first. Reach shows where gaps are largest, who is missed, how a simple scorecard or model-based ranking would change who is reached, and how certain each number is.

## What the results support
- **The gap is large and measurable.** 85.3% (84.0%-86.4%) of poor households receive no support from the four VUP transfer programmes covered by the survey, and 65.7% (63.2%-68.2%) of supported households are not poor by the survey's poverty line.
- **Most of the gap is a budget limit, and part is targeting.** The programmes reach 10.1% of households while 23.4% of households are poor, so even perfect targeting at that coverage would miss more than half of poor households. At the same coverage, a poverty-ranked rule reaches 28.0% (model) or 25.3% (scorecard) of poor households, against 14.7% for observed targeting: +133 (118 to 149) and +106 (91 to 122) per 1,000 poor households. These gains are measured against the survey's poverty label, which the rules are built to predict.
- **A transparent rule gets most of the benefit.** The scorecard, six features with integer points that can be added up by hand, captures most of the model's gain.
- **Where to look first.** The district briefs rank districts by the number of poor households missed, for example Nyagatare (about 49,800, exclusion error 96%) and Kamonyi (about 38,500), each with an interval.
- **Financial inclusion is part of the picture.** Poor households are more often without any formal financial service (17.9%, 16.6%-19.3%) than households overall (11.1%), so pairing support with savings-group or mobile-money access is relevant where the triple gap is high.
- **Coverage is uneven and the rules should complement, not replace, current criteria.** The Eastern Province holds 26% of poor households but only 8.1% of them are reached today, against 18.8% in the Northern and 19.0% in the Western Province. A poverty-ranked rule would raise reach in most groups (for example +196 per 1,000 in the Eastern Province and +128 in rural areas), but would add almost nothing for female-headed poor households, who are already reached better than average (20.7% vs 12.6% for male-headed households). The recommended use is a screening aid alongside existing criteria.


## How a planner can act
1. Open the district brief and read the exclusion error, leakage and triple-gap share against the national value.
2. Use the simulator to compare what each rule reaches at the district's actual coverage; where the interval does not show a clear gain, treat the result as inconclusive.
3. Test the scorecard as a screening aid alongside existing criteria, not as a replacement.
4. Where samples are small (flagged `small_cell`), collect more data before acting.

## Path to adoption (not yet done)
No pilot has been run and no planner has yet validated the tool. A realistic next step: (1) walk two or three district planners through the district brief and the simulator and record what they would change; (2) agree with a programme team to test the scorecard as a screening aid alongside the current criteria in one district, tracking who is reached and who is missed, including female-headed households; (3) re-run the pipeline when the next survey round is released (one command: `bash pipeline/run_all.sh`).


Reach is a policy design tool; it cannot identify real households.
