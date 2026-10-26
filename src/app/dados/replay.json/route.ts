import { carregarReplay } from "@/lib/static-data";

export const dynamic = "force-static";

export async function GET() {
  return Response.json(await carregarReplay());
}
