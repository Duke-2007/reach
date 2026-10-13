import { LazySimulatePage } from "@/components/LazyPages";
import { loadEquity, loadSimulatorGrid } from "@/lib/data-loader";

export default async function SimulateRoute() {
  const [data, equity] = await Promise.all([loadSimulatorGrid(), loadEquity()]);
  return <LazySimulatePage data={data} equity={equity} />;
}
