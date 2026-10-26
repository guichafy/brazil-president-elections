import type { ResultadoAbrangencia } from "./types";

export const LULA = "13";
export const FLAVIO = "22";

// Variações menores que isso (em p.p.) são tratadas como "não mudou".
const EPS = 0.0005;

export type Humor = "feliz" | "triste";

export interface Variacao {
  nome: string;
  pctAntes: number;
  pct: number;
  dPct: number;
  dVotos: number;
}

export interface EventoHumor {
  humor: Humor;
  dataHora: string;
  lula: Variacao;
  flavio: Variacao;
}

function variacao(antes: ResultadoAbrangencia, depois: ResultadoAbrangencia, numero: string): Variacao | null {
  const a = antes.candidatos.find((c) => c.numero === numero);
  const d = depois.candidatos.find((c) => c.numero === numero);
  if (!a || !d) return null;
  return { nome: d.nome, pctAntes: a.pct, pct: d.pct, dPct: d.pct - a.pct, dVotos: d.votos - a.votos };
}

/** Lula eleito pelo TSE ou, no 2º turno, com vitória já garantida pela conta (como no selo do placar). */
export function lulaVenceu(nacional: ResultadoAbrangencia): boolean {
  // No primeiro turno e=s também marca classificação para o segundo turno.
  if (nacional.turno !== "2") return false;
  if (nacional.candidatos.find((c) => c.numero === LULA)?.eleito) return true;
  return nacional.decisao.garantido && nacional.decisao.lider === LULA;
}

/**
 * Compara duas totalizações nacionais.
 * - feliz: Lula ganha votos e percentual, e Flávio perde percentual
 * - triste: Lula perde percentual e Flávio ganha percentual
 * Qualquer outra combinação (ou mesma totalização) não gera evento.
 */
export function avaliarHumor(antes: ResultadoAbrangencia | null | undefined, depois: ResultadoAbrangencia): EventoHumor | null {
  if (!antes || antes.isoDataHora === depois.isoDataHora) return null;
  const lula = variacao(antes, depois, LULA);
  const flavio = variacao(antes, depois, FLAVIO);
  if (!lula || !flavio) return null;

  if (lula.dPct > EPS && lula.dVotos > 0 && flavio.dPct < -EPS) {
    return { humor: "feliz", dataHora: depois.dataHora, lula, flavio };
  }
  if (lula.dPct < -EPS && flavio.dPct > EPS) {
    return { humor: "triste", dataHora: depois.dataHora, lula, flavio };
  }
  return null;
}
