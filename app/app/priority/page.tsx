import PriorityPage from "@/components/PriorityPage";
import { loadPriorityTable } from "@/lib/data-loader";

export default async function PriorityRoute() {
  const data = await loadPriorityTable();
  return <PriorityPage data={data} />;
}
