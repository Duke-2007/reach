import { SimulatePage } from "@/components/SimulatePage";
import { loadSimulatorGrid } from "@/lib/data-loader";

export default async function SimulateRoute() {
  const data = await loadSimulatorGrid();
  return <SimulatePage data={data} />;
}
