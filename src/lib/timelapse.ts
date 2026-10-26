import type { ApuracaoResponse, ReplayResponse } from "./types";
import { ALL_SCOPES, scopeName, type Scope } from "./ufs";

export const DURACAO_COMEMORACAO_MS = 90_000;

export function posicaoTimelapse(relogio:{posicaoMs:number;iniciadoEm:number|null;pausado:boolean},agora=Date.now()) {
  return Math.max(0,Math.min(DURACAO_COMEMORACAO_MS,relogio.posicaoMs+(!relogio.pausado&&relogio.iniciadoEm!==null ? Math.max(0,agora-relogio.iniciadoEm) : 0)));
}

export function segmentoPrincipal(roteiro:RoteiroTimelapse,inicio:number,duracaoAudio:number) {
  const proxima=roteiro.marcos.find(m=>m.tipo==="virada"&&m.indice>inicio);
  const fim=proxima ? Math.max(inicio,proxima.indice-1) : roteiro.agenda.at(-1)!.indice;
  return {inicio,fim,proximo:proxima?.indice??null,duracaoMs:Math.max(proxima ? 12000 : 25000,duracaoAudio*1000)};
}

export interface MarcoTimelapse {
  tipo: "inicio" | "virada" | "garantia" | "final";
  indice: number;
  titulo: string;
  lider: string;
}
export interface RoteiroTimelapse {
  marcos: MarcoTimelapse[];
  agenda: { ms: number; indice: number }[];
}

/** Marcos são contagens gravadas, nunca cruzamentos interpolados ou projeções. */
export function criarRoteiro(replay: ReplayResponse): RoteiroTimelapse {
  const marcos: MarcoTimelapse[] = [];
  let lider = "", viradas = 0, garantiu = false;
  replay.pontos.forEach((p, indice) => {
    const s = replay.snapshots[p.indices.br];
    const [a, b] = [...s.cands].sort((a, b) => b.vap - a.vap);
    if (!a || a.vap === (b?.vap ?? 0)) return;
    if (!lider) marcos.push({ tipo: "inicio", indice, titulo: "O início do histórico", lider: a.n });
    else if (lider !== a.n) {
      viradas++;
      marcos.push({ tipo: "virada", indice, titulo: `${viradas}ª virada · ${a.n === "13" ? "Lula" : a.n === "22" ? "Flávio" : a.n} na frente`, lider: a.n });
    }
    lider = a.n;
    if (!garantiu && a.n === "13" && s.est !== undefined && s.te !== undefined && a.vap - (b?.vap ?? 0) > s.te - s.est) {
      garantiu = true;
      marcos.push({ tipo: "garantia", indice, titulo: "Vitória matematicamente garantida", lider });
    }
  });
  marcos.push({ tipo: "final", indice: replay.pontos.length - 1, titulo: lider === "13" ? "Os votos da vitória consolidados" : "Resultado final consolidado", lider });
  const agenda = [{ ms: 0, indice: 0 }];
  const intermediarios = marcos.filter(m => m.tipo !== "inicio" && m.tipo !== "final");
  intermediarios.forEach((m, i) => {
    const ms = intermediarios.length === 3 ? [23_000, 53_000, 74_000][i] : Math.round(((i + 1) / (intermediarios.length + 1)) * 78_000);
    agenda.push({ ms: ms - 4_000, indice: Math.max(agenda.at(-1)!.indice, m.indice - 1) }, { ms, indice: m.indice }, { ms: ms + 4_000, indice: m.indice });
  });
  agenda.push({ ms: 82_000, indice: replay.pontos.length - 1 }, { ms: DURACAO_COMEMORACAO_MS, indice: replay.pontos.length - 1 });
  return { marcos, agenda };
}

export function indiceNoTempo(roteiro: RoteiroTimelapse, ms: number): number {
  if (ms <= 0) return roteiro.agenda[0].indice;
  for (let i = 1; i < roteiro.agenda.length; i++) {
    const a = roteiro.agenda[i - 1], b = roteiro.agenda[i];
    if (ms <= b.ms) return Math.floor(a.indice + ((ms - a.ms) / (b.ms - a.ms)) * (b.indice - a.indice));
  }
  return roteiro.agenda.at(-1)!.indice;
}

export interface InsightEstadual {
  scope: Scope;
  nome: string;
  apurado: number;
  deltaApurado: number;
  lula: { votos: number; pct: number; delta: number };
  flavio: { votos: number; pct: number; delta: number };
}

/** Diferenças observadas entre dois retratos, sem atribuir causalidade à vitória. */
export function insightsEstaduais(atual: ApuracaoResponse, antes: ApuracaoResponse): InsightEstadual[] {
  return ALL_SCOPES.filter(s => s !== "br").map(scope => {
    const r = scope === "zz" ? atual.exterior : atual.ufs[scope];
    const a = scope === "zz" ? antes.exterior : antes.ufs[scope];
    const candidato = (numero: string) => {
      const c = r?.candidatos.find(c => c.numero === numero);
      return { votos: c?.votos ?? 0, pct: c?.pct ?? 0, delta: (c?.votos ?? 0) - (a?.candidatos.find(c => c.numero === numero)?.votos ?? 0) };
    };
    return { scope, nome: scopeName(scope), apurado: r?.pctTotalizado ?? 0, deltaApurado: (r?.pctTotalizado ?? 0) - (a?.pctTotalizado ?? 0), lula: candidato("13"), flavio: candidato("22") };
  });
}
