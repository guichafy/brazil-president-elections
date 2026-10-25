"use client";

import { useEffect, useRef, useState } from "react";
import { fmtInt } from "@/lib/format";
import { fixo, rgba } from "@/lib/lottie";
import type { Candidato } from "@/lib/types";

// Centro do placar: diferença de votos agora e para onde a tendência aponta.
// O desenho dos ícones vem do Lucide (https://lucide.dev, licença ISC): "trending-up" quando há para onde
// apontar, "arrow-left-right" quando ainda não há. O movimento é montado aqui, em Lottie.

export type Rumo = { cor: string; esquerda: boolean } | null;

// composição: 120×80, 60 fps; ícone de 24 unidades ampliado 2,4× no centro
const W = 120;
const H = 80;
const FR = 60;
const INTRO = 80; // desenho do ícone, toca uma vez
const FIM = 200; // de INTRO a FIM é a volta ociosa, que se repete
const ESCALA = 240;
const NEUTRO = "#8a909c"; // legível no tema claro e no escuro

type Ponto = [number, number];
type Ease = { i: { x: number[]; y: number[] }; o: { x: number[]; y: number[] } };
const SUAVE: Ease = { i: { x: [0.2], y: [1] }, o: { x: [0.4], y: [0] } };
// "back out": passa um pouco do ponto e volta, como as animações do Airbnb
const MOLA: Ease = { i: { x: [0.64], y: [1] }, o: { x: [0.34], y: [1.56] } };

const chaves = <T,>(pares: [number, T][], ease: Ease = SUAVE) => ({
  a: 1,
  k: pares.map(([t, s], n) => (n < pares.length - 1 ? { t, s, ...ease } : { t, s })),
});

// arrays sempre novos: o lottie altera vértices e tangentes no lugar ao carregar
const linha = (pts: Ponto[]) => ({
  ty: "sh",
  ks: fixo({ c: false, v: pts.map(([x, y]) => [x, y]), i: pts.map(() => [0, 0]), o: pts.map(() => [0, 0]) }),
});
const traco = (cor: string) => ({ ty: "st", c: fixo(rgba(cor)), o: fixo(100), w: fixo(2), lc: 2, lj: 2, ml: 4 });
const preenchimento = (cor: string, o: unknown = fixo(100)) => ({ ty: "fl", c: fixo(rgba(cor)), o, r: 1 });
const corte = (s: unknown, e: unknown) => ({ ty: "tm", s, e, o: fixo(0), m: 1 });
const tr = (p: unknown = fixo([0, 0]), s: unknown = fixo([100, 100]), o: unknown = fixo(100)) => ({
  ty: "tr",
  p,
  a: fixo([0, 0]),
  s,
  r: fixo(0),
  o,
  sk: fixo(0),
  sa: fixo(0),
});
const grupo = (...it: unknown[]) => ({ ty: "gr", it });

function camada(ind: number, shapes: unknown[], ks: Record<string, unknown> = {}) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    sr: 1,
    ao: 0,
    ip: 0,
    op: FIM,
    st: 0,
    bo: 0,
    ks: { o: fixo(100), r: fixo(0), a: fixo([12, 12, 0]), p: fixo([W / 2, H / 2, 0]), s: fixo([ESCALA, ESCALA, 100]), ...ks },
    shapes,
  };
}

// com ponta arredondada, um traço de comprimento zero vira um ponto: o grupo só aparece quando o traço começa
const surgeEm = (t: number) => tr(fixo([0, 0]), fixo([100, 100]), chaves([[t, [0]], [t + 2, [100]]]));
// traço que se desenha do início ao fim do caminho
const desenha = (de: number, ate: number) => corte(fixo(0), chaves([[de, [0]], [ate, [100]]]));
// traço que nasce do meio do caminho para as pontas (a ponta da seta abre a partir do vértice)
const abre = (de: number, ate: number) =>
  corte(chaves([[de, [50]], [ate, [0]]], MOLA), chaves([[de, [50]], [ate, [100]]], MOLA));

