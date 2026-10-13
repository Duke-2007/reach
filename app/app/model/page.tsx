import { LazyModelPage } from "@/components/LazyPages";
import { loadModelMetrics } from "@/lib/data-loader";

export default async function ModelRoute() {
  const data = await loadModelMetrics();
  return <LazyModelPage data={data} />;
}
