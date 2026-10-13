import MethodPage from "@/components/MethodPage";
import { loadMethodFacts } from "@/lib/data-loader";

export default async function MethodRoute() {
  const facts = await loadMethodFacts();
  return <MethodPage facts={facts} />;
}