/** Halo atrás do ícone: surge com mola e depois "respira". */
function halo(ind: number, cor: string) {
  return camada(ind, [grupo({ ty: "el", d: 1, p: fixo([12, 12]), s: fixo([30, 30]) }, preenchimento(cor, fixo(14)), tr())], {
    s: {
      a: 1,
      k: [
        { t: 0, s: [0, 0, 100], ...MOLA },
        { t: 30, s: [ESCALA, ESCALA, 100], ...SUAVE },
        { t: INTRO, s: [ESCALA, ESCALA, 100], ...SUAVE },
        { t: (INTRO + FIM) / 2, s: [ESCALA * 1.08, ESCALA * 1.08, 100], ...SUAVE },
        { t: FIM, s: [ESCALA, ESCALA, 100] },
      ],
    },
  });
}

/** Faíscas saindo da ponta da seta, no fim do desenho e de novo no meio de cada volta ociosa. */
function faiscas(ind: number, cor: string, ponta: Ponto) {
  const estouro = (t0: number, alcance: number, pico: number) =>
    [0, 1, 2, 3, 4, 5].map((n) => {
      const ang = ((n * 60 - 45) * Math.PI) / 180;
      const fim: Ponto = [ponta[0] + Math.cos(ang) * alcance, ponta[1] + Math.sin(ang) * alcance];
      return grupo(
        { ty: "el", d: 1, p: fixo([0, 0]), s: fixo([1.6, 1.6]) },
        preenchimento(cor),
        tr(
          chaves([[t0, ponta], [t0 + 30, fim]]),
          chaves([[t0, [100, 100]], [t0 + 30, [30, 30]]]),
          chaves([[0, [0]], [t0, [0]], [t0 + 4, [pico]], [t0 + 30, [0]]]),
        ),
      );
    });
  return [camada(ind, estouro(42, 7, 100)), camada(ind + 1, estouro(INTRO + 50, 5, 60))];
}

/** Lucide "trending-up": a linha se desenha, a ponta abre com mola e dá um tranco na direção do movimento. */
function tendencia(cor: string) {
  const empurra = (dx: number, dy: number) =>
    chaves<number[]>([
      [INTRO, [12, 12, 0]],
      [INTRO + 25, [12 - dx, 12 - dy, 0]],
      [INTRO + 50, [12, 12, 0]],
    ]);
  return [
    camada(1, [grupo(linha([[2, 17], [8.5, 10.5], [13.5, 15.5], [22, 7]]), desenha(0, 40), traco(cor), surgeEm(1))]),
    camada(2, [grupo(linha([[16, 7], [22, 7], [22, 13]]), abre(28, 52), traco(cor), surgeEm(29))], { a: empurra(1, -1) }),
    ...faiscas(3, cor, [22, 7]),
    halo(5, cor),
  ];
}

/** Lucide "arrow-left-right": as duas setas se desenham e depois balançam alternadas, como uma gangorra. */
function indefinido() {
  const balanca = (dx: number, t0: number) =>
    chaves<number[]>([
      [t0, [12, 12, 0]],
      [t0 + 25, [12 - dx, 12, 0]],
      [t0 + 50, [12, 12, 0]],
    ]);
  const meio = (INTRO + FIM) / 2;
  // cada corte fica no próprio grupo: no lottie ele vale para todos os caminhos acima dele no grupo
  const seta = (haste: Ponto[], ponta: Ponto[], t0: number) => [
    grupo(linha(haste), desenha(t0, t0 + 30), traco(NEUTRO), surgeEm(t0 + 1)),
    grupo(linha(ponta), abre(t0 + 20, t0 + 44), traco(NEUTRO), surgeEm(t0 + 21)),
  ];
  return [
    camada(1, seta([[20, 7], [4, 7]], [[8, 3], [4, 7], [8, 11]], 0), { a: balanca(-1.5, INTRO) }),
    camada(2, seta([[4, 17], [20, 17]], [[16, 13], [20, 17], [16, 21]], 10), { a: balanca(1.5, meio - 10) }),
    halo(3, NEUTRO),
  ];
}

