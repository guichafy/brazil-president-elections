import Apuracao from "@/components/Apuracao";
import { carregarApuracao, carregarComparacao, carregarTimeline } from "@/lib/static-data";

export default async function Home() {
  const [apuracao, comparacao, timeline] = await Promise.all([
    carregarApuracao(), carregarComparacao(), carregarTimeline("br"),
  ]);
  return <Apuracao apuracao={apuracao} comparacao={comparacao} timelineInicial={timeline} />;
}
