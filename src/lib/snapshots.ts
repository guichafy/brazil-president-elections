import "server-only";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { ELEICAO, ELEICAO_1T } from "./config";
import { projetar, type EstadoAbr, type Referencia, type ResultadoProjecao } from "./projecao";

/** Linha gravada por scripts/recorder.mjs */
export interface Snapshot {
  scope: string;
  dt: string;
  ht: string;
  st: number;
  ts: number;
  vv: number;
  vb: number;
  tvn: number;
  c: number;
  te?: number; // gravado a partir de 04/10 ~18:40
  est?: number;
  rec: string;
  recMs: number;
  cands: { n: string; vap: number }[];
}

export const JANELA_TENDENCIA_MS = 30 * 60_000;

const arquivo = (eleicao = ELEICAO) => join(process.cwd(), "data", `snapshots-${eleicao}.jsonl`);
const arquivoEleitorado = () => join(process.cwd(), "data", `eleitorado-${ELEICAO}.json`);
const cache = new Map<string, { mtime: number; snaps: Snapshot[] }>();

let referencia: Promise<Referencia | undefined> | null = null;

/**
 * No 2º turno: divisão entre os finalistas no resultado final do 1º turno em cada abrangência,
 * a partir do último snapshot gravado do 1º turno. Lido uma vez (o arquivo não muda mais).
 */
export function referenciaPrimeiroTurno(): Promise<Referencia | undefined> {
  referencia ??= (async () => {
    if (!ELEICAO_1T) return undefined;
    let texto: string;
    try {
      texto = await readFile(arquivo(ELEICAO_1T), "utf8");
    } catch {
      return undefined;
    }
    const ultimo = new Map<string, Snapshot>();
    for (const line of texto.split("\n")) {
      if (!line) continue;
      try {
        const s = JSON.parse(line) as Snapshot;
        ultimo.set(s.scope, s);
      } catch {}
    }
    // votos de todos os candidatos; projetar() normaliza entre os que estão na disputa atual
    return new Map([...ultimo].map(([scope, s]) => [scope, Object.fromEntries(s.cands.map((c) => [c.n, c.vap]))]));
  })();
  return referencia;
}

export async function lerSnapshots(eleicao = ELEICAO): Promise<Snapshot[]> {
  let mtime: number;
  try {
    mtime = (await stat(arquivo(eleicao))).mtimeMs;
  } catch {
    return [];
  }
  const anterior = cache.get(eleicao);
  if (anterior?.mtime === mtime) return anterior.snaps;
  if (eleicao === ELEICAO) {
    try {
      eleitoradoArquivo = JSON.parse(await readFile(arquivoEleitorado(), "utf8"));
    } catch {}
  }
  const snaps: Snapshot[] = [];
  for (const line of (await readFile(arquivo(eleicao), "utf8")).split("\n")) {
    if (!line) continue;
    try {
      const s = JSON.parse(line) as Snapshot;
      s.recMs = Date.parse(s.rec);
      snaps.push(s);
    } catch {}
  }
  snaps.sort((a, b) => a.recMs - b.recMs);
  cache.set(eleicao, { mtime, snaps });
  return snaps;
}

let eleitoradoArquivo: Record<string, number> = {};

/** Eleitorado total por abrangência (é fixo): arquivo do gravador + linhas que já gravam `te`. */
function eleitoradoPorScope(snaps: Snapshot[]): Map<string, number> {
  const m = new Map<string, number>(Object.entries(eleitoradoArquivo));
  for (const s of snaps) if (s.te) m.set(s.scope, s.te);
  return m;
}

export function snapshotParaEstado(s: Snapshot, te: number): EstadoAbr {
  return {
    scope: s.scope,
    st: s.st,
    ts: s.ts,
    te: s.te ?? te,
    // linhas antigas não têm `est`: aproxima pela fração de seções totalizadas
    est: s.est ?? (s.ts ? (te * s.st) / s.ts : 0),
    c: s.c,
    vv: s.vv,
    votos: Object.fromEntries(s.cands.map((c) => [c.n, c.vap])),
  };
}

/** Por abrangência (sem `br`), o último snapshot com rec <= t. */
function estadosAte(porScope: Map<string, Snapshot[]>, t: number, te: Map<string, number>): Map<string, EstadoAbr> {
  const out = new Map<string, EstadoAbr>();
  for (const [scope, lista] of porScope) {
    let ultimo: Snapshot | undefined;
    for (const s of lista) {
      if (s.recMs > t) break;
      ultimo = s;
    }
    const eleitorado = te.get(scope);
    if (ultimo && eleitorado) out.set(scope, snapshotParaEstado(ultimo, eleitorado));
  }
  return out;
}

function agrupar(snaps: Snapshot[]) {
  const porScope = new Map<string, Snapshot[]>();
  for (const s of snaps) {
    if (s.scope === "br") continue;
    if (!porScope.has(s.scope)) porScope.set(s.scope, []);
    porScope.get(s.scope)!.push(s);
  }
  return porScope;
}

/** Estados no início da janela de tendência (ou o mais antigo disponível). */
export async function anterioresPara(agora: number): Promise<Map<string, EstadoAbr>> {
  const snaps = await lerSnapshots();
  const porScope = agrupar(snaps);
  const te = eleitoradoPorScope(snaps);
  const inicio = agora - JANELA_TENDENCIA_MS;
  const out = estadosAte(porScope, inicio, te);
  // sem histórico suficiente: usa o primeiro snapshot gravado de cada abrangência
  for (const [scope, lista] of porScope) {
    const eleitorado = te.get(scope);
    if (!out.has(scope) && lista[0] && eleitorado) out.set(scope, snapshotParaEstado(lista[0], eleitorado));
  }
  return out;
}

/**
 * Recalcula a projeção (método tendência) em cada atualização nacional gravada,
 * usando o retrato de cada UF naquele momento. Chave = rec do snapshot `br`.
 */
export async function historicoProjecao(): Promise<Map<string, ResultadoProjecao>> {
  const snaps = await lerSnapshots();
  const porScope = agrupar(snaps);
  const te = eleitoradoPorScope(snaps);
  const ref = await referenciaPrimeiroTurno();
  const out = new Map<string, ResultadoProjecao>();
  const primeiro = new Map<string, EstadoAbr>();
  for (const [scope, lista] of porScope) {
    const eleitorado = te.get(scope);
    if (lista[0] && eleitorado) primeiro.set(scope, snapshotParaEstado(lista[0], eleitorado));
  }

  for (const br of snaps) {
    if (br.scope !== "br") continue;
    // as UFs do mesmo ciclo do gravador chegam alguns segundos depois do `br`
    const t = br.recMs + 15_000;
    const estados = estadosAte(porScope, t, te);
    if (estados.size < 20) continue; // retrato incompleto
    const anteriores = estadosAte(porScope, t - JANELA_TENDENCIA_MS, te);
    for (const [scope, e] of primeiro) if (!anteriores.has(scope)) anteriores.set(scope, e);
    out.set(br.rec, projetar([...estados.values()], "tendencia", anteriores, ref));
  }
  return out;
}
