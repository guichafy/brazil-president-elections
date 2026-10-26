"use client";

import { useEffect, useState } from "react";
import { carregarReplayCliente } from "@/lib/replay-client";
import { fmtPct } from "@/lib/format";
import { indicePorPercentual } from "@/lib/replay";
import type { ReplayResponse } from "@/lib/types";
import type { Scope } from "@/lib/ufs";
import {useReplayPlayer} from "./useReplayPlayer";

const formato = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

export default function ReplayControls({ indice, scope, onChange,bloqueado=false,somAtivo=true }: {
  indice: number | null;
  scope: Scope;
  onChange: (dados: ReplayResponse, indice: number) => void;
  bloqueado?:boolean;
  somAtivo?:boolean;
}) {
  const [dados, setDados] = useState<ReplayResponse | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const player=useReplayPlayer(dados,indice,onChange,bloqueado,somAtivo);
  useEffect(() => {
    let cancelado = false;
    carregarReplayCliente()
      .then(json => { if (!cancelado) { setDados(json); setErro(false); } })
      .catch(() => { if (!cancelado) setErro(true); });
    return () => { cancelado = true; };
  }, [tentativa]);

  const max = dados ? dados.pontos.length - 1 : 0;
  const valor = indice ?? max;
  const ponto = dados?.pontos[valor];
  const snapshotIndex = ponto?.indices[scope];
  const snapshot = snapshotIndex === undefined ? null : dados!.snapshots[snapshotIndex];
  const final = valor === max;
  const percentual = final ? 100 : snapshot?.ts ? (snapshot.st / snapshot.ts) * 100 : 0;
  const descricao = ponto ? `${formato.format(new Date(final ? ponto.t : snapshot?.isoDataHora ?? ponto.t))} · ${fmtPct(percentual)} apurado` : "Resultado final";
  const selecionar = (i: number) => { player.parar();if (dados) onChange(dados, Math.max(0, Math.min(max, i))); };

  return (
    <div className="mt-1" aria-label="Reprodução da apuração">
      <input
        type="range" min={0} max={100} step="any" value={percentual} disabled={!dados}
        aria-label="Momento da apuração" aria-valuetext={descricao}
        title="Arraste a barra de apuração para movimentar a timeline"
        onChange={(e) => { if (dados) selecionar(indicePorPercentual(dados, Number(e.target.value), scope)); }}
        onKeyDown={(e) => {
          const destino = { ArrowLeft: valor - 1, ArrowDown: valor - 1, ArrowRight: valor + 1, ArrowUp: valor + 1, Home: 0, End: max, PageDown: valor - 10, PageUp: valor + 10 }[e.key];
          if (destino !== undefined) { e.preventDefault(); selecionar(destino); }
        }}
        className="h-7 w-full cursor-pointer accent-[var(--accent)] disabled:cursor-wait"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <button type="button" disabled={!dados||bloqueado} onClick={()=>void player.alternar()} className="rounded-full bg-accent px-4 py-2 font-semibold text-white disabled:opacity-40">{player.tocando ? "⏸ Pausar replay" : "▶ Play da apuração"}</button>
        <output className="tabular" aria-live="polite">{!dados ? "Carregando histórico…" : final ? "Arraste a barra de apuração para movimentar a timeline" : `Histórico · ${descricao}`}</output>
        {!final && <button type="button" onClick={() => selecionar(max)} className="font-semibold text-accent hover:underline">Voltar ao resultado final</button>}
      </div>
      {player.tocando&&<p className="mt-1 text-[11px] text-muted">{player.preparando ? "Preparando áudio…" : somAtivo ? "Reprodução automática: os áudios dos candidatos tocam por inteiro nas viradas." : "Reprodução automática sem som."}</p>}
      {!final && <p className="mt-1 text-[11px] text-muted">Retratos dos ciclos gravados; o horário de cada UF pode variar. A abstenção não foi registrada.</p>}
      {erro && <p role="alert" className="mt-1 text-xs text-accent">Não foi possível carregar o histórico. <button type="button" className="font-semibold underline" onClick={() => setTentativa((n) => n + 1)}>Tentar novamente</button></p>}
    </div>
  );
}
