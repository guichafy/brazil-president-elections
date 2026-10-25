import "server-only";
import { fotoUrl, resultadoUrl } from "./config";
import { partyColor } from "./parties";
import type { Candidato, Decisao, ResultadoAbrangencia } from "./types";
import type { Scope } from "./ufs";

/** O TSE publica números como string, com vírgula decimal ("50,31"). */
export const num = (s: string | undefined | null): number =>
  s ? Number.parseFloat(s.replace(",", ".")) || 0 : 0;

const int = (s: string | undefined | null): number => (s ? Number.parseInt(s, 10) || 0 : 0);

// dt/ht (hora da totalização) vêm no fuso LOCAL de cada UF; dg/hg (geração do arquivo) em Brasília.
const UTC_OFFSET: Partial<Record<Scope, string>> = {
  ac: "-05:00",
  am: "-04:00",
  mt: "-04:00",
  ms: "-04:00",
  ro: "-04:00",
  rr: "-04:00",
};

/** "04/10/2026" + "17:40:17" -> ISO com o fuso da abrangência */
export function toIso(dt: string, ht: string, scope: Scope = "br"): string {
  const [d, m, y] = dt.split("/");
  return `${y}-${m}-${d}T${ht}${UTC_OFFSET[scope] ?? "-03:00"}`;
}

const dataHoraBrasilia = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
export const fmtBrasilia = (iso: string) => dataHoraBrasilia.format(new Date(iso)).replace(",", "");

// Formato bruto do arquivo <uf>-c0001-e00XXXX-u.json (somente campos usados)
interface RawCand {
  n: string;
  sqcand: string;
  nm: string;
  nmu: string;
  vap: string;
  pvapn?: string;
  pvap: string;
  e: string;
  st: string;
  vs?: { tp: string; nmu: string; sgp: string }[];
}
interface RawPar {
  sg: string;
  cand: RawCand[];
}
interface RawAgr {
  nm: string;
  tp: string;
  com: string;
  par: RawPar[];
}
export interface RawResultado {
  t: string;
  dg: string;
  hg: string;
  dt: string;
  ht: string;
  tf: string;
  s: Record<string, string>;
  e: Record<string, string>;
  v: Record<string, string>;
  carg: { agr: RawAgr[] }[];
}

export function calcDecisao(candidatos: Candidato[], restante: number, finalizado: boolean): Decisao {
  const [a, b] = candidatos;
  if (!a || a.votos === 0) return { lider: null, vantagem: 0, restante, garantido: false };
  const vantagem = a.votos - (b?.votos ?? 0);
  return { lider: a.numero, vantagem, restante, garantido: finalizado || vantagem > restante };
}

export function parseResultado(scope: Scope, raw: RawResultado): ResultadoAbrangencia {
  const candidatos: Candidato[] = [];
  for (const agr of raw.carg[0]?.agr ?? []) {
    for (const par of agr.par) {
      for (const c of par.cand) {
        const vice = c.vs?.find((v) => v.tp === "v");
        candidatos.push({
          numero: c.n,
          sqcand: c.sqcand,
          nome: c.nmu,
          nomeCompleto: c.nm,
          partido: par.sg,
          coligacao: agr.tp === "c" ? agr.nm : "",
          vice: vice ? `${vice.nmu} (${vice.sgp})` : "",
          cor: partyColor(par.sg),
          foto: fotoUrl(c.sqcand),
          votos: int(c.vap),
          pct: num(c.pvapn ?? c.pvap),
          eleito: c.e === "s",
          situacao: c.st,
        });
      }
    }
  }
  candidatos.sort((a, b) => b.votos - a.votos);

  const { s, e, v } = raw;
  const finalizado = raw.tf === "s";
  // No exterior, dt/ht refletem o fuso de algum país (ex.: "05/10 09:19"); usa a hora de geração.
  // Antes da 1ª seção totalizada, dt/ht vêm vazios: também usa a hora de geração.
  const iso = scope === "zz" || !raw.dt ? toIso(raw.dg, raw.hg) : toIso(raw.dt, raw.ht, scope);
  return {
    scope,
    turno: raw.t,
    dataHora: fmtBrasilia(iso),
    isoDataHora: iso,
    secoesTotais: int(s.ts),
    secoesTotalizadas: int(s.st),
    pctTotalizado: num(s.pstn ?? s.pst),
    eleitorado: int(e.te),
    eleitoradoTotalizado: int(e.est),
    comparecimento: int(e.c),
    pctComparecimento: num(e.pcn ?? e.pc),
    abstencao: int(e.a),
    pctAbstencao: num(e.pan ?? e.pa),
    validos: int(v.vv),
    brancos: int(v.vb),
    pctBrancos: num(v.pvbn ?? v.pvb),
    nulos: int(v.tvn),
    pctNulos: num(v.ptvnn ?? v.ptvn),
    finalizado,
    decisao: calcDecisao(candidatos, int(e.esnt), finalizado),
    candidatos,
  };
}

export async function fetchResultado(scope: Scope): Promise<ResultadoAbrangencia> {
  const res = await fetch(resultadoUrl(scope), {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${scope}: HTTP ${res.status}`);
  return parseResultado(scope, (await res.json()) as RawResultado);
}
