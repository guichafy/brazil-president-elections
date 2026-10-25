import type { NextRequest } from "next/server";
import { fmtBrasilia, toIso } from "@/lib/tse";
import { historicoProjecao, lerSnapshots } from "@/lib/snapshots";
import type { PontoTimeline, TimelineResponse } from "@/lib/types";
import { isScope } from "@/lib/ufs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("scope");
  const scope = isScope(param) ? param : "br";

  // antes da 1ª seção totalizada não há votos nem dt/ht
  const snaps = (await lerSnapshots()).filter((s) => s.scope === scope && s.st > 0 && s.dt);
  const projecoes = scope === "br" ? await historicoProjecao() : null;

  const pontos: PontoTimeline[] = [];
  for (const s of snaps) {
    const validos = s.vv || s.cands.reduce((acc, c) => acc + c.vap, 0);
    const votos: Record<string, number> = {};
    const pct: Record<string, number> = {};
    for (const c of s.cands) {
      votos[c.n] = c.vap;
      pct[c.n] = validos ? (c.vap / validos) * 100 : 0;
    }
    // exterior: dt/ht vêm em fuso estrangeiro, usa o momento da gravação
    const t = scope === "zz" ? s.rec : toIso(s.dt, s.ht, scope);
    pontos.push({
      t,
      hora: fmtBrasilia(t).slice(11, 16),
      pctTotalizado: s.ts ? (s.st / s.ts) * 100 : 0,
      votos,
      pct,
      proj: projecoes?.has(s.rec)
        ? Object.fromEntries(projecoes.get(s.rec)!.candidatos.map((c) => [c.numero, c.pctProj]))
        : undefined,
    });
  }
  pontos.sort((a, b) => a.pctTotalizado - b.pctTotalizado || a.t.localeCompare(b.t));

  const body: TimelineResponse = { scope, pontos };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
