import { ModelPage } from "@/components/ModelPage";
import { loadModelMetrics } from "@/lib/data-loader";

export default async function ModelRoute() {
  const data = await loadModelMetrics();
  return <ModelPage data={data} />;
}
