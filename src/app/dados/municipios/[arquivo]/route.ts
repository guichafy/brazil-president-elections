import { carregarMunicipios } from "@/lib/municipios";
import { ALL_SCOPES, isScope } from "@/lib/ufs";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_SCOPES.filter((s) => s !== "br").map((scope) => ({ arquivo: `${scope}.json` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ arquivo: string }> }) {
  const { arquivo } = await params;
  const scope = arquivo.replace(/\.json$/, "");
  if (!isScope(scope) || scope === "br") throw new Error(`Abrangência sem municípios: ${scope}`);
  return Response.json(await carregarMunicipios(scope));
}
