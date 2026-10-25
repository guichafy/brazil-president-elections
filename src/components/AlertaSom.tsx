"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AnimacaoHumor from "./AnimacaoHumor";
import { AnimacaoLula, type EventoVitoria } from "./AvisoVitoria";
import { avaliarHumor, LULA, lulaVenceu, type EventoHumor, type Variacao } from "@/lib/humor";
import { arpejoFeliz, audioLiberado, desbloquearAudio, pararSom, somFeliz, somTriste, somVitoria } from "@/lib/sons";
import type { ResultadoAbrangencia } from "@/lib/types";

const AVISO_MS = 15_000; // sem som; com som, o aviso dura o mesmo que o áudio sorteado
// depois de um aviso, as viradas seguintes dentro deste intervalo são descartadas (sem aviso nem áudio)
const INTERVALO_AVISOS_MS = 5 * 60_000;
const VITORIA_MS = 30_000; // comemoração sem som (com som, dura o mesmo que o áudio)

/**
 * Compara cada totalização nacional nova com a anterior e toca o som correspondente.
 * Com `pausado` (ex.: tutorial aberto), segura o som e o aviso dos eventos que chegarem.
 * Avisa no máximo uma vez a cada 5 minutos: nada fica na fila para depois.
 * A vitória do Lula fura esse intervalo, comemora uma vez só (a pausa só adia) e encerra os avisos de sobe e desce.
 */
export function useAlertaSom(pausado = false) {
  // ligado por padrão; o navegador só libera o áudio no 1º gesto do usuário na página
  const [ativo, setAtivo] = useState(true);
  const [liberado, setLiberado] = useState(false);
  const [evento, setEvento] = useState<EventoAviso | null>(null);
  const [vitoria, setVitoria] = useState<EventoVitoria | null>(null);
  const comemorou = useRef(false);
  const anterior = useRef<ResultadoAbrangencia | null>(null);
  const ultimoAviso = useRef(-Infinity);
  const ativoRef = useRef(true);
  const pausadoRef = useRef(pausado);
  useEffect(() => {
    pausadoRef.current = pausado;
  });

  // qualquer clique, toque ou tecla na página libera o áudio
  useEffect(() => {
    if (liberado) return;
    const liberar = async () => {
      if (await desbloquearAudio()) setLiberado(true);
    };
    const eventos = ["pointerdown", "keydown", "touchend"] as const;
    eventos.forEach((e) => window.addEventListener(e, liberar));
    return () => eventos.forEach((e) => window.removeEventListener(e, liberar));
  }, [liberado]);

  const comemorar = useCallback((nacional: ResultadoAbrangencia | null, teste = false) => {
    const lula = nacional?.candidatos.find((c) => c.numero === LULA);
    pararSom();
    setEvento(null);
    const id = Date.now();
    const mostrar = (duracao: number | null) =>
      setVitoria({
        id,
        duracaoMs: duracao ? duracao * 1000 : VITORIA_MS,
        eleito: !!lula?.eleito,
        pct: lula?.pct ?? 50.6,
        votos: lula?.votos ?? 0,
        teste,
        // som ligado mas ainda bloqueado pelo navegador (ninguém tocou na página)
        semSom: ativoRef.current && !duracao,
      });
    if (ativoRef.current) somVitoria().then(mostrar);
    else mostrar(null);
  }, []);

  const onNacional = useCallback(
    (nacional: ResultadoAbrangencia | null) => {
      if (!nacional) return;
      const ev = avaliarHumor(anterior.current, nacional);
      anterior.current = nacional;
      if (comemorou.current) return;
      // com o guia aberto, a vitória espera a próxima consulta depois que ele fechar
      if (lulaVenceu(nacional)) {
        if (pausadoRef.current) return;
        comemorou.current = true;
        comemorar(nacional);
        return;
      }
      if (!ev || pausadoRef.current) return;
      const agora = Date.now();
      if (agora - ultimoAviso.current < INTERVALO_AVISOS_MS) return;
      ultimoAviso.current = agora;
      // se a vitória chegar enquanto o áudio carrega, o aviso não abre por baixo da comemoração
      const mostrar = (duracao: number | null) =>
        !comemorou.current && setEvento({ ...ev, id: agora, duracaoMs: duracao ? duracao * 1000 : AVISO_MS });
      // com som, o aviso só abre quando o áudio começa, para os dois terminarem juntos
      if (ativoRef.current) (ev.humor === "feliz" ? somFeliz : somTriste)().then(mostrar);
      else mostrar(null);
    },
    [comemorar],
  );

  const fecharAviso = useCallback(() => {
    pararSom();
    setEvento(null);
  }, []);

  const fecharVitoria = useCallback(() => {
    pararSom();
    setVitoria(null);
  }, []);

  /** Libera o áudio no toque e toca o da vitória, recomeçando a contagem com a duração dele. */
  const ouvirVitoria = useCallback(async () => {
    if (!(await desbloquearAudio())) return;
    setLiberado(true);
    const duracao = await somVitoria();
    if (duracao) setVitoria((v) => v && { ...v, duracaoMs: duracao * 1000, semSom: false });
  }, []);

  /** Mostra a comemoração com os números atuais, sem contar como a de verdade. */
  const testarVitoria = useCallback(() => comemorar(anterior.current, true), [comemorar]);

  /** Liga ou desliga o som; retorna se ficou no estado pedido (ligar depende do navegador liberar o áudio). */
  const definir = useCallback(async (ligar: boolean) => {
    if (ligar && !(await desbloquearAudio())) return false;
    ativoRef.current = ligar;
    setAtivo(ligar);
    setLiberado(audioLiberado());
    return true;
  }, []);

  const alternar = useCallback(async () => {
    const ligar = !ativoRef.current;
    if ((await definir(ligar)) && ligar) arpejoFeliz(); // confirmação curta; os áudios ficam para os eventos
  }, [definir]);

  // some com o aviso quando o áudio termina
  useEffect(() => {
    if (!evento) return;
    const t = setTimeout(fecharAviso, evento.duracaoMs);
    return () => clearTimeout(t);
  }, [evento, fecharAviso]);

  useEffect(() => {
    if (!vitoria) return;
    const t = setTimeout(fecharVitoria, vitoria.duracaoMs);
    return () => clearTimeout(t);
  }, [vitoria, fecharVitoria]);

  return { ativo, liberado, alternar, definir, evento, fecharAviso, onNacional, vitoria, fecharVitoria, ouvirVitoria, testarVitoria };
}

