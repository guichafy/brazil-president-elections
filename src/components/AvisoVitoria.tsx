"use client";

import { useEffect, useRef } from "react";
import { EASE, fixo, rgba, transformacao } from "@/lib/lottie";

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
      path: src,
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
    assets: [{ id: "lula", w: FOTO.w, h: FOTO.h, u: "/imagens/", p: "lula.png", e: 0 }],
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

function AnimacaoLula({ cor }: { cor: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLottie(ref, () => ({ animationData: animacaoLula(cor), loop: true }), {
    quadroParado: ENTRADA,
    // a entrada toca uma vez; com loop, o lottie repete só o último trecho (a volta de 2 s)
    iniciar: (a) => a.playSegments([[0, ENTRADA], [ENTRADA, FIM]], true),
    deps: [cor],
  });
  return <div ref={ref} aria-hidden className="aspect-[420/460] w-[min(78vw,340px)]" />;
}

export interface EventoVitoria {
  id: number;
  duracaoMs: number;
  eleito: boolean; // TSE já declarou; senão, vitória garantida pela conta
  pct: number;
  votos: number;
  teste?: boolean;
  semSom?: boolean; // o navegador bloqueou o áudio: o 1º toque libera e toca, em vez de fechar
}

interface Props {
  vitoria: EventoVitoria | null;
  onFechar: () => void;
  onOuvir: () => void;
  corLula: string;
}

/** Comemoração em tela cheia da vitória do Lula; dura o mesmo que o áudio. */
export default function AvisoVitoria({ vitoria, ...props }: Props) {
  if (!vitoria) return null;
  return <Comemoracao key={vitoria.id} vitoria={vitoria} {...props} />;
}

function Comemoracao({ vitoria, onFechar, onOuvir, corLula }: Omit<Props, "vitoria"> & { vitoria: EventoVitoria }) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div
      role="dialog"
      aria-label="Lula venceu a eleição"
      onClick={vitoria.semSom ? onOuvir : onFechar}
      className="aviso-fundo fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_40%,#0f7a38_0%,#07401d_55%,#021509_100%)] text-white"
    >
      <Arquivo src="/lottie/confete.json" cobrir className="pointer-events-none absolute inset-0" />
      <Arquivo src="/lottie/fogos.json" className="pointer-events-none absolute top-[3%] left-[2%] size-40 sm:size-64" />
      <Arquivo src="/lottie/fogos.json" className="pointer-events-none absolute top-[12%] right-[2%] size-32 sm:size-56" />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onFechar();
        }}
        className="absolute top-4 right-4 z-10 rounded px-2 py-1 text-white/70 hover:text-white"
        aria-label="Fechar comemoração"
      >
        ✕
      </button>

      <div className="aviso-cartao relative flex max-w-full flex-col items-center px-4 text-center">
        {vitoria.teste && <div className="mb-1 rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold">Teste da comemoração</div>}
        <AnimacaoLula cor={corLula} />
        <div className="text-4xl font-black tracking-tight drop-shadow-lg sm:text-6xl" style={{ color: "#FFDF00" }}>
          {vitoria.eleito ? "LULA ELEITO!" : "LULA VENCEU!"}
        </div>
        <div className="mt-2 text-base font-semibold sm:text-lg">
          {vitoria.pct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% dos votos válidos ·{" "}
          <span className="whitespace-nowrap">{vitoria.votos.toLocaleString("pt-BR")} votos</span>
        </div>
        <div className="text-xs text-white/70">
          {vitoria.eleito ? "Resultado declarado pelo TSE" : "Vitória matematicamente garantida: a vantagem supera o eleitorado que falta"}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Arquivo src="/lottie/urna.json" className="size-20 sm:size-24" />
          <span className="text-2xl font-black sm:text-3xl">Faz o L!</span>
          <Arquivo src="/lottie/bandeira.json" className="size-20 sm:size-24" />
        </div>
        {vitoria.semSom && (
          <div className="mt-4 animate-pulse rounded-full bg-white px-4 py-1.5 text-sm font-bold text-[#07401d]">🔊 Toque para ouvir</div>
        )}
      </div>

      {/* contagem até a comemoração sumir sozinha */}
      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/10">
        <div key={String(vitoria.semSom)} className="h-full origin-left" style={{ background: "#FFDF00", animation: `aviso-contagem ${vitoria.duracaoMs}ms linear forwards` }} />
      </div>
    </div>
  );
}
