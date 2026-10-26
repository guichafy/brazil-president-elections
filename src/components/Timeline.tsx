"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { fmtInt, fmtPct } from "@/lib/format";
import type { Candidato, PontoTimeline } from "@/lib/types";
import { TOP_N } from "./CandidateList";
import EsperaTimeline from "./EsperaTimeline";

type Eixo = "apurado" | "hora";

interface Props {
  pontos: PontoTimeline[];
  candidatos: Candidato[]; // ordem e cores atuais
  atualizadoEm: string; // dataHora da última totalização do TSE
  momento?: Pick<PontoTimeline, "t" | "pctTotalizado">;
}

const horaFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export default function Timeline({ pontos, candidatos, atualizadoEm, momento }: Props) {
  const [eixo, setEixo] = useState<Eixo>("apurado");
  const [foco, setFoco] = useState<"duelo" | "top" | "todos">("duelo");

  const visiveis = foco === "todos" ? candidatos : candidatos.slice(0, foco === "duelo" ? 2 : TOP_N);

  const data = useMemo(
    () =>
      pontos.map((p) => ({
        x: eixo === "apurado" ? p.pctTotalizado : new Date(p.t).getTime(),
        ponto: p,
        ...Object.fromEntries(Object.entries(p.pct).map(([n, v]) => [`c${n}`, v])),
      })),
    [pontos, eixo],
  );

  // no modo 1º × 2º o eixo Y aproxima na faixa da disputa (incluindo os 50%)
  const [yMin, yMax] = useMemo(() => {
    let lo = Infinity;
    let hi = 0;
    for (const p of pontos)
      for (const c of visiveis) {
        const v = p.pct[c.numero];
        if (v === undefined) continue;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    if (foco !== "duelo" || !Number.isFinite(lo)) return [0, Math.min(100, Math.ceil((hi + 5) / 10) * 10)];
    hi = Math.max(hi, 50);
    return [Math.max(0, Math.floor(lo - 1)), Math.min(100, Math.ceil(hi + 1))];
  }, [pontos, visiveis, foco]);

  if (pontos.length < 2) return <EsperaTimeline candidatos={candidatos} atualizadoEm={atualizadoEm} />;

  const ultimo = data.length - 1;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Segmented
          value={eixo}
          onChange={setEixo}
          options={[
            { value: "apurado", label: "% das seções" },
            { value: "hora", label: "Horário" },
          ]}
        />
        {candidatos.length > 2 && (
          <Segmented
            value={foco}
            onChange={setFoco}
            options={[
              { value: "duelo", label: "1º × 2º" },
              { value: "top", label: `Top ${TOP_N}` },
              { value: "todos", label: "Todos" },
            ]}
          />
        )}
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 96, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="x"
              type="number"
              domain={eixo === "apurado" ? [(min: number) => Math.floor(min), (max: number) => Math.min(100, Math.ceil(max))] : ["dataMin", "dataMax"]}
              tickFormatter={(v: number) => (eixo === "apurado" ? `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : horaFmt.format(v))}
              stroke="var(--subtle)"
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              tickLine={false}
              scale={eixo === "hora" ? "time" : "linear"}
            />
            <YAxis
              domain={[yMin, yMax]}
              tickFormatter={(v: number) => `${v}%`}
              allowDataOverflow
              stroke="var(--subtle)"
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <ReferenceLine y={50} stroke="var(--subtle)" strokeDasharray="4 4" label={{ value: "50%", position: "insideTopLeft", fill: "var(--muted)", fontSize: 11 }} />
            {momento && <ReferenceLine x={eixo === "apurado" ? momento.pctTotalizado : Date.parse(momento.t)} stroke="var(--foreground)" strokeWidth={2} ifOverflow="extendDomain" label={{ value: "Selecionado", position: "insideTopRight", fill: "var(--foreground)", fontSize: 11 }} />}
            <Tooltip content={(props) => <TooltipBox {...props} candidatos={visiveis} />} />
            {visiveis.map((c, i) => (
              <Line
                key={c.numero}
                dataKey={`c${c.numero}`}
                name={c.nome}
                stroke={c.cor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
                isAnimationActive={false}
                label={
                  i < 2
                    ? ({ x, y, index }: { x?: number | string; y?: number | string; index?: number }) =>
                        index === ultimo ? (
                          <text x={Number(x) + 8} y={Number(y)} dy={4} fontSize={12} fontWeight={600} fill="var(--foreground)">
                            {c.nome.split(" ").slice(-1)[0]}
                          </text>
                        ) : null
                    : undefined
                }
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-xs text-muted">
        O TSE publica apenas o retrato atual da apuração; o histórico começa em {horaFmt.format(new Date(pontos[0].t))}, com{" "}
        {fmtPct(pontos[0].pctTotalizado)} das seções totalizadas, quando o gravador passou a registrar.
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {visiveis.map((c) => (
          <li key={c.numero} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: c.cor }} />
            {c.nome}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TooltipBox({ active, payload, candidatos }: Pick<TooltipContentProps, "active" | "payload"> & { candidatos: Candidato[] }) {
  if (!active || !payload?.length) return null;
  const p = (payload[0].payload as { ponto: PontoTimeline }).ponto;
  const linhas = candidatos
    .map((c) => ({ c, pct: p.pct[c.numero] ?? 0, votos: p.votos[c.numero] ?? 0 }))
    .sort((a, b) => b.pct - a.pct);
  return (
    <div className="w-72 rounded-lg border border-border bg-surface p-3 text-sm shadow-lg">
      <div className="mb-2 flex justify-between text-xs text-muted tabular">
        <span>{horaFmt.format(new Date(p.t))}</span>
        <span>{fmtPct(p.pctTotalizado)} apurado</span>
      </div>
      {linhas.map(({ c, pct, votos }) => (
        <div key={c.numero} className="flex items-center justify-between gap-2 py-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: c.cor }} />
            <span className="truncate">{c.nome}</span>
          </span>
          <span className="shrink-0 text-right tabular">
            <span className="font-semibold">{fmtPct(pct)}</span>
            <span className="ml-1 text-xs text-muted">{fmtInt(votos)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1 text-sm transition-colors ${value === o.value ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
