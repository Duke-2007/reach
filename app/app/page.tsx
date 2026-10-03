import { GapMap } from "@/components/GapMap";
import { loadDistrictGaps } from "@/lib/data-loader";

export default async function HomePage() {
  const data = await loadDistrictGaps();
  return <GapMap data={data} />;
}
