"use client";

import { useEffect, useRef } from "react";
import { assetPath } from "@/lib/assets";
import { EASE, fixo, rgba, transformacao } from "@/lib/lottie";
import type { ApuracaoResponse } from "@/lib/types";
import TimelapseVitoria from "./TimelapseVitoria";
import styles from "./Apresentacao.module.css";

// Animações da LottieFiles (Lottie Simple License) em public/lottie/:
// confete.json "Confetti - Full Screen" (Rohith R Krishnan) · fogos.json "Fireworks" (Laura Fonseca)
// urna.json "Brazilian Ballot Box" (Felipe Da Silva Pinho) · bandeira.json "flag-br" (Cecília)

type Lottie = typeof import("lottie-web/build/player/lottie_light").default;
type Opcoes = Omit<Parameters<Lottie["loadAnimation"]>[0], "container">;
type Animacao = ReturnType<Lottie["loadAnimation"]>;

/**
 * Toca uma animação Lottie no container; com movimento reduzido, mostra o `quadroParado`.
 * `iniciar` substitui o autoplay (ex.: tocar a entrada uma vez e repetir só a volta).
 */
function useLottie(
  ref: React.RefObject<HTMLDivElement | null>,
  opcoes: () => Opcoes,
  { quadroParado = 0, iniciar, deps = [] }: { quadroParado?: number; iniciar?: (a: Animacao) => void; deps?: unknown[] } = {},
) {
  useEffect(() => {
    let anim: Animacao | undefined;
    let cancelado = false;
    import("lottie-web/build/player/lottie_light").then(({ default: lottie }) => {
      if (cancelado || !ref.current) return;
      const parado = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const a = lottie.loadAnimation({
        container: ref.current,
        renderer: "svg",
        ...opcoes(),
        ...((parado || iniciar) && { autoplay: false }),
      });
      if (parado) a.goToAndStop(quadroParado, true);
      else iniciar?.(a);
      anim = a;
    });
    return () => {
      cancelado = true;
      anim?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function Arquivo({ src, className, cobrir = false }: { src: string; className: string; cobrir?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLottie(
    ref,
    () => ({
      path: assetPath(src),
      loop: true,
      autoplay: true,
      rendererSettings: { preserveAspectRatio: cobrir ? "xMidYMid slice" : "xMidYMid meet" },
    }),
    { quadroParado: 30, deps: [src, cobrir] },
  );
  return <div ref={ref} aria-hidden className={className} />;
}

// composição do Lula: 420×460, 60 fps; entra crescendo em 0,6 s e depois balança em voltas de 2 s
const W = 420;
const H = 460;
const ENTRADA = 36;
const FIM = ENTRADA + 120;
const CX = W / 2;
const CY = 250;
const FOTO = { w: 532, h: 720, escala: 52 }; // public/imagens/lula.png
const AMARELO = "#FFDF00";
const LINEAR = { i: { x: [1], y: [1] }, o: { x: [0], y: [0] } };

const chaves = <T,>(pares: [number, T][], ease: object = EASE) => ({
  a: 1,
  k: pares.map(([t, s], n) => (n < pares.length - 1 ? { t, s, ...ease } : { t, s })),
});

function camada(ind: number, extra: Record<string, unknown>, ks: Record<string, unknown>) {
  return {
    ddd: 0,
    ind,
    sr: 1,
    ao: 0,
    ip: 0,
    op: FIM,
    st: 0,
    bo: 0,
    ...extra,
    ks: { o: fixo(100), r: fixo(0), a: fixo([0, 0, 0]), p: fixo([CX, CY, 0]), s: fixo([100, 100, 100]), ...ks },
  };
}

const preenchimento = (cor: string, opacidade = 100) => ({ ty: "fl", c: fixo(rgba(cor)), o: fixo(opacidade), r: 1 });
const zeros = (n: number) => Array.from({ length: n }, (): [number, number] => [0, 0]);
// 12 raios: girar 30° volta ao mesmo desenho, então a volta emenda sem salto
const RAIO: [number, number][] = [[-7, -70], [7, -70], [46, -235], [-46, -235]];
const raios = Array.from({ length: 12 }, (_, i) => ({
  ty: "gr",
  it: [
    { ty: "sh", ks: fixo({ c: true, v: RAIO.map(([x, y]) => [x, y]), i: zeros(4), o: zeros(4) }) },
    preenchimento(AMARELO, 30),
    { ...transformacao(), r: fixo(i * 30) },
  ],
}));
const s3 = (v: number) => [v, v, 100];

function animacaoLula(cor: string) {
  // pulo na entrada (0 → 112% → 100%) e respiração leve na volta
  const escalaFoto = chaves([
    [0, s3(0)],
    [24, s3(FOTO.escala * 1.12)],
    [ENTRADA, s3(FOTO.escala)],
    [ENTRADA + 30, s3(FOTO.escala * 1.04)],
    [ENTRADA + 60, s3(FOTO.escala)],
    [ENTRADA + 90, s3(FOTO.escala * 1.04)],
    [FIM, s3(FOTO.escala)],
  ]);
  const balanco = chaves([[0, [-18]], [ENTRADA, [0]], [ENTRADA + 30, [4]], [ENTRADA + 60, [0]], [ENTRADA + 90, [-4]], [FIM, [0]]]);
  const pulo = chaves([
    [0, [CX, CY, 0]],
    [ENTRADA, [CX, CY, 0]],
    [ENTRADA + 30, [CX, CY - 12, 0]],
    [ENTRADA + 60, [CX, CY, 0]],
    [ENTRADA + 90, [CX, CY - 12, 0]],
    [FIM, [CX, CY, 0]],
  ]);
  return {
    v: "5.12.2",
    fr: 60,
    ip: 0,
    op: FIM,
    w: W,
    h: H,
    nm: "vitória do Lula",
    ddd: 0,
    assets: [{ id: "lula", w: FOTO.w, h: FOTO.h, u: assetPath("/imagens/"), p: "lula.png", e: 0 }],
    layers: [
      camada(1, { ty: 2, refId: "lula" }, { a: fixo([FOTO.w / 2, FOTO.h / 2, 0]), p: pulo, s: escalaFoto, r: balanco }),
      // halo na cor do partido, pulsando junto com a respiração
      camada(2, { ty: 4, shapes: [{ ty: "gr", it: [{ ty: "el", d: 1, p: fixo([0, 0]), s: fixo([330, 330]) }, preenchimento(cor, 55), transformacao()] }] }, {
        s: chaves([[0, s3(0)], [ENTRADA, s3(100)], [ENTRADA + 30, s3(106)], [ENTRADA + 60, s3(100)], [ENTRADA + 90, s3(106)], [FIM, s3(100)]]),
      }),
      // raios de sol girando atrás de tudo
      camada(3, { ty: 4, shapes: raios }, {
        r: chaves([[0, [-9]], [FIM, [30]]], LINEAR),
        s: chaves([[0, s3(0)], [30, s3(100)]]),
      }),
    ],
  };
}

/** Lula entrando com pulo e depois balançando; também usado no aviso de Lula subindo. */
export function AnimacaoLula({ cor, className = "w-[min(78vw,340px)]" }: { cor: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLottie(ref, () => ({ animationData: animacaoLula(cor), loop: true }), {
    quadroParado: ENTRADA,
    // a entrada toca uma vez; com loop, o lottie repete só o último trecho (a volta de 2 s)
    iniciar: (a) => a.playSegments([[0, ENTRADA], [ENTRADA, FIM]], true),
    deps: [cor],
  });
  return <div ref={ref} aria-hidden className={`aspect-[420/460] ${className}`} />;
}

export interface EventoVitoria {
  id: number;
  duracaoMs: number;
  iniciadoEm: number | null;
  posicaoMs:number;
  pausado:boolean;
  aguardandoInicio?:boolean;
  preparando?:boolean;
  erroAudio?:string;
  revisaoNavegacao?:number;
  eleito: boolean; // TSE já declarou; senão, vitória garantida pela conta
  pct: number;
  votos: number;
  teste?: boolean;
  semSom?: boolean;
}

interface Props {
  vitoria: EventoVitoria | null;
  onFechar: () => void;
  onOuvir: () => void;
  corLula: string;
  resultadoFinal: ApuracaoResponse;
  onAlternar:()=>void;
  onPosicionar:(ms:number)=>void;
}

/** Apresentação de 90s, com trilha contínua iniciada no Play. */
export default function AvisoVitoria({ vitoria, ...props }: Props) {
  if (!vitoria) return null;
  return <Comemoracao key={vitoria.id} vitoria={vitoria} {...props} />;
}

function Comemoracao({ vitoria, onFechar, onOuvir, corLula, resultadoFinal,onAlternar,onPosicionar }: Omit<Props, "vitoria"> & { vitoria: EventoVitoria }) {
  const dialog = useRef<HTMLDivElement>(null);
  const venceuSegundoTurno = resultadoFinal.nacional?.turno === "2" && (vitoria.eleito || resultadoFinal.nacional.decisao.lider === "13");
  useEffect(() => {
    const anterior = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
      if (e.key !== "Tab") return;
      const controles = dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), select, input:not(:disabled), a[href], [tabindex='0']");
      if (!controles?.length) return;
      const primeiro = controles[0], ultimo = controles[controles.length - 1];
      if (e.shiftKey && (document.activeElement === primeiro || document.activeElement === dialog.current)) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflow;
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, [onFechar]);
  useEffect(() => { dialog.current?.focus(); }, [vitoria.aguardandoInicio]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      ref={dialog}
      tabIndex={-1}
      aria-label={venceuSegundoTurno ? "Lula venceu a eleição" : "Demonstração do timelapse da apuração"}
      className={styles.dialogo}
    >
      {!vitoria.aguardandoInicio && <>
        <div className={styles.festa} aria-hidden="true">
          <Arquivo src="/lottie/confete.json" cobrir className="pointer-events-none absolute inset-0" />
          <Arquivo src="/lottie/fogos.json" className="pointer-events-none absolute top-[3%] left-[2%] size-40 sm:size-64" />
          <Arquivo src="/lottie/fogos.json" className="pointer-events-none absolute top-[12%] right-[2%] size-32 sm:size-56" />
        </div>
      </>}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onFechar();
        }}
        className="fixed top-3 right-3 z-20 rounded-full bg-[#032710] px-3 py-2 text-white hover:bg-black focus-visible:outline-2 focus-visible:outline-[#FFDF00]"
        aria-label="Fechar comemoração"
      >
        ✕
      </button>

      {vitoria.aguardandoInicio ? (
        <div className="relative mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-6 py-20 text-center">
          <p className="text-sm text-white/65">Eleições 2026 · {resultadoFinal.nacional?.turno}º turno</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-balance text-[#FFDF00] sm:text-5xl">Reviva a apuração em 90 segundos</h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/80">Acompanhe a disputa em cada estado, <span className="whitespace-nowrap">ao som da música da vitória.</span></p>
          <button type="button" onClick={onOuvir} disabled={vitoria.preparando} aria-busy={vitoria.preparando} className="group mt-9 flex flex-col items-center gap-4 rounded-2xl p-4 font-bold text-[#FFDF00] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            <span className="grid size-24 place-items-center rounded-full bg-[#FFDF00] text-[#07401d] transition-transform group-hover:scale-105 motion-reduce:transition-none sm:size-28">
              <svg viewBox="0 0 32 32" className="ml-1 size-10" aria-hidden="true"><path d="M10 5 L27 16 L10 27 Z" fill="currentColor" /></svg>
            </span>
            <span className="text-lg">{vitoria.preparando ? "Preparando música e apuração…" : vitoria.erroAudio ? "Tentar iniciar com música" : "Iniciar com música"}</span>
          </button>
          {vitoria.erroAudio && <p role="alert" className="mt-3 max-w-sm text-sm text-[#ffcfb6]">{vitoria.erroAudio}</p>}
          <p role="status" className="mt-5 text-xs text-white/60">{vitoria.preparando ? "A contagem começa quando tudo estiver pronto." : "Ative o volume. Você pode pausar e explorar os estados durante a reprodução."}</p>
          <button type="button" onClick={onFechar} disabled={vitoria.preparando} className="mt-8 rounded px-3 py-2 text-sm text-white/65 underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-white">Explorar o resultado final</button>
        </div>
      ) : <div className={styles.apresentacao}>
        <header className={styles.cabecalho}>
          <AnimacaoLula cor={corLula} className={styles.lula} />
          <div>
            {vitoria.teste && <p className="text-xs text-white/65">Reprodução da comemoração</p>}
            <h1>Cada estado. Cada virada.</h1>
            <p>Resultado final: {vitoria.pct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% · {vitoria.votos.toLocaleString("pt-BR")} votos{venceuSegundoTurno && vitoria.eleito ? " · eleito pelo TSE" : ""}</p>
          </div>
            <button type="button" onClick={onOuvir} className={styles.reiniciar}>
              {vitoria.semSom ? "🔊 Ouvir e reiniciar os 90 segundos" : "↻ Reiniciar com áudio"}
            </button>
        </header>
        <TimelapseVitoria resultadoFinal={resultadoFinal} vitoria={vitoria} onTentar={onOuvir} onAlternar={onAlternar} onPosicionar={onPosicionar}/>
      </div>}

    </div>
  );
}
