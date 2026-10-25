"use client";

import { useEffect, useRef } from "react";
import { EASE, fixo, rgba, transformacao } from "@/lib/lottie";
import type { Candidato } from "@/lib/types";

interface Props {
  candidatos: Candidato[];
  atualizadoEm: string; // "dd/mm/aaaa hh:mm:ss" da última totalização do TSE
}

// composição: 240×120, 60 fps, 3 s por volta (desenha, segura, some)
const W = 240;
const H = 120;
const FIM_TRACO = 110;
const INICIO_FADE = 150;
const FIM = 180;

// duelo estilizado em % dos válidos: as duas séries se espelham em torno dos 50%
const LIDER = [54, 55.5, 53, 54.5, 52.5, 53.5, 52, 52.8];
const VICE = LIDER.map((v) => 100 - v);

const Y = (v: number) => 10 + ((60 - v) / 20) * (H - 20);
const pontosDe = (serie: number[]) => serie.map((v, i): [number, number] => [12 + (i * (W - 24)) / (serie.length - 1), Y(v)]);

// curva suave passando pelos pontos (Catmull-Rom convertido em tangentes de Bézier)
function caminho(pts: [number, number][]) {
  const tg = pts.map((_, k) => {
    const a = pts[Math.max(0, k - 1)];
    const b = pts[Math.min(pts.length - 1, k + 1)];
    return [(b[0] - a[0]) / 6, (b[1] - a[1]) / 6];
  });
  return { ty: "sh", ks: fixo({ c: false, v: pts, i: tg.map(([x, y]) => [-x, -y]), o: tg }) };
}

function camada(ind: number, pts: [number, number][], cor: string) {
  const fim = pts[pts.length - 1];
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
    ks: {
      o: { a: 1, k: [{ t: INICIO_FADE, s: [100], ...EASE }, { t: INICIO_FADE + 25, s: [0] }] },
      r: fixo(0),
      p: fixo([0, 0, 0]),
      a: fixo([0, 0, 0]),
      s: fixo([100, 100, 100]),
    },
    shapes: [
      {
        ty: "gr",
        it: [
          caminho(pts),
          {
            ty: "tm",
            s: fixo(0),
            e: { a: 1, k: [{ t: 0, s: [0], ...EASE }, { t: FIM_TRACO, s: [100] }] },
            o: fixo(0),
            m: 1,
          },
          { ty: "st", c: fixo(rgba(cor)), o: fixo(100), w: fixo(4), lc: 2, lj: 2, ml: 4 },
          transformacao(),
        ],
      },
      // ponto na ponta da linha, que "estoura" quando o traço chega ao fim
      {
        ty: "gr",
        it: [
          { ty: "el", d: 1, p: fixo(fim), s: fixo([10, 10]) },
          { ty: "fl", c: fixo(rgba(cor)), o: fixo(100), r: 1 },
          transformacao(fim, {
            a: 1,
            k: [
              { t: FIM_TRACO - 8, s: [0, 0], i: { x: [0.3, 0.3], y: [1.6, 1.6] }, o: { x: [0.6, 0.6], y: [0, 0] } },
              { t: FIM_TRACO + 8, s: [100, 100] },
            ],
          }),
        ],
      },
    ],
  };
}

function referencia50(ind: number) {
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
    ks: { o: fixo(60), r: fixo(0), p: fixo([0, 0, 0]), a: fixo([0, 0, 0]), s: fixo([100, 100, 100]) },
    shapes: [
      {
        ty: "gr",
        it: [
          { ty: "sh", ks: fixo({ c: false, v: [[4, Y(50)], [W - 4, Y(50)]], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]] }) },
          {
            ty: "st",
            c: fixo(rgba("#9da3ae")),
            o: fixo(100),
            w: fixo(1.5),
            lc: 1,
            lj: 1,
            ml: 4,
            d: [
              { n: "d", nm: "traço", v: fixo(5) },
              { n: "g", nm: "espaço", v: fixo(5) },
            ],
          },
          transformacao(),
        ],
      },
    ],
  };
}

function animacao(corLider: string, corVice: string) {
  return {
    v: "5.12.2",
    fr: 60,
    ip: 0,
    op: FIM,
    w: W,
    h: H,
    nm: "linha do tempo aguardando",
    ddd: 0,
    assets: [],
    layers: [camada(1, pontosDe(LIDER), corLider), camada(2, pontosDe(VICE), corVice), referencia50(3)],
  };
}

export default function EsperaTimeline({ candidatos, atualizadoEm }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const corLider = candidatos[0]?.cor ?? "#c4170c";
  const corVice = candidatos[1]?.cor ?? "#9da3ae";

  useEffect(() => {
    let anim: { destroy(): void } | undefined;
    let cancelado = false;
    // o player só é baixado quando este estado de espera aparece
    import("lottie-web/build/player/lottie_light").then(({ default: lottie }) => {
      if (cancelado || !ref.current) return;
      const parado = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const a = lottie.loadAnimation({
        container: ref.current,
        renderer: "svg",
        loop: !parado,
        autoplay: !parado,
        animationData: animacao(corLider, corVice),
      });
      if (parado) a.goToAndStop(FIM_TRACO + 10, true);
      anim = a;
    });
    return () => {
      cancelado = true;
      anim?.destroy();
    };
  }, [corLider, corVice]);

  return (
    <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-4 text-center">
      <div ref={ref} aria-hidden className="h-[120px] w-[240px] max-w-full" />
      <div role="status" className="text-sm">
        <div className="font-semibold">Aguardando a próxima atualização</div>
        <div className="text-muted">Último dado do TSE: {atualizadoEm.slice(11, 16)}</div>
        <div className="mt-1 text-xs text-muted">A linha do tempo aparece a partir da 2ª atualização gravada.</div>
      </div>
    </div>
  );
}
