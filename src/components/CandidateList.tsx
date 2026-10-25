"use client";

import { useState } from "react";
import { fmtInt, fmtPct } from "@/lib/format";
import type { Candidato } from "@/lib/types";

interface Props {
  candidatos: Candidato[];
  destaque?: string | null;
  onDestaque?: (numero: string | null) => void;
  vencedor?: string | null; // número do candidato com vitória garantida nesta abrangência
}

export const TOP_N = 5;

export default function CandidateList({ candidatos, destaque, onDestaque, vencedor }: Props) {
  const [todos, setTodos] = useState(false);
  const visiveis = todos ? candidatos : candidatos.slice(0, TOP_N);
  const outros = candidatos.slice(TOP_N);
  const outrosVotos = outros.reduce((acc, c) => acc + c.votos, 0);
  const outrosPct = outros.reduce((acc, c) => acc + c.pct, 0);

  return (
    <ol className="divide-y divide-border">
      {visiveis.map((c, i) => {
        const ativo = destaque === c.numero;
        return (
          <li key={c.numero}>
            <button
              type="button"
              onClick={() => onDestaque?.(ativo ? null : c.numero)}
              className={`flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-track/60 ${ativo ? "bg-track" : ""}`}
              aria-pressed={ativo}
              title="Clique para colorir o mapa pelo desempenho deste candidato"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.foto}
                alt=""
                loading="lazy"
                className={`shrink-0 rounded-full bg-track object-cover ${i < 2 ? "size-14" : "size-10"}`}
                style={{ boxShadow: `0 0 0 3px var(--surface), 0 0 0 5px ${c.cor}` }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`truncate font-semibold ${i < 2 ? "text-lg" : "text-sm"}`}>{c.nome}</span>
                  <span className={`shrink-0 font-bold tabular ${i < 2 ? "text-2xl" : "text-base"}`}>{fmtPct(c.pct)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2 text-xs text-muted">
                  <span className="truncate">
                    {c.partido} · {c.numero}
                    {vencedor === c.numero && !c.situacao && (
                      <span className="ml-2 rounded bg-foreground px-1.5 py-0.5 font-semibold text-surface">✓ Vitória garantida</span>
                    )}
                    {c.situacao && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 font-semibold text-white">{c.situacao}</span>}
                  </span>
                  <span className="shrink-0 tabular">{fmtInt(c.votos)} votos</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-track">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${c.pct}%`, background: c.cor }}
                  />
                </div>
              </div>
            </button>
          </li>
        );
      })}
      {outros.length > 0 && (
        <li className="flex items-center gap-3 px-1 py-3 text-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-muted">
                {todos ? `Do 6º ao ${candidatos.length}º colocado` : `Outros ${outros.length} candidatos`}
              </span>
              <span className="shrink-0 font-bold tabular text-muted">{fmtPct(outrosPct)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-xs text-muted">
              <button type="button" onClick={() => setTodos((v) => !v)} className="font-semibold text-accent hover:underline">
                {todos ? "Mostrar só os 5 primeiros" : "Ver todos"}
              </button>
              <span className="shrink-0 tabular">{fmtInt(outrosVotos)} votos</span>
            </div>
          </div>
        </li>
      )}
    </ol>
  );
}
