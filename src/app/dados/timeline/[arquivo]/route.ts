import { carregarTimeline } from "@/lib/static-data";
import { ALL_SCOPES, isScope } from "@/lib/ufs";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_SCOPES.map((scope) => ({ arquivo: `${scope}.json` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ arquivo: string }> }) {
  const { arquivo } = await params;
  const scope = arquivo.replace(/\.json$/, "");
  if (!isScope(scope)) throw new Error(`Abrangência inválida: ${scope}`);
  return Response.json(await carregarTimeline(scope));
}
