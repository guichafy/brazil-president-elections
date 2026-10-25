// Projeção do resultado com 100% das urnas apuradas, feita estado a estado.
//
// Para cada abrangência (27 UFs + exterior):
//   votos válidos que faltam ≈ eleitores das seções não apuradas × comparecimento × taxa de válidos
//   (comparecimento e taxa de válidos observados nas seções já apuradas daquela abrangência)
// Os votos que faltam são divididos entre os candidatos de duas formas:
//   - "proporcional": como no acumulado já apurado na abrangência
//   - "tendencia": como nas urnas apuradas na janela recente (ex.: últimos 30 min), misturado ao
//     acumulado quando a janela tem poucos votos (evita ruído em estados com pouca variação)
// A projeção nacional é a soma das abrangências.

export interface EstadoAbr {
  scope: string;
  st: number; // seções totalizadas
  ts: number; // seções totais
  te: number; // eleitorado
  est: number; // eleitorado das seções totalizadas
  c: number; // comparecimento
  vv: number; // votos válidos
  votos: Record<string, number>;
}

export type Metodo = "proporcional" | "tendencia";

export interface CandidatoProjetado {
  numero: string;
  votos: number;
  pct: number;
  votosProj: number;
  pctProj: number;
}

export interface ResultadoProjecao {
  metodo: Metodo;
  validos: number;
  validosProj: number;
  candidatos: CandidatoProjetado[]; // ordenados pelo projetado
}

/** Votos válidos na janela recente a partir dos quais a tendência recebe peso total. */
const PESO_TOTAL_TENDENCIA = 30_000;
/** Peso (em votos) da divisão de referência (ex.: 1º turno na UF) frente aos votos já apurados. */
const PESO_REFERENCIA = 30_000;

/** Votos de referência por abrangência (ex.: 1º turno), usados enquanto há poucos votos apurados. */
export type Referencia = Map<string, Record<string, number>>;

function shares(votos: Record<string, number>): Record<string, number> {
  const total = Object.values(votos).reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  for (const [n, v] of Object.entries(votos)) out[n] = total ? v / total : 0;
  return out;
}

export function projetar(
  estados: EstadoAbr[],
  metodo: Metodo,
  anteriores?: Map<string, EstadoAbr>, // estado de cada abrangência no início da janela (tendência)
  referencia?: Referencia,
): ResultadoProjecao {
  // médias nacionais para abrangências ainda sem nenhuma seção apurada
  const tot = estados.reduce(
    (acc, e) => {
      acc.est += e.est;
      acc.c += e.c;
      acc.vv += e.vv;
      for (const [n, v] of Object.entries(e.votos)) acc.votos[n] = (acc.votos[n] ?? 0) + v;
      return acc;
    },
    { est: 0, c: 0, vv: 0, votos: {} as Record<string, number> },
  );
  const compNacional = tot.est ? tot.c / tot.est : 0.78;
  const validosNacional = tot.c ? tot.vv / tot.c : 0.95;
  const shareNacional = shares(tot.votos);

  const proj: Record<string, number> = {};
  let validosProj = 0;

  for (const e of estados) {
    const restante = Math.max(0, e.te - e.est);
    const comp = e.est > 0 && e.c > 0 ? e.c / e.est : compNacional;
    const taxaValidos = e.c > 0 ? e.vv / e.c : validosNacional;
    const faltam = restante * comp * taxaValidos;

    let share = e.vv > 0 ? shares(e.votos) : shareNacional;
    const refVotos = referencia?.get(e.scope);
    const ref = refVotos && shares(Object.fromEntries(Object.keys(e.votos).map((n) => [n, refVotos[n] ?? 0])));
    if (ref && Object.values(ref).some((v) => v > 0)) {
      // com poucos votos apurados, a divisão de referência pesa mais que a amostra
      const w = e.vv / (e.vv + PESO_REFERENCIA);
      share = Object.fromEntries(Object.keys(e.votos).map((n) => [n, w * (share[n] ?? 0) + (1 - w) * ref[n]]));
    }
    const ant = anteriores?.get(e.scope);
    if (metodo === "tendencia" && ant && e.vv > 0) {
      const delta: Record<string, number> = {};
      let dv = 0;
      for (const [n, v] of Object.entries(e.votos)) {
        delta[n] = Math.max(0, v - (ant.votos[n] ?? 0));
        dv += delta[n];
      }
      if (dv > 0) {
        const w = Math.min(1, dv / PESO_TOTAL_TENDENCIA);
        const marg = shares(delta);
        share = Object.fromEntries(Object.keys(share).map((n) => [n, w * (marg[n] ?? 0) + (1 - w) * share[n]]));
      }
    }

    for (const [n, v] of Object.entries(e.votos)) proj[n] = (proj[n] ?? 0) + v + faltam * (share[n] ?? 0);
    validosProj += e.vv + faltam;
  }

  const candidatos = Object.keys(proj)
    .map((n) => ({
      numero: n,
      votos: tot.votos[n] ?? 0,
      pct: tot.vv ? ((tot.votos[n] ?? 0) / tot.vv) * 100 : 0,
      votosProj: Math.round(proj[n]),
      pctProj: validosProj ? (proj[n] / validosProj) * 100 : 0,
    }))
    .sort((a, b) => b.votosProj - a.votosProj);

  return { metodo, validos: tot.vv, validosProj: Math.round(validosProj), candidatos };
}
