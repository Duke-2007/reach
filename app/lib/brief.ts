export type BriefRecommendation =
  | "action_screening_both"
  | "action_screening_model"
  | "action_screening_scorecard"
  | "action_monitor";

export function firstBriefRecommendation(
  modelClearGain: boolean,
  scorecardClearGain: boolean,
): BriefRecommendation {
  if (modelClearGain && scorecardClearGain) return "action_screening_both";
  if (modelClearGain) return "action_screening_model";
  if (scorecardClearGain) return "action_screening_scorecard";
  return "action_monitor";
}

export function compareConfidenceIntervals(
  estimate: readonly [number, number] | null | undefined,
  national: readonly [number, number] | null | undefined,
): "above" | "below" | "unclear" {
  if (!estimate || !national) return "unclear";
  if (estimate[0] > national[1]) return "above";
  if (estimate[1] < national[0]) return "below";
  return "unclear";
}
