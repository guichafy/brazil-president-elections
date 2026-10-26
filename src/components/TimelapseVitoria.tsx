"use client";

import { useEffect, useMemo, useState } from "react";
import { carregarReplayCliente } from "@/lib/replay-client";
import { aplicarReplay } from "@/lib/replay";
import { criarRoteiro, DURACAO_COMEMORACAO_MS, indiceNoTempo, posicaoTimelapse } from "@/lib/timelapse";
import { fmtInt, fmtPct } from "@/lib/format";
import { scopeName, type Scope } from "@/lib/ufs";
import type { ApuracaoResponse, Candidato, ReplayResponse } from "@/lib/types";
import MapaTimelapse from "./MapaTimelapse";
import type {EventoVitoria} from "./AvisoVitoria";
import styles from "./Apresentacao.module.css";

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
    <section aria-label="Timelapse da apuração" data-decorrido-ms={Math.floor(decorrido)} className={styles.filme}>
      <div className={styles.resumo}>
        <CandidatoCompacto candidato={nacional.candidatos.find(c=>c.numero==="13")} />
        <div className={styles.marco}>
          <h2 aria-live="polite">{marco?.titulo}</h2>
          <p>{hora.format(new Date(dados.pontos[indice].t))} em Brasília · {fmtPct(nacional.pctTotalizado)} das urnas</p>
          <output className="tabular">{Math.floor(restante/60)}:{String(restante%60).padStart(2,"0")} restantes</output>
        </div>
        <CandidatoCompacto candidato={nacional.candidatos.find(c=>c.numero==="22")} direita />
      </div>

      <div className={styles.controles} aria-label="Controles do timelapse">
        <button type="button" disabled={carregando} onClick={onAlternar}>{carregando ? "Preparando…" : pausado ? decorrido>=90000 ? "↻ Recomeçar" : "▶ Continuar" : "⏸ Pausar"}</button>
        <button type="button" disabled={carregando} onClick={()=>onPosicionar(decorrido-10000)}>↶ 10s</button>
        <button type="button" disabled={carregando} onClick={()=>onPosicionar(decorrido+10000)}>10s ↷</button>
        <input type="range" disabled={carregando} min={0} max={90} step={0.25} value={decorrido/1000} onChange={e=>onPosicionar(Number(e.target.value)*1000)} aria-label="Posição do timelapse" aria-valuetext={`${Math.floor(decorrido/1000)} de 90 segundos`}/>
        <span className="tabular">{Math.floor(decorrido/1000)}s / 90s</span>
      </div>
      <p className={styles.nota}>A música continua durante a pausa.</p>

      <MapaTimelapse apuracao={atual!} scope={scope} onSelect={setScope} pausado={pausado} revisaoNavegacao={vitoria.revisaoNavegacao??0} />

      <details className={styles.detalhes}>
        <summary>Marcos da apuração e fonte dos dados</summary>
      <ol aria-label="Marcos da apuração">
        {roteiro.marcos.map((m,i)=><li key={`${m.tipo}-${m.indice}`} aria-current={m===marco ? "step" : undefined} className={m.indice <= indice ? "text-[#FFDF00]" : "text-white/45"}>
          <span className="block font-bold">{i+1}. {m.titulo}</span><span>{hora.format(new Date(dados.pontos[m.indice].t))}</span>
        </li>)}
      </ol>
      <p>Snapshots gravados do TSE; UFs podem ter horários diferentes. A garantia matemática é uma conta deste site; o selo oficial só aparece no resultado final. {scope !== "br" && `Seleção: ${scopeName(scope)}.`}</p>
      </details>
      <div className="fixed inset-x-0 bottom-0 h-1.5 bg-white/10"><div className="h-full bg-[#FFDF00]" style={{width:`${100-decorrido/DURACAO_COMEMORACAO_MS*100}%`}}/></div>
    </section>
  );
}

function CandidatoCompacto({candidato:c,direita=false}:{candidato?:Candidato;direita?:boolean}) {
  if (!c) return null;
  return <div className={styles.candidato} data-direita={direita}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={c.foto} alt="" />
    <div><p title={c.nome}>{c.nome}</p><strong className="tabular">{fmtPct(c.pct)}</strong><span className="tabular">{fmtInt(c.votos)} votos</span></div>
  </div>;
}
