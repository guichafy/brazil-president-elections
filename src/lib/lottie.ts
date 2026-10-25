// Peças comuns para montar animações Lottie direto no código (sem arquivo .json).

export function rgba(hex: string): [number, number, number, number] {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return Number.isNaN(n) ? [0.6, 0.6, 0.6, 1] : [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
}

export const fixo = <T,>(k: T) => ({ a: 0, k });
export const EASE = { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } };
export const transformacao = (ancora: [number, number] = [0, 0], escala: unknown = fixo([100, 100])) => ({
  ty: "tr",
  p: fixo(ancora),
  a: fixo(ancora),
  s: escala,
  r: fixo(0),
  o: fixo(100),
  sk: fixo(0),
  sa: fixo(0),
});
