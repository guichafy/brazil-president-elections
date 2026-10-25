import { ELEICAO } from "@/lib/config";
import { projetar, type EstadoAbr } from "@/lib/projecao";
import { JANELA_TENDENCIA_MS, anterioresPara, referenciaPrimeiroTurno } from "@/lib/snapshots";
import { fetchResultado } from "@/lib/tse";
import type { ApuracaoResponse, ProjecaoNacional, ResultadoAbrangencia } from "@/lib/types";
import { ALL_SCOPES } from "@/lib/ufs";

export const dynamic = "force-dynamic";

// O CDN do TSE não envia cabeçalhos CORS, então o navegador consulta esta rota.
// Cache em memória curto para que vários clientes não multipliquem as requisições ao TSE.
const TTL_MS = 10_000;
let cache: { at: number; data: ApuracaoResponse } | null = null;
let inflight: Promise<ApuracaoResponse> | null = null;

async function load(): Promise<ApuracaoResponse> {
  const settled = await Promise.allSettled(ALL_SCOPES.map((s) => fetchResultado(s)));
  const data: ApuracaoResponse = {
    eleicao: ELEICAO,
    buscadoEm: new Date().toISOString(),
    nacional: null,
    exterior: null,
    ufs: {},
    erros: [],
    projecao: null,
  };
  settled.forEach((r, i) => {
    const scope = ALL_SCOPES[i];
    if (r.status === "rejected") {
      data.erros.push(String(r.reason?.message ?? r.reason));
      // mantém o último valor conhecido se o TSE falhar pontualmente
      const prev = scope === "br" ? cache?.data.nacional : scope === "zz" ? cache?.data.exterior : cache?.data.ufs[scope];
      if (!prev) return;
      r = { status: "fulfilled", value: prev };
    }
    if (scope === "br") data.nacional = r.value;
    else if (scope === "zz") data.exterior = r.value;
    else data.ufs[scope] = r.value;
  });
  data.projecao = await calcularProjecao(data);
  return data;
}

function paraEstado(r: ResultadoAbrangencia): EstadoAbr {
  return {
    scope: r.scope,
    st: r.secoesTotalizadas,
    ts: r.secoesTotais,
    te: r.eleitorado,
    est: r.eleitoradoTotalizado,
    c: r.comparecimento,
    vv: r.validos,
    votos: Object.fromEntries(r.candidatos.map((c) => [c.numero, c.votos])),
  };
}

async function calcularProjecao(data: ApuracaoResponse): Promise<ProjecaoNacional | null> {
  const abrs = [...Object.values(data.ufs), data.exterior].filter((r): r is ResultadoAbrangencia => !!r);
  if (abrs.length < 28) return null; // sem todas as abrangências a soma ficaria errada
  const estados = abrs.map(paraEstado);
  const anteriores = await anterioresPara(Date.now());
  const ref = await referenciaPrimeiroTurno();
  return {
    tendencia: projetar(estados, "tendencia", anteriores, ref),
    proporcional: projetar(estados, "proporcional", undefined, ref),
    janelaMin: JANELA_TENDENCIA_MS / 60_000,
  };
}

export async function GET() {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    inflight ??= load().finally(() => (inflight = null));
    const data = await inflight;
    cache = { at: Date.now(), data };
  }
  return Response.json(cache.data, { headers: { "Cache-Control": "no-store" } });
}
