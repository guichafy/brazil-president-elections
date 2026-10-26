"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { fmtPct } from "@/lib/format";
import type { Candidato, PontoTimeline, SerieReferencia } from "@/lib/types";

interface Props {
  pontos: PontoTimeline[]; // apuração atual
  candidatos: Candidato[]; // ordem e cores atuais
  rotuloAtual: string; // ex.: "2º T - 2026"
  referencia: SerieReferencia;
  selecionado?: Pick<PontoTimeline, "pctTotalizado" | "pct">;
}

type Serie = { x: number; v: number }[];

/**
 * Valor publicado mais recente com até `x`% das urnas apuradas (degrau, sem interpolar):
 * é o que o painel daquela noite mostrava quando a apuração passou desse ponto.
 */
function valorEm(serie: Serie, x: number): number | undefined {
  let out: number | undefined;
  for (const p of serie) {
    if (p.x > x) break;
    out = p.v;
  }
  return out;
}

const pp = (n: number) =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`;

export default function Comparacao({ pontos, candidatos, rotuloAtual, referencia, selecionado }: Props) {
  const duelo = useMemo(() => candidatos.slice(0, 2), [candidatos]);
  const nomeRef = (c: Candidato) => referencia.nomes[c.numero] ?? c.nome;

  const { data, atual, ref, yMin, yMax } = useMemo(() => {
    const atual = new Map<string, Serie>();
    const ref = new Map<string, Serie>();
    for (const c of duelo) {
      atual.set(
        c.numero,
        pontos.filter((p) => p.pct[c.numero] !== undefined).map((p) => ({ x: p.pctTotalizado, v: p.pct[c.numero] })),
      );
      ref.set(
        c.numero,
        referencia.pontos.filter((p) => p.pct[c.numero] !== undefined).map((p) => ({ x: p.apurado, v: p.pct[c.numero] })),
      );
    }
    // as duas séries têm pontos em x diferentes: cada linha só preenche as próprias linhas da tabela
    const data = [
      ...pontos.map((p) => ({ x: p.pctTotalizado, ...Object.fromEntries(duelo.map((c) => [`a${c.numero}`, p.pct[c.numero]])) })),
      ...referencia.pontos.map((p) => ({ x: p.apurado, ...Object.fromEntries(duelo.map((c) => [`r${c.numero}`, p.pct[c.numero]])) })),
    ].sort((a, b) => a.x - b.x);

    const valores = [...atual.values(), ...ref.values()].flat().map((p) => p.v);
    const lo = Math.min(...valores);
    const hi = Math.max(...valores);
    return {
      data,
      atual,
      ref,
      yMin: Number.isFinite(lo) ? Math.max(0, Math.floor(Math.min(lo, 45) / 5) * 5) : 40,
      yMax: Number.isFinite(hi) ? Math.min(100, Math.ceil(Math.max(hi, 55) / 5) * 5) : 60,
    };
  }, [pontos, referencia, duelo]);

  const ultimo = selecionado ?? pontos.at(-1);

  return (
    <div>
      <div className="mb-2 grid grid-cols-2 gap-3 text-xs sm:text-sm">
        <LegendaGrupo titulo={rotuloAtual} itens={duelo.map((c) => ({ nome: c.nome, cor: c.cor }))} />
        <LegendaGrupo titulo={referencia.rotulo} itens={duelo.map((c) => ({ nome: nomeRef(c), cor: c.cor }))} tracejado />
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
            <CartesianGrid stroke="var(--border)" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, 100]}
              ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
              tickFormatter={(v: number) => `${v}%`}
              stroke="var(--subtle)"
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              tickLine={false}
              label={{ value: "Percentual de urnas apuradas", position: "insideBottom", offset: -14, fill: "var(--muted)", fontSize: 12 }}
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
            <ReferenceLine y={50} stroke="var(--subtle)" strokeDasharray="4 4" />
            {selecionado && <ReferenceLine x={selecionado.pctTotalizado} stroke="var(--foreground)" strokeWidth={2} />}
            <Tooltip content={(props) => <TooltipBox {...props} duelo={duelo} atual={atual} ref_={ref} nomeRef={nomeRef} />} />
            {duelo.map((c) => (
              <Line
                key={`r${c.numero}`}
                dataKey={`r${c.numero}`}
                stroke={c.cor}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                connectNulls
              />
            ))}
            {duelo.map((c) => (
              <Line
                key={`a${c.numero}`}
                dataKey={`a${c.numero}`}
                stroke={c.cor}
                strokeWidth={2.5}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                connectNulls
              />
            ))}
            {/* ponto atual de cada candidato (aparece mesmo com uma única atualização) */}
            {ultimo &&
              duelo.map((c) =>
                ultimo.pct[c.numero] !== undefined ? (
                  <ReferenceDot
                    key={`d${c.numero}`}
                    x={ultimo.pctTotalizado}
                    y={ultimo.pct[c.numero]}
                    r={5}
                    fill={c.cor}
                    stroke="var(--surface)"
                    strokeWidth={2}
                    ifOverflow="extendDomain"
                  />
                ) : null,
              )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {ultimo && (
        <div className="mt-3 rounded-lg bg-track/60 p-3 text-sm">
          <div className="mb-1 text-xs text-muted">
            No mesmo ponto da apuração ({fmtPct(ultimo.pctTotalizado)} das urnas) · {rotuloAtual} × {referencia.rotulo}
          </div>
          <ul className="space-y-1">
            {duelo.map((c) => {
              const agora = ultimo.pct[c.numero];
              const antes = valorEm(ref.get(c.numero) ?? [], ultimo.pctTotalizado);
              return (
                <li key={c.numero} className="flex flex-wrap items-baseline justify-between gap-x-3 tabular">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: c.cor }} />
                    <span className="truncate font-semibold">{c.nome}</span>
                  </span>
                  <span>
                    <span className="font-bold">{agora !== undefined ? fmtPct(agora) : "–"}</span>
                    {antes !== undefined && agora !== undefined ? (
                      <span className="ml-2 text-xs text-muted">
                        {nomeRef(c)} tinha {fmtPct(antes)} · <span className="font-semibold text-foreground">{pp(agora - antes)}</span>
                      </span>
                    ) : (
                      <span className="ml-2 text-xs text-muted">sem ponto de {referencia.rotulo} até aqui</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mt-2 text-xs text-muted">
        Eixo X: % das urnas apuradas, para comparar apurações em horários diferentes. Linha sólida: {rotuloAtual}, gravada por este site
        {pontos[0] ? ` a partir de ${fmtPct(pontos[0].pctTotalizado)} das urnas` : ""}. Tracejado: {referencia.rotulo}
        {referencia.rotulo.includes("2022") ? " (série publicada pelo UOL)" : ", gravada por este site naquela noite"}. A
        comparação usa o último valor publicado até cada ponto.
      </p>
    </div>
  );
}

function LegendaGrupo({ titulo, itens, tracejado }: { titulo: string; itens: { nome: string; cor: string }[]; tracejado?: boolean }) {
  return (
    <div className={tracejado ? "text-right" : ""}>
      <div className="font-bold">{titulo}</div>
      {itens.map((i) => (
        <div key={i.nome} className={`flex items-center gap-2 ${tracejado ? "flex-row-reverse" : ""}`}>
          <span
            className="inline-block w-6 shrink-0"
            style={{ borderTop: `${tracejado ? 2 : 3}px ${tracejado ? "dashed" : "solid"} ${i.cor}` }}
          />
          <span className="truncate">{i.nome}</span>
        </div>
      ))}
    </div>
  );
}

function TooltipBox({
  active,
  label,
  duelo,
  atual,
  ref_,
  nomeRef,
}: Pick<TooltipContentProps, "active" | "label"> & {
  duelo: Candidato[];
  atual: Map<string, Serie>;
  ref_: Map<string, Serie>;
  nomeRef: (c: Candidato) => string;
}) {
  if (!active || typeof label !== "number") return null;
  return (
    <div className="w-52 rounded-lg border border-border bg-surface p-2 text-xs shadow-lg sm:w-64 sm:p-3 sm:text-sm">
      <div className="mb-2 text-xs text-muted tabular">{fmtPct(label)} das urnas apuradas</div>
      {duelo.map((c) => {
        const serieAtual = atual.get(c.numero) ?? [];
        // depois do último ponto gravado a apuração atual ainda não chegou lá
        const a = label <= (serieAtual.at(-1)?.x ?? -1) ? valorEm(serieAtual, label) : undefined;
        const r = valorEm(ref_.get(c.numero) ?? [], label);
        return (
          <div key={c.numero} className="py-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: c.cor }} />
                <span className="truncate">{c.nome}</span>
              </span>
              <span className="font-semibold tabular">{a !== undefined ? fmtPct(a) : "–"}</span>
            </div>
            <div className="flex justify-between gap-2 pl-4 text-xs text-muted tabular">
              <span className="truncate">{nomeRef(c)} (ref.)</span>
              <span>{r !== undefined ? fmtPct(r) : "–"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