function animacao(rumo: Rumo) {
  const camadas = rumo ? tendencia(rumo.cor) : indefinido();
  // espelhar todas as camadas (inclusive o halo) é só inverter a escala horizontal
  if (rumo?.esquerda)
    for (const c of camadas) {
      const s = c.ks.s as { a: number; k: unknown };
      if (s.a === 0) s.k = [-ESCALA, ESCALA, 100];
      else for (const k of s.k as { s: number[] }[]) k.s = [-k.s[0], k.s[1], k.s[2]];
    }
  return { v: "5.12.2", fr: FR, ip: 0, op: FIM, w: W, h: H, nm: "vantagem", ddd: 0, assets: [], layers: camadas };
}

function Animacao({ rumo }: { rumo: Rumo }) {
  const ref = useRef<HTMLDivElement>(null);
  const cor = rumo?.cor;
  const esquerda = rumo?.esquerda;

  useEffect(() => {
    let anim: { destroy(): void } | undefined;
    let cancelado = false;
    import("lottie-web/build/player/lottie_light").then(({ default: lottie }) => {
      if (cancelado || !ref.current) return;
      const parado = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const a = lottie.loadAnimation({
        container: ref.current,
        renderer: "svg",
        loop: false,
        autoplay: false,
        animationData: animacao(cor === undefined ? null : { cor, esquerda: !!esquerda }),
      });
      if (parado) a.goToAndStop(INTRO, true);
      else {
        // o desenho toca uma vez; depois só a volta ociosa se repete
        a.addEventListener("complete", () => a.playSegments([INTRO, FIM], true));
        a.playSegments([0, INTRO], true);
      }
      anim = a;
    });
    return () => {
      cancelado = true;
      anim?.destroy();
    };
  }, [cor, esquerda]);

  return <div ref={ref} aria-hidden className="h-14 w-21 shrink-0 sm:h-20 sm:w-30" />;
}

/** Conta do valor anterior até o novo, desacelerando no fim. */
function useContagem(alvo: number) {
  const [valor, setValor] = useState(0);
  const atual = useRef(0);

  useEffect(() => {
    const de = atual.current;
    if (de === alvo) return;
    const dur = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900;
    const t0 = performance.now();
    let raf = 0;
    const passo = (t: number) => {
      const k = dur ? Math.min(1, (t - t0) / dur) : 1;
      atual.current = Math.round(de + (alvo - de) * (1 - (1 - k) ** 4));
      setValor(atual.current);
      if (k < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo]);

  return valor;
}

export default function Vantagem({
  esq,
  dir,
  rumo,
  tendencia,
}: {
  esq: Candidato;
  dir: Candidato;
  /** para onde a tendência (ou o resultado) aponta; null quando ainda não aponta para ninguém */
  rumo: Rumo;
  /** linha de tendência: vantagem projetada, ou o aviso de que ainda não há tendência */
  tendencia?: { texto: string; cor?: string; alerta?: boolean };
}) {
  const frente = esq.votos >= dir.votos ? esq : dir;
  const diferenca = Math.abs(esq.votos - dir.votos);
  const contado = useContagem(diferenca);
  const semVotos = esq.votos + dir.votos === 0;

  return (
    <div className="order-last col-span-2 flex items-center justify-center gap-3 sm:order-none sm:col-span-1 sm:w-36 lg:w-44 sm:flex-col sm:gap-0 sm:text-center">
      <Animacao rumo={rumo} />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold tracking-wide text-muted uppercase">Diferença</div>
        <div className="text-xl leading-tight font-bold tabular sm:text-2xl">{semVotos ? "—" : fmtInt(contado)}</div>
        <div className="text-xs text-muted">
          {semVotos ? (
            "aguardando votos"
          ) : diferenca === 0 ? (
            "empate"
          ) : (
            <>
              votos, <span className="font-semibold" style={{ color: frente.cor }}>{frente.nome}</span> à frente
            </>
          )}
        </div>
        {tendencia && (
          <div
            className={`mt-1 text-xs font-semibold tabular ${tendencia.alerta ? "inline-block rounded-full bg-amber-100 px-2 py-0.5 text-amber-900" : ""}`}
            style={tendencia.cor ? { color: tendencia.cor } : undefined}
          >
            {tendencia.texto}
          </div>
        )}
      </div>
    </div>
  );
}
