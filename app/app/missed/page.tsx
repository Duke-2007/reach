import { MissedPage } from "@/components/MissedPage";
import { loadProfiles } from "@/lib/data-loader";

export default async function MissedRoute() {
  const data = await loadProfiles();
  return <MissedPage data={data} />;
}
