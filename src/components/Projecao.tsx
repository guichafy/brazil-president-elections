"use client";

import { fmtInt, fmtPct } from "@/lib/format";
import type { Candidato, ProjecaoNacional } from "@/lib/types";
import { TOP_N } from "./CandidateList";

const pp = (n: number) =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`;

const mi = (n: number) => `${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;

export default function Projecao({
  projecao,
  candidatos,
  turno,
}: {
  projecao: ProjecaoNacional;
  candidatos: Candidato[];
  turno: string;
}) {
  const segundoTurno = turno === "2";
  // no 2º turno, com poucos votos apurados a projeção ainda reflete sobretudo o 1º turno
  const cedo = segundoTurno && projecao.tendencia.validos < 0.2 * projecao.tendencia.validosProj;
  const info = new Map(candidatos.map((c) => [c.numero, c]));
  const { tendencia, proporcional } = projecao;
  const alt = new Map(proporcional.candidatos.map((c) => [c.numero, c.pctProj]));
  const top = tendencia.candidatos.slice(0, TOP_N);
  const [primeiro, segundo] = top;
  const nome = (n: string) => info.get(n)?.nome ?? n;
  const faltam = tendencia.validosProj - tendencia.validos;
  const venceNoPrimeiro = primeiro && primeiro.pctProj >= 50;

  const faixa = (n: string, v: number) => {
    const o = alt.get(n) ?? v;
    return [Math.min(v, o), Math.max(v, o)] as const;
  };
  const [fMin, fMax] = primeiro ? faixa(primeiro.numero, primeiro.pctProj) : [0, 0];
  const indefinido = primeiro && fMin < 50 && fMax >= 50;

  return (
    <section className="mt-5 rounded-xl bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">
          Projeção para 100% das urnas <span className="ml-1 rounded bg-track px-1.5 py-0.5 align-middle text-xs font-semibold text-muted">estimativa</span>
        </h2>
        <span className="text-xs text-muted tabular">faltam ~{mi(faltam)} de votos válidos</span>
      </div>

      {primeiro && segundo && (
        <div className="mb-4 rounded-lg border-l-4 bg-track/60 p-3" style={{ borderColor: info.get(primeiro.numero)?.cor }}>
          <div className="text-base font-bold">
            {indefinido
              ? `Indefinido: ${nome(primeiro.numero)} está na fronteira dos 50%`
              : cedo
                ? `Cedo para tendência: projeção ainda apoiada no 1º turno (${nome(primeiro.numero)} à frente)`
                : segundoTurno
                  ? `Tendência: ${nome(primeiro.numero)} vence`
                  : venceNoPrimeiro
                    ? `Tendência: ${nome(primeiro.numero)} vence no 1º turno`
                    : `Tendência: 2º turno entre ${nome(primeiro.numero)} e ${nome(segundo.numero)}`}
          </div>
          <div className="text-sm text-muted tabular">
            {nome(primeiro.numero)} terminaria com {fmtPct(primeiro.pctProj)} dos válidos
            {fMax - fMin >= 0.01 && <> (faixa {fmtPct(fMin)} – {fmtPct(fMax)})</>}
            {segundoTurno ? (
              <>
                {" "}
                — vantagem projetada de {fmtInt(primeiro.votosProj - segundo.votosProj)} votos (
                {pp(primeiro.pctProj - segundo.pctProj).replace(/^[+−]/, "")}).
              </>
            ) : (
              " — para vencer no 1º turno são necessários mais de 50%."
            )}
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {top.map((c) => {
          const cand = info.get(c.numero);
          const cor = cand?.cor ?? "var(--subtle)";
          // "agora" igual ao da lista de candidatos (arquivo nacional do TSE)
          const agora = cand?.pct ?? c.pct;
          const d = c.pctProj - agora;
          return (
            <li key={c.numero}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: cor }} />
                  <span className="truncate font-semibold">{nome(c.numero)}</span>
                </span>
                <span className="shrink-0 tabular">
                  <span className="text-xs text-muted">agora {fmtPct(agora)} →</span>{" "}
                  <span className="text-base font-bold">{fmtPct(c.pctProj)}</span>{" "}
                  <span className={`text-xs font-semibold ${Math.abs(d) < 0.005 ? "text-muted" : ""}`}>{pp(d)}</span>
                </span>
              </div>
              <div className="relative mt-1 h-2 w-full rounded-full bg-track">
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${c.pctProj}%`, background: cor }} />
                {/* marcador do percentual atual */}
                <div className="absolute -top-0.5 h-3 w-0.5 rounded bg-foreground/70" style={{ left: `${agora}%` }} title={`Agora: ${fmtPct(agora)}`} />
                {/* linha dos 50% */}
                <div className="absolute -top-1 h-4 border-l border-dashed border-muted" style={{ left: "50%" }} />
              </div>
              <div className="mt-0.5 text-right text-[11px] text-muted tabular">{fmtInt(c.votosProj)} votos projetados</div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-muted">
        Como calculamos: em cada estado (e no exterior), estimamos os votos que faltam (eleitores das urnas não apuradas ×
        comparecimento × % de válidos daquele estado) e os dividimos como nas urnas apuradas nos últimos {projecao.janelaMin}{" "}
        minutos naquele estado. A faixa compara com a divisão de todo o acumulado do estado.
        {segundoTurno &&
          " Enquanto um estado tem poucos votos apurados, a divisão parte do 1º turno ali (só entre os dois finalistas) e vai cedendo peso aos votos apurados."}{" "}
        É uma estimativa feita por este site
        a partir dos dados do TSE — não é resultado oficial nem pesquisa. Barra = projeção; traço = agora; tracejado = 50%.
      </p>
    </section>
  );
}
