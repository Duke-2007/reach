import { LazyGapMap } from "@/components/LazyPages";
import { loadDistrictGaps, loadMethodFacts } from "@/lib/data-loader";
import HomeLanding from "@/components/HomeLanding";

export default async function HomePage() {
  const [data, facts] = await Promise.all([loadDistrictGaps(), loadMethodFacts()]);
  return <><HomeLanding facts={facts} /><LazyGapMap data={data} /></>;
}
