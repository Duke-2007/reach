import BriefIndex from "@/components/BriefIndex";
import { loadPriorityTable } from "@/lib/data-loader";

export default async function BriefIndexRoute() {
  const table = await loadPriorityTable();
  return <BriefIndex districts={table.districts} />;
}
