"use client";

import { useEffect, useRef } from "react";
import { EASE, fixo, rgba, transformacao } from "@/lib/lottie";

interface Props {
  corLula: string;
  corFlavio: string;
  lulaSobe: boolean;
}

// composição: 280×140, 60 fps, 2 s por volta (duas oscilações por volta, para emendar sem salto)
const W = 280;
const H = 140;
const FIM = 120;
const MEIO = FIM / 2;
const Y = H / 2;
const X_LULA = 80;
const X_FLAVIO = 200;
const OSCILA = 9; // quanto a seta sólida se desloca, em px
const RASTRO = 34; // quanto o "fantasma" da seta percorre antes de sumir

// seta apontando para cima, centrada na origem; para baixo é o espelho vertical
const SETA: [number, number][] = [[0, -30], [24, -4], [9, -4], [9, 30], [-9, 30], [-9, -4], [-24, -4]];
// arrays sempre novos: o lottie altera vértices e tangentes no lugar ao carregar
const zeros = () => SETA.map((): [number, number] => [0, 0]);
const seta = (sobe: boolean) => ({
  ty: "sh",
  ks: fixo({ c: true, v: SETA.map(([x, y]) => [x, sobe ? y : -y]), i: zeros(), o: zeros() }),
});
const preenchimento = (cor: string, opacidade = 100) => ({ ty: "fl", c: fixo(rgba(cor)), o: fixo(opacidade), r: 1 });
const tr = transformacao();

const chaves = <T,>(pares: [number, T][]) => ({
  a: 1,
  k: pares.map(([t, s], n) => (n < pares.length - 1 ? { t, s, ...EASE } : { t, s })),
});

function camada(ind: number, shapes: unknown[], ks: Record<string, unknown>) {
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
    ks: { o: fixo(100), r: fixo(0), a: fixo([0, 0, 0]), s: fixo([100, 100, 100]), ...ks },
    shapes,
  };
}

/** Disco de fundo pulsando, seta "fantasma" escapando no sentido do movimento e seta sólida oscilando. */
function lado(ind: number, x: number, cor: string, sobe: boolean) {
  const d = sobe ? -1 : 1;
  const p = (dy: number) => [x, Y + dy, 0];
  return [
    camada(ind, [{ ty: "gr", it: [seta(sobe), preenchimento(cor), tr] }], {
      p: chaves([[0, p(0)], [MEIO / 2, p(d * OSCILA)], [MEIO, p(0)], [MEIO * 1.5, p(d * OSCILA)], [FIM, p(0)]]),
    }),
    camada(ind + 1, [{ ty: "gr", it: [seta(sobe), preenchimento(cor), tr] }], {
      // some antes de voltar ao ponto de partida, então o salto de volta não aparece
      o: chaves([[0, [0]], [8, [45]], [MEIO - 5, [0]], [MEIO, [0]], [MEIO + 8, [45]], [FIM - 5, [0]]]),
      p: chaves([[0, p(0)], [MEIO - 5, p(d * RASTRO)], [MEIO, p(0)], [FIM - 5, p(d * RASTRO)], [FIM, p(0)]]),
    }),
    camada(ind + 2, [{ ty: "gr", it: [{ ty: "el", d: 1, p: fixo([0, 0]), s: fixo([96, 96]) }, preenchimento(cor, 16), tr] }], {
      p: fixo(p(0)),
      s: chaves([[0, [94, 94, 100]], [MEIO, [104, 104, 100]], [FIM, [94, 94, 100]]]),
    }),
  ];
}

function animacao({ corLula, corFlavio, lulaSobe }: Props) {
  return {
    v: "5.12.2",
    fr: 60,
    ip: 0,
    op: FIM,
    w: W,
    h: H,
    nm: "quem sobe e quem cai",
    ddd: 0,
    assets: [],
    layers: [...lado(1, X_LULA, corLula, lulaSobe), ...lado(4, X_FLAVIO, corFlavio, !lulaSobe)],
  };
}

export default function AnimacaoHumor({ corLula, corFlavio, lulaSobe }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let anim: { destroy(): void } | undefined;
    let cancelado = false;
    import("lottie-web/build/player/lottie_light").then(({ default: lottie }) => {
      if (cancelado || !ref.current) return;
      const parado = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const a = lottie.loadAnimation({
        container: ref.current,
        renderer: "svg",
        loop: !parado,
        autoplay: !parado,
        animationData: animacao({ corLula, corFlavio, lulaSobe }),
      });
      if (parado) a.goToAndStop(MEIO / 2, true);
      anim = a;
    });
    return () => {
      cancelado = true;
      anim?.destroy();
    };
  }, [corLula, corFlavio, lulaSobe]);

  return <div ref={ref} aria-hidden className="h-[140px] w-[280px] max-w-full" />;
}
