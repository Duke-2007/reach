import { LazyMissedPage } from "@/components/LazyPages";
import { loadProfiles } from "@/lib/data-loader";

export default async function MissedRoute() {
  const data = await loadProfiles();
  return <LazyMissedPage data={data} />;
}