export function BotaoSom({
  ativo,
  liberado,
  alternar,
  testarVitoria,
}: {
  ativo: boolean;
  liberado: boolean;
  alternar: () => void;
  testarVitoria: () => void;
}) {
  // ligado mas ainda bloqueado pelo navegador: o clique (que já libera o áudio) não deve desligar
  const aguardando = ativo && !liberado;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={aguardando ? undefined : alternar}
        aria-pressed={ativo}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${ativo ? "bg-white text-accent" : "bg-white/15 hover:bg-white/25"}`}
        title="Áudio do Lula: Lula sobe e Flávio cai · Áudio do Bolsonaro: Lula cai e Flávio sobe"
      >
        {aguardando ? "🔔 Toque na página para liberar o som" : ativo ? "🔔 Som ligado" : "🔕 Ativar som"}
      </button>
      {ativo && (
        <span className="flex gap-1 text-xs">
          <button type="button" onClick={somFeliz} className="rounded px-1 hover:bg-white/20" title="Testar áudio do Lula">
            🙂
          </button>
          <button type="button" onClick={somTriste} className="rounded px-1 hover:bg-white/20" title="Testar áudio do Bolsonaro">
            🙁
          </button>
          <button type="button" onClick={testarVitoria} className="rounded px-1 hover:bg-white/20" title="Testar comemoração da vitória do Lula">
            🏆
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

type EventoAviso = EventoHumor & { id: number; duracaoMs: number };

interface PropsAviso {
  evento: EventoAviso | null;
  onFechar: () => void;
  corLula: string;
  corFlavio: string;
}

/** Aviso centralizado de quem subiu e quem caiu; cada evento novo reinicia a animação e a contagem. */
export function AvisoHumor({ evento, ...props }: PropsAviso) {
  if (!evento) return null;
  return <Aviso key={evento.id} evento={evento} {...props} />;
}

function Aviso({ evento, onFechar, corLula, corFlavio }: Omit<PropsAviso, "evento"> & { evento: EventoAviso }) {
  const feliz = evento.humor === "feliz";

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div className="aviso-fundo fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onFechar}>
      <div
        role="status"
        onClick={(e) => e.stopPropagation()}
        className="aviso-cartao relative w-[28rem] max-w-full overflow-hidden rounded-2xl border border-border bg-surface text-sm shadow-2xl"
      >
        <button
          type="button"
          onClick={onFechar}
          className="absolute top-3 right-3 rounded px-1.5 text-muted hover:text-foreground"
          aria-label="Fechar aviso"
        >
          ✕
        </button>
        <div className="flex flex-col items-center px-5 pt-5 pb-4">
          {/* Lula subindo reaproveita o Lula da comemoração da vitória; caindo, ficam as setas */}
          {feliz ? (
            <AnimacaoLula cor={corLula} className="w-44" />
          ) : (
            <AnimacaoHumor corLula={corLula} corFlavio={corFlavio} lulaSobe={false} />
          )}
          <div className="mt-1 text-center text-xl font-bold">
            {feliz ? "🎉 Lula subindo, Flávio caindo" : "😢 Lula caindo, Flávio subindo"}
          </div>
          <div className="mb-4 text-xs text-muted">Atualização das {evento.dataHora.slice(11, 16)}</div>
          <div className="w-full space-y-1 rounded-lg bg-track/60 px-3 py-2">
            <Linha v={evento.lula} cor={corLula} />
            <Linha v={evento.flavio} cor={corFlavio} />
          </div>
        </div>
        {/* contagem até o aviso sumir sozinho */}
        <div className="h-1 bg-track">
          <div
            className="h-full origin-left"
            style={{ background: feliz ? corLula : corFlavio, animation: `aviso-contagem ${evento.duracaoMs}ms linear forwards` }}
          />
        </div>
      </div>
    </div>
  );
}
