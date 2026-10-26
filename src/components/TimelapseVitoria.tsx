"use client";

import { useEffect, useMemo, useState } from "react";
import { carregarReplayCliente } from "@/lib/replay-client";
import { aplicarReplay } from "@/lib/replay";
import { criarRoteiro, DURACAO_COMEMORACAO_MS, indiceNoTempo, posicaoTimelapse } from "@/lib/timelapse";
import { fmtInt, fmtPct } from "@/lib/format";
import { scopeName, type Scope } from "@/lib/ufs";
import type { ApuracaoResponse, ReplayResponse } from "@/lib/types";
import MapaTimelapse from "./MapaTimelapse";
import type {EventoVitoria} from "./AvisoVitoria";

const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function TimelapseVitoria({ resultadoFinal, vitoria, onTentar,onAlternar,onPosicionar }: {
  resultadoFinal: ApuracaoResponse;
  vitoria:EventoVitoria;
  onTentar: () => void;
  onAlternar:()=>void;
  onPosicionar:(ms:number)=>void;
}) {
  const {iniciadoEm,pausado}=vitoria;
  const [dados, setDados] = useState<ReplayResponse | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [agora, setAgora] = useState(0);
  const [scope, setScope] = useState<Scope>("br");
  useEffect(() => {
    let cancelado = false;
    carregarReplayCliente().then(r => { if (!cancelado) { setDados(r); setErro(false); } }).catch(() => { if (!cancelado) setErro(true); });
    return () => { cancelado = true; };
  }, [tentativa, iniciadoEm]);
  useEffect(() => {
    if (iniciadoEm === null||pausado) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [iniciadoEm,pausado]);
  // Na reinicialização, o instante anterior nunca pode adiantar o novo filme.
  const decorrido = posicaoTimelapse(vitoria,agora);
  const roteiro = useMemo(() => dados ? criarRoteiro(dados) : null, [dados]);
  const indice = roteiro ? indiceNoTempo(roteiro, decorrido) : 0;
  const atual = useMemo(() => dados ? aplicarReplay(resultadoFinal, dados, indice) : null, [resultadoFinal, dados, indice]);
  const marco = roteiro?.marcos.filter(m => m.indice <= indice).at(-1);
  const nacional = atual?.nacional;
  const restante = Math.ceil((DURACAO_COMEMORACAO_MS - decorrido) / 1000);
  const carregando=iniciadoEm===null&&!pausado;

  if (!dados || !nacional || !roteiro) return (
    <div className="flex min-h-80 items-center justify-center text-center">
      {erro ? <div role="alert"><p>Não foi possível carregar o histórico local.</p><button type="button" className="mt-3 rounded-full bg-white px-4 py-2 font-semibold text-[#07401d]" onClick={() => { setTentativa(n=>n+1); onTentar(); }}>Tentar novamente</button></div> : <p role="status">Preparando os momentos da apuração…</p>}
    </div>
  );
  return (
    <section aria-label="Timelapse da apuração" data-decorrido-ms={Math.floor(decorrido)} className="w-full">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/20 pb-3">
        <div>
          <h2 className="text-xl font-bold sm:text-3xl" aria-live="polite">{marco?.titulo}</h2>
          <p className="mt-1 text-sm text-white/75">{hora.format(new Date(dados.pontos[indice].t))} em Brasília · {fmtPct(nacional.pctTotalizado)} das urnas</p>
        </div>
        <div className="text-right text-sm tabular"><span className="text-white/65">Timelapse de 1min30s</span><div className="text-xl font-bold">{Math.floor(restante/60)}:{String(restante%60).padStart(2,"0")}</div></div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Controles do timelapse">
        <button type="button" disabled={carregando} onClick={onAlternar} className="rounded-full bg-[#FFDF00] px-4 py-2 text-sm font-bold text-[#07401d] disabled:opacity-50">{carregando ? "Preparando…" : pausado ? decorrido>=90000 ? "↻ Recomeçar" : "▶ Continuar" : "⏸ Pausar"}</button>
        <button type="button" disabled={carregando} onClick={()=>onPosicionar(decorrido-10000)} className="rounded-full border border-white/30 px-3 py-2 text-sm disabled:opacity-50">↶ 10s</button>
        <button type="button" disabled={carregando} onClick={()=>onPosicionar(decorrido+10000)} className="rounded-full border border-white/30 px-3 py-2 text-sm disabled:opacity-50">10s ↷</button>
        <input type="range" disabled={carregando} min={0} max={90} step={0.25} value={decorrido/1000} onChange={e=>onPosicionar(Number(e.target.value)*1000)} aria-label="Posição do timelapse" aria-valuetext={`${Math.floor(decorrido/1000)} de 90 segundos`} className="min-w-40 flex-1 accent-[#FFDF00]"/>
        <span className="text-xs tabular">{Math.floor(decorrido/1000)}s / 90s</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        {["13","22"].map(numero => {
          const c = nacional.candidatos.find(c=>c.numero===numero);
          if (!c) return null;
          return <div key={numero} className={`border-l-4 pl-3 ${numero === "22" ? "border-[#8b93ff]" : "border-[#ff7b87]"}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.foto} alt="" className="size-8 rounded-full object-cover" />{c.nome}
            </div>
            <div className="mt-1 text-3xl font-black tabular sm:text-4xl">{fmtPct(c.pct)}</div>
            <div className="text-sm text-white/80 tabular">{fmtInt(c.votos)} votos</div>
          </div>;
        })}
      </div>

      <MapaTimelapse apuracao={atual!} scope={scope} onSelect={setScope} pausado={pausado} />

      <ol className="mt-5 grid grid-cols-2 gap-2 border-t border-white/20 pt-3 text-xs sm:flex sm:flex-wrap sm:justify-between" aria-label="Marcos da apuração">
        {roteiro.marcos.map((m,i)=><li key={`${m.tipo}-${m.indice}`} aria-current={m===marco ? "step" : undefined} className={m.indice <= indice ? "text-[#FFDF00]" : "text-white/45"}>
          <span className="block font-bold">{i+1}. {m.titulo}</span><span>{hora.format(new Date(dados.pontos[m.indice].t))}</span>
        </li>)}
      </ol>
      <p className="mt-3 text-[11px] text-white/55">Snapshots gravados do TSE; UFs podem ter horários diferentes. A garantia matemática é uma conta deste site; o selo oficial só aparece no resultado final. {scope !== "br" && `Seleção: ${scopeName(scope)}.`}</p>
      <div className="fixed inset-x-0 bottom-0 h-1.5 bg-white/10"><div className="h-full bg-[#FFDF00]" style={{width:`${100-decorrido/DURACAO_COMEMORACAO_MS*100}%`}}/></div>
    </section>
  );
}
