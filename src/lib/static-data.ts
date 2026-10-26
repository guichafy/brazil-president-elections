import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateArchive } from "../../scripts/lib/archive.mjs";
import { ELEICAO, ELEICAO_1T } from "./config";
import { projetar, type EstadoAbr } from "./projecao";
import { JANELA_TENDENCIA_MS, anterioresPara, historicoProjecao, lerSnapshots, referenciaPrimeiroTurno, snapshotParaEstado } from "./snapshots";
import { fmtBrasilia, parseResultado, toIso, type RawResultado } from "./tse";
import type { ApuracaoResponse, ComparacaoResponse, ReplayResponse, ResultadoAbrangencia, SerieReferencia, TimelineResponse } from "./types";
import { ALL_SCOPES, isScope, type Scope } from "./ufs";

interface ArquivoResultados {
  eleicao: string;
  arquivadoEm: string;
  abrangencias: Record<Scope, RawResultado>;
}

let apuracao: Promise<ApuracaoResponse> | undefined;

/** Somente no build: nunca consulta o TSE e falha se o arquivo estiver incompleto. */
export function carregarApuracao(): Promise<ApuracaoResponse> {
  return apuracao ??= (async () => {
    const arquivo: ArquivoResultados = JSON.parse(await readFile(join(process.cwd(), "data", `resultados-${ELEICAO}.json`), "utf8"));
    validateArchive(arquivo);
    const resultados = new Map(ALL_SCOPES.map((s) => [s, parseResultado(s, arquivo.abrangencias[s])]));
    const nacional = resultados.get("br")!;
    const exterior = resultados.get("zz")!;
    const ufs = Object.fromEntries([...resultados].filter(([s]) => s !== "br" && s !== "zz"));
    const estados = [...Object.values(ufs), exterior].map(paraEstado);
    const anteriores = await anterioresPara(Date.parse(nacional.isoDataHora));
    const ref = await referenciaPrimeiroTurno();
    return {
      eleicao: ELEICAO, buscadoEm: arquivo.arquivadoEm, nacional, exterior, ufs, erros: [],
      projecao: {
        tendencia: projetar(estados, "tendencia", anteriores, ref),
        proporcional: projetar(estados, "proporcional", undefined, ref),
        janelaMin: JANELA_TENDENCIA_MS / 60_000,
      },
    };
  })();
}

function paraEstado(r: ResultadoAbrangencia): EstadoAbr {
  return {
    scope: r.scope, st: r.secoesTotalizadas, ts: r.secoesTotais, te: r.eleitorado,
    est: r.eleitoradoTotalizado, c: r.comparecimento, vv: r.validos,
    votos: Object.fromEntries(r.candidatos.map((c) => [c.numero, c.votos])),
  };
}

/** Mesma transformação da antiga API, executada uma vez por abrangência no build. */
export async function carregarTimeline(scope: Scope): Promise<TimelineResponse> {
  const snaps = (await lerSnapshots()).filter((s) => s.scope === scope && s.st > 0 && s.dt);
  if (!snaps.length) throw new Error(`Histórico ausente: ${scope}`);
  const projecoes = scope === "br" ? await historicoProjecao() : null;
  const pontos = snaps.map((s) => {
    const validos = s.vv || s.cands.reduce((acc, c) => acc + c.vap, 0);
    const t = scope === "zz" ? s.rec : toIso(s.dt, s.ht, scope);
    return {
      t, hora: fmtBrasilia(t).slice(11, 16), pctTotalizado: s.ts ? (s.st / s.ts) * 100 : 0,
      votos: Object.fromEntries(s.cands.map((c) => [c.n, c.vap])),
      pct: Object.fromEntries(s.cands.map((c) => [c.n, validos ? (c.vap / validos) * 100 : 0])),
      ...(projecoes?.has(s.rec) ? { proj: Object.fromEntries(projecoes.get(s.rec)!.candidatos.map((c) => [c.numero, c.pctProj])) } : {}),
    };
  });
  pontos.sort((a, b) => a.pctTotalizado - b.pctTotalizado || a.t.localeCompare(b.t));
  return { scope, pontos };
}

export async function carregarComparacao(): Promise<ComparacaoResponse> {
  const d: { candidatos: Record<string, string>; pontos: ({ apurado: number } & Record<string, number>)[] } =
    JSON.parse(await readFile(join(process.cwd(), "data", "referencia-2022-2t.json"), "utf8"));
  const ano2022: SerieReferencia = {
    rotulo: "2º T - 2022", nomes: d.candidatos,
    pontos: d.pontos.map(({ apurado, ...pct }) => ({ apurado, pct })),
  };
  let primeiroTurno: SerieReferencia | null = null;
  if (ELEICAO_1T) {
    const snaps = (await lerSnapshots(ELEICAO_1T)).filter((s) => s.scope === "br" && s.st > 0 && s.vv > 0);
    if (!snaps.length) throw new Error("Histórico do primeiro turno ausente");
    const porApurado = new Map<number, Record<string, number>>();
    for (const s of snaps) porApurado.set((s.st / s.ts) * 100, Object.fromEntries(s.cands.map((c) => [c.n, (c.vap / s.vv) * 100])));
    primeiroTurno = {
      rotulo: "1º T - 2026", nomes: {},
      pontos: [...porApurado].map(([apurado, pct]) => ({ apurado, pct })).sort((a, b) => a.apurado - b.apurado),
    };
  }
  return { ano2022, primeiroTurno };
}

export async function carregarReplay(): Promise<ReplayResponse> {
  const snaps = (await lerSnapshots()).filter((s) => isScope(s.scope));
  const final = await carregarApuracao();
  const ref = await referenciaPrimeiroTurno();
  const historico = await historicoProjecao();
  const snapshots = snaps.map((s) => ({
    scope: s.scope as Scope, rec: s.rec,
    isoDataHora: s.scope === "zz" || !s.dt ? s.rec : toIso(s.dt, s.ht, s.scope as Scope),
    st: s.st, ts: s.ts, vv: s.vv, vb: s.vb, tvn: s.tvn, c: s.c, te: s.te, est: s.est, cands: s.cands,
  }));
  const pontos: ReplayResponse["pontos"] = [];
  const indices = new Map<Scope, number>();
  let cursor = 0;
  for (let n = 0; n < snaps.length; n++) {
    const br = snaps[n];
    if (br.scope !== "br" || br.st === 0) continue;
    // Mesmo ciclo do gravador usado pela projeção histórica (UFs chegam após o BR).
    while (cursor < snaps.length && snaps[cursor].recMs <= br.recMs + 15_000) {
      indices.set(snaps[cursor].scope as Scope, cursor++);
    }
    const estados = [...indices].filter(([s]) => s !== "br").map(([scope, idx]) => {
      const r = scope === "zz" ? final.exterior : final.ufs[scope];
      return snapshotParaEstado(snaps[idx], r?.eleitorado ?? 0);
    });
    const tendencia = historico.get(br.rec);
    pontos.push({
      rec: br.rec, t: snapshots[n].isoDataHora, indices: { ...Object.fromEntries(indices), br: n },
      projecao: tendencia ? {
        tendencia, proporcional: projetar(estados, "proporcional", undefined, ref), janelaMin: JANELA_TENDENCIA_MS / 60_000,
      } : null,
    });
  }
  if (pontos.length < 2) throw new Error("Histórico insuficiente para reprodução");
  return { snapshots, pontos };
}
