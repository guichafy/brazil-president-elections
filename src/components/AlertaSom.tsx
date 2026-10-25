"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { avaliarHumor, type EventoHumor, type Variacao } from "@/lib/humor";
import { desbloquearAudio, somFeliz, somTriste } from "@/lib/sons";
import type { ResultadoAbrangencia } from "@/lib/types";

const AVISO_MS = 20_000;

/** Compara cada totalização nacional nova com a anterior e toca o som correspondente. */
export function useAlertaSom() {
  const [ativo, setAtivo] = useState(false);
  const [evento, setEvento] = useState<(EventoHumor & { id: number }) | null>(null);
  const anterior = useRef<ResultadoAbrangencia | null>(null);
  const ativoRef = useRef(false);

  const onNacional = useCallback((nacional: ResultadoAbrangencia | null) => {
    if (!nacional) return;
    const ev = avaliarHumor(anterior.current, nacional);
    anterior.current = nacional;
    if (!ev) return;
    setEvento({ ...ev, id: Date.now() });
    if (ativoRef.current) (ev.humor === "feliz" ? somFeliz : somTriste)();
  }, []);

  const alternar = useCallback(async () => {
    const ligar = !ativoRef.current;
    if (ligar && !(await desbloquearAudio())) return;
    ativoRef.current = ligar;
    setAtivo(ligar);
    if (ligar) somFeliz();
  }, []);

  // some com o aviso depois de alguns segundos
  useEffect(() => {
    if (!evento) return;
    const t = setTimeout(() => setEvento(null), AVISO_MS);
    return () => clearTimeout(t);
  }, [evento]);

  return { ativo, alternar, evento, fecharAviso: () => setEvento(null), onNacional };
}

export function BotaoSom({ ativo, alternar }: { ativo: boolean; alternar: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={alternar}
        aria-pressed={ativo}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${ativo ? "bg-white text-accent" : "bg-white/15 hover:bg-white/25"}`}
        title="Som feliz: Lula sobe e Flávio cai · Som triste: Lula cai e Flávio sobe"
      >
        {ativo ? "🔔 Som ligado" : "🔕 Ativar som"}
      </button>
      {ativo && (
        <span className="flex gap-1 text-xs">
          <button type="button" onClick={somFeliz} className="rounded px-1 hover:bg-white/20" title="Testar som feliz">
            🙂
          </button>
          <button type="button" onClick={somTriste} className="rounded px-1 hover:bg-white/20" title="Testar som triste">
            🙁
          </button>
        </span>
      )}
    </div>
  );
}

const sinal = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");
const pp = (n: number) =>
  `${sinal(n)}${Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} p.p.`;

function Linha({ v, cor }: { v: Variacao; cor: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: cor }} />
        <span className="truncate">{v.nome}</span>
      </span>
      <span className="shrink-0 whitespace-nowrap tabular">
        <span className="text-muted">{v.pct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</span>{" "}
        <span className="font-semibold">{pp(v.dPct)}</span>
      </span>
    </div>
  );
}

export function AvisoHumor({
  evento,
  onFechar,
  corLula,
  corFlavio,
}: {
  evento: EventoHumor | null;
  onFechar: () => void;
  corLula: string;
  corFlavio: string;
}) {
  if (!evento) return null;
  const feliz = evento.humor === "feliz";
  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-surface text-sm shadow-xl"
    >
      <div className="h-1" style={{ background: feliz ? corLula : corFlavio }} />
      <div className="p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="font-semibold">
            {feliz ? "🎉 Lula subindo, Flávio caindo" : "😢 Lula caindo, Flávio subindo"}
            <div className="text-xs font-normal text-muted">Atualização das {evento.dataHora.slice(11, 16)}</div>
          </div>
          <button type="button" onClick={onFechar} className="text-muted hover:text-foreground" aria-label="Fechar aviso">
            ✕
          </button>
        </div>
        <div className="space-y-1">
          <Linha v={evento.lula} cor={corLula} />
          <Linha v={evento.flavio} cor={corFlavio} />
        </div>
      </div>
    </div>
  );
}
