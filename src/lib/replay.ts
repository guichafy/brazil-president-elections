import type { ApuracaoResponse, ReplayResponse, ReplaySnapshot, ResultadoAbrangencia } from "./types";
import type { Scope } from "./ufs";

const brasilia = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

export function indicePorPercentual(replay: ReplayResponse, percentual: number, scope: Scope = "br"): number {
  if (percentual >= 100) return replay.pontos.length - 1;
  let melhor = 0, distancia = Infinity;
  for (let i = 0; i < replay.pontos.length; i++) {
    const index = replay.pontos[i].indices[scope];
    const s = index === undefined ? undefined : replay.snapshots[index];
    const delta = Math.abs((s?.ts ? (s.st / s.ts) * 100 : 0) - percentual);
    if (delta < distancia) { distancia = delta; melhor = i; }
  }
  return melhor;
}

function restaurar(base: ResultadoAbrangencia, snap: ReplaySnapshot | undefined, momento: string): ResultadoAbrangencia {
  const votos = new Map(snap?.cands.map((c) => [c.n, c.vap]));
  const validos = snap?.vv ?? 0;
  const completo = !!snap && snap.st === snap.ts;
  const candidatos = base.candidatos.map((c) => ({
    ...c, votos: votos.get(c.numero) ?? 0, pct: validos ? ((votos.get(c.numero) ?? 0) / validos) * 100 : 0,
    // Os snapshots não registravam quando o TSE declarou cada situação.
    eleito: false, situacao: "",
  })).sort((a, b) => b.votos - a.votos);
  const restante = snap?.est !== undefined ? Math.max(0, base.eleitorado - snap.est) : base.eleitorado;
  const vantagem = (candidatos[0]?.votos ?? 0) - (candidatos[1]?.votos ?? 0);
  const comparecimento = snap?.c ?? 0;
  return {
    ...base, candidatos, validos, comparecimento,
    secoesTotais: snap?.ts ?? base.secoesTotais, secoesTotalizadas: snap?.st ?? 0,
    pctTotalizado: snap?.ts ? (snap.st / snap.ts) * 100 : 0,
    eleitoradoTotalizado: snap?.est ?? 0,
    brancos: snap?.vb ?? 0, pctBrancos: comparecimento ? ((snap?.vb ?? 0) / comparecimento) * 100 : 0,
    nulos: snap?.tvn ?? 0, pctNulos: comparecimento ? ((snap?.tvn ?? 0) / comparecimento) * 100 : 0,
    abstencaoDisponivel: false, abstencao: 0, pctAbstencao: 0, pctComparecimento: 0,
    finalizado: false,
    isoDataHora: snap?.isoDataHora ?? momento,
    dataHora: snap ? brasilia.format(new Date(snap.isoDataHora)).replace(",", "") : "Sem registro neste momento",
    decisao: { lider: validos ? candidatos[0]?.numero ?? null : null, vantagem, restante, garantido: validos > 0 && (completo || vantagem > restante) },
  };
}

/** Combina contagens históricas com nomes, cores e fotos permanentes, sem modificar o arquivo. */
export function aplicarReplay(final: ApuracaoResponse, replay: ReplayResponse, indice: number): ApuracaoResponse {
  const i = Math.max(0, Math.min(replay.pontos.length - 1, Math.trunc(indice)));
  if (i === replay.pontos.length - 1) return final;
  const ponto = replay.pontos[i];
  const snapshot = (scope: keyof typeof ponto.indices) => {
    const index = ponto.indices[scope];
    return index === undefined ? undefined : replay.snapshots[index];
  };
  return {
    ...final, buscadoEm: ponto.rec, projecao: ponto.projecao,
    nacional: final.nacional ? restaurar(final.nacional, snapshot("br"), ponto.t) : null,
    exterior: final.exterior ? restaurar(final.exterior, snapshot("zz"), ponto.t) : null,
    ufs: Object.fromEntries(Object.entries(final.ufs).map(([scope, r]) => [scope, restaurar(r!, snapshot(r!.scope), ponto.t)])),
  };
}
