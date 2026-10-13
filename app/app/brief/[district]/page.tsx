import { BriefPage } from "@/components/DistrictBrief";
import { loadBriefTargeting, loadDistrictGaps, loadMethodFacts } from "@/lib/data-loader";

export async function generateStaticParams() {
  const gaps = await loadDistrictGaps();
  return gaps.districts.map(({ district }) => ({ district: district.toLowerCase() }));
}

export default async function DistrictBriefRoute({
  params,
}: {
  params: Promise<{ district: string }>;
}) {
  const { district } = await params;
  const [gaps, targeting, facts] = await Promise.all([
    loadDistrictGaps(),
    loadBriefTargeting(),
    loadMethodFacts(),
  ]);
  const today = new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Kigali",
  }).format(new Date());
  return <BriefPage slug={district} gaps={gaps} targeting={targeting} today={today} nationalExclusionCi={facts.headline.exclusion_error_ci} />;
}
