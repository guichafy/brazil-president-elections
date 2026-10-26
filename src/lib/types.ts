import type { ResultadoProjecao } from "./projecao";
import type { Scope } from "./ufs";

export interface Candidato {
  numero: string;
  sqcand: string;
  nome: string; // nome de urna
  nomeCompleto: string;
  partido: string;
  coligacao: string;
  vice: string;
  cor: string;
  foto: string;
  votos: number;
  pct: number; // % dos votos válidos
  eleito: boolean;
  situacao: string; // ex.: "Eleito", "2º turno", "" durante a apuração
}

/**
 * Vitória garantida na abrangência (maioria simples): a vantagem do 1º sobre o 2º
 * supera o eleitorado das seções ainda não totalizadas — mesmo que todos esses
 * eleitores compareçam e votem no 2º colocado, o resultado não muda.
 */
export interface Decisao {
  lider: string | null; // número do candidato
  vantagem: number; // votos do 1º - votos do 2º
  restante: number; // eleitorado em seções não totalizadas
  garantido: boolean;
}

export interface ResultadoAbrangencia {
  abstencaoDisponivel?: boolean; // falso no replay: o gravador não preservava e.a
  scope: Scope;
  turno: string;
  dataHora: string; // "dd/mm/aaaa hh:mm:ss" da totalização, em horário de Brasília
  isoDataHora: string;
  secoesTotais: number;
  secoesTotalizadas: number;
  pctTotalizado: number;
  eleitorado: number;
  eleitoradoTotalizado: number;
  comparecimento: number;
  pctComparecimento: number;
  abstencao: number;
  pctAbstencao: number;
  validos: number;
  brancos: number;
  pctBrancos: number;
  nulos: number;
  pctNulos: number;
  finalizado: boolean;
  decisao: Decisao;
  candidatos: Candidato[]; // ordenados por votos
}

export interface ApuracaoResponse {
  eleicao: string;
  buscadoEm: string;
  nacional: ResultadoAbrangencia | null;
  exterior: ResultadoAbrangencia | null;
  ufs: Partial<Record<Scope, ResultadoAbrangencia>>;
  erros: string[];
  projecao: ProjecaoNacional | null;
}

export interface ProjecaoNacional {
  tendencia: ResultadoProjecao; // método principal
  proporcional: ResultadoProjecao; // usado como faixa de comparação
  janelaMin: number;
}

export interface PontoTimeline {
  t: string; // ISO da totalização
  hora: string;
  pctTotalizado: number;
  votos: Record<string, number>; // numero -> votos
  pct: Record<string, number>; // numero -> % válidos
  proj?: Record<string, number>; // numero -> % projetado para 100% (só nacional)
}

/** Série nacional de outra apuração (% dos válidos por % de urnas apuradas), para comparar com a atual. */
export interface SerieReferencia {
  rotulo: string; // ex.: "2º T - 2022"
  nomes: Record<string, string>; // numero -> nome (vazio: usa o nome do candidato atual)
  pontos: { apurado: number; pct: Record<string, number> }[];
}

export interface ComparacaoResponse {
  ano2022: SerieReferencia | null; // 2º turno de 2022
  primeiroTurno: SerieReferencia | null; // 1º turno de 2026 (gravado pelo gravador)
}

export interface TimelineResponse {
  scope: Scope;
  pontos: PontoTimeline[];
}

export interface ReplaySnapshot {
  scope: Scope;
  rec: string;
  isoDataHora: string;
  st: number;
  ts: number;
  vv: number;
  vb: number;
  tvn: number;
  c: number;
  te?: number;
  est?: number;
  cands: { n: string; vap: number }[];
}

export interface ReplayResponse {
  snapshots: ReplaySnapshot[];
  pontos: {
    rec: string;
    t: string;
    indices: Partial<Record<Scope, number>> & { br: number };
    projecao: ProjecaoNacional | null;
  }[];
}
