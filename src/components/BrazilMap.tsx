"use client";

import { geoIdentity, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { useMemo, useState } from "react";
import brasil from "@/data/brasil-ufs.json";
import { fmtInt, fmtPct } from "@/lib/format";
import type { ResultadoAbrangencia } from "@/lib/types";
import { UFS, type Scope, type UF } from "@/lib/ufs";

const W = 600;
const H = 600;

type UfFeature = Feature<Geometry, { uf: UF }>;
const geo = brasil as unknown as FeatureCollection<Geometry, { uf: UF }>;

// Projeção plana (o Brasil fica perto do Equador); ignora a orientação dos polígonos.
const projection = geoIdentity().reflectY(true).fitSize([W, H], geo);
const pathGen = geoPath(projection);
const SHAPES = geo.features.map((f: UfFeature) => ({
  uf: f.properties.uf,
  d: pathGen(f) ?? "",
  centroid: pathGen.centroid(f),
}));

// Estados pequenos demais para rótulo dentro do polígono: o % aparece na grade de UFs.
const SEM_ROTULO: UF[] = ["df", "se", "al", "rn", "pb", "es", "rj"];
// Ajustes finos de posição do rótulo (centroide cai fora do miolo visual)
const NUDGE: Partial<Record<UF, [number, number]>> = { go: [0, 10], pe: [12, 0], pi: [-4, 10], ma: [-6, 0], sc: [6, 0] };

export type MapMode = { tipo: "lider" } | { tipo: "candidato"; numero: string; cor: string };

export type Estilo =
  | { tipo: "vazio" }
  | { tipo: "solido"; cor: string; opacity: number }
  | { tipo: "listrado"; cor: string };

/** Estilo de cada estado: cheio = vitória garantida, listrado = só liderando. */
export function ufEstilo(r: ResultadoAbrangencia | undefined, mode: MapMode, maxPct = 100): Estilo {
  if (!r || r.validos === 0) return { tipo: "vazio" };
  if (mode.tipo === "lider") {
    const cor = r.candidatos[0].cor;
    return r.decisao.garantido ? { tipo: "solido", cor, opacity: 1 } : { tipo: "listrado", cor };
  }
  const pct = r.candidatos.find((x) => x.numero === mode.numero)?.pct ?? 0;
  return { tipo: "solido", cor: mode.cor, opacity: 0.08 + 0.92 * Math.min(1, pct / Math.max(maxPct, 1)) };
}

const patternId = (cor: string) => `listra-${cor.replace("#", "")}`;

/** Mesmo estilo em CSS, para a grade de UFs e a legenda. */
export function estiloCss(e: Estilo): React.CSSProperties {
  if (e.tipo === "vazio") return { background: "var(--map-empty)" };
  if (e.tipo === "solido") return { background: e.cor, opacity: e.opacity };
  return {
    background: `repeating-linear-gradient(135deg, ${e.cor} 0 4px, color-mix(in srgb, ${e.cor} 35%, var(--surface)) 4px 8px)`,
  };
}

interface Props {
  ufs: Partial<Record<Scope, ResultadoAbrangencia>>;
  selected: Scope;
  onSelect: (s: Scope) => void;
  onDrill?: (s: Scope) => void; // duplo clique: abre os municípios do estado
  mode: MapMode;
}

export default function BrazilMap({ ufs, selected, onSelect, onDrill, mode }: Props) {
  const [hover, setHover] = useState<{ uf: UF; x: number; y: number } | null>(null);

  const maxPct = useMemo(() => {
    if (mode.tipo !== "candidato") return 100;
    return Math.max(
      ...Object.values(ufs).map((r) => r?.candidatos.find((c) => c.numero === mode.numero)?.pct ?? 0),
    );
  }, [ufs, mode]);

  const estilos = useMemo(
    () => Object.fromEntries(SHAPES.map(({ uf }) => [uf, ufEstilo(ufs[uf], mode, maxPct)])) as Record<UF, Estilo>,
    [ufs, mode, maxPct],
  );
  const coresListradas = useMemo(
    () => [...new Set(Object.values(estilos).flatMap((e) => (e.tipo === "listrado" ? [e.cor] : [])))],
    [estilos],
  );

  const hovered = hover ? ufs[hover.uf] : undefined;

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Mapa do Brasil por estado">
        <defs>
          {coresListradas.map((cor) => (
            <pattern key={cor} id={patternId(cor)} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width={8} height={8} fill={`color-mix(in srgb, ${cor} 35%, var(--surface))`} />
              <rect width={4} height={8} fill={cor} />
            </pattern>
          ))}
        </defs>

        {SHAPES.map(({ uf, d }) => {
          const e = estilos[uf];
          const fill = e.tipo === "vazio" ? "var(--map-empty)" : e.tipo === "listrado" ? `url(#${patternId(e.cor)})` : e.cor;
          return (
            <path
              key={uf}
              d={d}
              fill={fill}
              fillOpacity={e.tipo === "solido" ? e.opacity : 1}
              stroke="var(--map-stroke)"
              strokeWidth={1}
              className="cursor-pointer transition-[fill-opacity] duration-500 hover:brightness-110"
              onClick={() => onSelect(selected === uf ? "br" : uf)}
              onDoubleClick={() => onDrill?.(uf)}
              onMouseMove={(ev) => {
                const box = (ev.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHover({ uf, x: ev.clientX - box.left, y: ev.clientY - box.top });
              }}
            >
              <title>{onDrill ? `${UFS[uf]} · duplo clique para ver os municípios` : UFS[uf]}</title>
            </path>
          );
        })}

        {/* contorno do selecionado por cima dos vizinhos */}
        {SHAPES.filter((s) => s.uf === selected).map(({ uf, d }) => (
          <path key={`sel-${uf}`} d={d} fill="none" stroke="var(--foreground)" strokeWidth={2.5} pointerEvents="none" />
        ))}

        {SHAPES.filter(({ uf }) => !SEM_ROTULO.includes(uf)).map(({ uf, centroid }) => {
          const r = ufs[uf];
          const [dx, dy] = NUDGE[uf] ?? [0, 0];
          const garantido = mode.tipo === "lider" && r?.decisao.garantido;
          return (
            <g
              key={`lbl-${uf}`}
              transform={`translate(${centroid[0] + dx},${centroid[1] + dy})`}
              className="pointer-events-none select-none"
              style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,.55)", strokeWidth: 2.5, strokeLinejoin: "round" }}
            >
              <text textAnchor="middle" y={-2} className="fill-white text-[14px] font-bold uppercase">
                {garantido ? `✓ ${uf}` : uf}
              </text>
              {r && (
                <text textAnchor="middle" y={12} className="fill-white text-[11px] font-semibold tabular">
                  {Math.floor(r.pctTotalizado)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 w-64 rounded-lg border border-border bg-surface p-3 text-sm shadow-lg"
          style={{
            left: hover.x + 12,
            top: hover.y + 12,
            transform: hover.x > 300 ? "translateX(calc(-100% - 24px))" : undefined,
          }}
        >
          <div className="mb-1 font-semibold">{UFS[hover.uf]}</div>
          {hovered ? (
            <>
              <div className="mb-1 text-xs text-muted tabular">{fmtPct(hovered.pctTotalizado)} das urnas apuradas</div>
              <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-track">
                <div className="h-full bg-accent" style={{ width: `${hovered.pctTotalizado}%` }} />
              </div>
              {hovered.candidatos.slice(0, 3).map((c) => (
                <div key={c.numero} className="flex items-center justify-between gap-2 py-0.5">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: c.cor }} />
                    <span className="truncate">{c.nome}</span>
                  </span>
                  <span className="font-semibold tabular">{fmtPct(c.pct)}</span>
                </div>
              ))}
              <DecisaoInfo r={hovered} />
            </>
          ) : (
            <div className="text-xs text-muted">Sem dados</div>
          )}
        </div>
      )}
    </div>
  );
}

export function DecisaoInfo({ r }: { r: ResultadoAbrangencia }) {
  const lider = r.candidatos[0];
  if (!lider || lider.votos === 0) return null;
  if (r.decisao.garantido) {
    return (
      <div className="mt-2 rounded bg-track px-2 py-1 text-xs font-semibold">
        ✓ {lider.nome} já venceu {r.scope === "br" ? "a eleição" : "aqui"}
        {r.finalizado ? "" : " (matematicamente)"}
      </div>
    );
  }
  return (
    <div className="mt-2 border-t border-border pt-1.5 text-xs text-muted tabular">
      Vantagem de {fmtInt(r.decisao.vantagem)} votos · ainda faltam {fmtInt(r.decisao.restante)} eleitores
    </div>
  );
}
