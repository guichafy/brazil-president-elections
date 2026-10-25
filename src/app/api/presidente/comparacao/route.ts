import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ELEICAO_1T } from "@/lib/config";
import { lerSnapshots } from "@/lib/snapshots";
import type { ComparacaoResponse, SerieReferencia } from "@/lib/types";

export const dynamic = "force-dynamic";

// As duas séries não mudam mais: lidas uma vez por processo.
let cache: Promise<ComparacaoResponse> | null = null;

interface Arquivo2022 {
  candidatos: Record<string, string>;
  pontos: ({ apurado: number } & Record<string, number>)[];
}

/** 2º turno de 2022, copiado da série do UOL (data/referencia-2022-2t.json). */
async function ano2022(): Promise<SerieReferencia | null> {
  try {
    const d = JSON.parse(await readFile(join(process.cwd(), "data", "referencia-2022-2t.json"), "utf8")) as Arquivo2022;
    return {
      rotulo: "2º T - 2022",
      nomes: d.candidatos,
      pontos: d.pontos.map(({ apurado, ...pct }) => ({ apurado, pct })),
    };
  } catch {
    return null;
  }
}

/** 1º turno de 2026, a partir dos snapshots nacionais gravados naquela noite. */
async function primeiroTurno(): Promise<SerieReferencia | null> {
  if (!ELEICAO_1T) return null;
  const snaps = (await lerSnapshots(ELEICAO_1T)).filter((s) => s.scope === "br" && s.st > 0 && s.vv > 0);
  if (!snaps.length) return null;
  const porApurado = new Map<number, Record<string, number>>();
  for (const s of snaps) {
    const apurado = (s.st / s.ts) * 100;
    porApurado.set(apurado, Object.fromEntries(s.cands.map((c) => [c.n, (c.vap / s.vv) * 100])));
  }
  return {
    rotulo: "1º T - 2026",
    nomes: {},
    pontos: [...porApurado].map(([apurado, pct]) => ({ apurado, pct })).sort((a, b) => a.apurado - b.apurado),
  };
}

export async function GET() {
  cache ??= Promise.all([ano2022(), primeiroTurno()]).then(([a, p]) => ({ ano2022: a, primeiroTurno: p }));
  return Response.json(await cache, { headers: { "Cache-Control": "no-store" } });
}
