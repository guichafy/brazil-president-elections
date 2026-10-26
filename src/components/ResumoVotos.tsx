import { fmtInt, fmtPct } from "@/lib/format";
import type { ResultadoAbrangencia } from "@/lib/types";

export type Resumo = Pick<ResultadoAbrangencia, "validos" | "pctBrancos" | "pctNulos" | "pctAbstencao" | "abstencaoDisponivel">;

export default function ResumoVotos({ r }: { r: Resumo }) {
  const itens = [
    { label: "Válidos", valor: fmtInt(r.validos) },
    { label: "Brancos", valor: fmtPct(r.pctBrancos) },
    { label: "Nulos", valor: fmtPct(r.pctNulos) },
    { label: "Abstenção", valor: r.abstencaoDisponivel === false ? "Não registrada" : fmtPct(r.pctAbstencao) },
  ];
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-4">
      {itens.map((i) => (
        <div key={i.label}>
          <dt className="text-xs text-muted">{i.label}</dt>
          <dd className="font-semibold tabular">{i.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
