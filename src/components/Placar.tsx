"use client";

import { fmtInt, fmtPct } from "@/lib/format";
import type { ReactNode } from "react";
import type { Candidato, ProjecaoNacional, ResultadoAbrangencia } from "@/lib/types";
import { scopeName } from "@/lib/ufs";
import Vantagem from "./Vantagem";

// Placar do 2º turno: progresso da apuração, agora × projeção, o veredito e o resumo dos votos, num só bloco.
// Mostra o Brasil (com projeção) ou o estado selecionado no mapa (sem projeção, que é só nacional).

const pp = (n: number) =>
  `${Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`;

const mi = (n: number) => `${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
const compacto = (n: number) => (n >= 1e6 ? mi(n) : fmtInt(n));

// numero: o candidato para quem o selo aponta (nenhum enquanto é cedo ou indefinido)
type Status = { texto: string; cor?: string; alerta?: boolean; numero?: string };

export default function Placar({
  r,
  projecao,
  onVoltar,
  controleReplay,
}: {
  r: ResultadoAbrangencia;
  projecao: ProjecaoNacional | null;
  onVoltar?: () => void;
  controleReplay?: ReactNode;
}) {
  // lados fixos pelo número do candidato, para o placar não trocar de lado quando a liderança muda
  const [esq, dir] = [...r.candidatos].sort((a, b) => Number(a.numero) - Number(b.numero));
  if (!esq || !dir) return null;

  const tend = projecao?.tendencia;
  const proj = new Map(tend?.candidatos.map((c) => [c.numero, c]) ?? []);
  const alt = new Map(projecao?.proporcional.candidatos.map((c) => [c.numero, c.pctProj]) ?? []);
  // com a totalização encerrada, a projeção é o próprio resultado
  const mostraProj = !!tend && !r.finalizado;
  const pEsq = proj.get(esq.numero)?.pctProj;
  const lider = tend?.candidatos[0];
  const segundo = tend?.candidatos[1];
  const nome = (n?: string) => r.candidatos.find((c) => c.numero === n)?.nome ?? "";
  const cor = (n?: string) => r.candidatos.find((c) => c.numero === n)?.cor;

  let status: Status | null = null;
  const eleito = r.candidatos.find((c) => c.eleito);
  if (eleito) status = { texto: `${eleito.nome} eleito`, cor: eleito.cor, numero: eleito.numero };
  else if (r.decisao.garantido)
    status = {
      texto: `✓ ${nome(r.decisao.lider ?? undefined)} ${r.scope === "br" ? "venceu (matematicamente)" : "venceu aqui"}`,
      cor: cor(r.decisao.lider ?? undefined),
      numero: r.decisao.lider ?? undefined,
    };
  else if (lider && tend) {
    const o = alt.get(lider.numero) ?? lider.pctProj;
    const indefinido = Math.min(o, lider.pctProj) < 50 && Math.max(o, lider.pctProj) >= 50;
    // com poucos votos apurados a projeção ainda reflete sobretudo o 1º turno
    const cedo = tend.validos < 0.2 * tend.validosProj;
    status = indefinido
      ? { texto: "Indefinido", alerta: true }
      : cedo
        ? { texto: "Cedo para tendência", alerta: true }
        : { texto: `Tendência: ${nome(lider.numero)} vence`, cor: cor(lider.numero), numero: lider.numero };
  } else if (r.candidatos[0]?.votos) status = { texto: `${r.candidatos[0].nome} lidera`, cor: r.candidatos[0].cor, numero: r.candidatos[0].numero };

  // centro do placar: a seta segue o selo; a linha de tendência traz a vantagem projetada
  const rumo = status?.numero ? { cor: cor(status.numero) ?? "#8a909c", esquerda: status.numero === esq.numero } : null;
  const linhaTend = status?.alerta
    ? { texto: status.texto, alerta: true }
    : mostraProj && lider && segundo && status?.numero === lider.numero && !eleito && !r.decisao.garantido
      ? { texto: `Tendência: ${nome(lider.numero)} +${compacto(lider.votosProj - segundo.votosProj)}`, cor: cor(lider.numero) }
      : undefined;

  return (
    <section className="rounded-xl bg-surface p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{scopeName(r.scope)}</h2>
        {onVoltar && (
          <button type="button" onClick={onVoltar} className="text-sm font-semibold text-accent hover:underline">
            ← Voltar para Brasil
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm tabular">
          <span className="text-2xl font-bold">{fmtPct(r.pctTotalizado)}</span>
          <span className="ml-1.5 text-muted">das urnas</span>
          {r.secoesTotalizadas > 0 && <span className="ml-2 text-xs text-muted">· {r.dataHora.slice(11, 16)}</span>}
        </div>
        {status && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold sm:text-sm ${status.alerta ? "bg-amber-100 text-amber-900" : "text-white"}`}
            style={status.alerta ? undefined : { background: status.cor }}
          >
            {status.texto}
          </span>
        )}
      </div>
      {controleReplay ?? <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-track">
        <div className="h-full rounded-full bg-foreground transition-[width] duration-700" style={{ width: `${r.pctTotalizado}%` }} />
      </div>}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <Lado c={esq} projetado={mostraProj ? pEsq : undefined} />
        <Vantagem esq={esq} dir={dir} rumo={rumo} tendencia={linhaTend} />
        <Lado c={dir} projetado={mostraProj ? proj.get(dir.numero)?.pctProj : undefined} direita />
      </div>

      <div className="relative mt-3">
        {/* antes do 1º voto apurado, barra dividida ao meio */}
        <Barra esq={esq} dir={dir} pctEsq={esq.pct + dir.pct > 0 ? esq.pct : 50} altura="h-4" />
        {mostraProj && pEsq !== undefined && <Barra esq={esq} dir={dir} pctEsq={pEsq} altura="mt-1 h-1.5" fraca />}
        <div className="absolute -top-1 left-1/2 h-[calc(100%+0.5rem)] border-l-2 border-dashed border-foreground/70" />
      </div>
      <div className="relative mt-1 h-4 text-[11px] text-muted">
        <span className="absolute left-1/2 -translate-x-1/2 font-semibold">50%</span>
      </div>
      <div className="text-[11px] text-muted">
        {mostraProj ? "Barra cheia = agora · barra fina = projeção para 100% das urnas" : "% dos votos válidos"}
      </div>

      <Resumo r={r} />

      {mostraProj && tend && lider && segundo && (
        <details className="mt-2 text-xs text-muted">
          <summary className="cursor-pointer font-semibold text-accent">Como calculamos a projeção</summary>
          <p className="mt-1.5 tabular">
            {nome(lider.numero)} terminaria com {fmtPct(lider.pctProj)} dos válidos, vantagem de{" "}
            {fmtInt(lider.votosProj - segundo.votosProj)} votos ({pp(lider.pctProj - segundo.pctProj)}). Faltam ~
            {mi(tend.validosProj - tend.validos)} de votos válidos.
          </p>
          <p className="mt-1.5">
            Em cada estado (e no exterior), estimamos os votos que faltam (eleitores das urnas não apuradas × comparecimento ×
            % de válidos daquele estado) e os dividimos como nas urnas apuradas nos últimos {projecao?.janelaMin} minutos ali.
            Enquanto um estado tem poucos votos apurados, a divisão parte do 1º turno naquele estado (só entre os dois
            finalistas) e vai cedendo peso aos votos apurados. &quot;Indefinido&quot; significa que a projeção muda de lado
            conforme o método (últimos minutos × todo o acumulado). É uma estimativa deste site a partir dos dados do TSE, não
            resultado oficial nem pesquisa.
          </p>
        </details>
      )}
    </section>
  );
}

function Lado({ c, projetado, direita }: { c: Candidato; projetado?: number; direita?: boolean }) {
  // no celular a foto fica ao lado do nome e o percentual ocupa a largura da coluna
  return (
    <div className={`flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3 ${direita ? "items-end text-right sm:flex-row-reverse" : ""}`}>
      <div className={`flex min-w-0 items-center gap-2 ${direita ? "flex-row-reverse" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={c.foto}
          alt=""
          className="size-10 shrink-0 rounded-full bg-track object-cover sm:size-16"
          style={{ boxShadow: `0 0 0 3px var(--surface), 0 0 0 5px ${c.cor}` }}
        />
        <div className="truncate text-sm font-semibold sm:hidden">{c.nome}</div>
      </div>
      <div className="min-w-0">
        <div className="hidden truncate text-base font-semibold sm:block">{c.nome}</div>
        <div className="text-[1.75rem] leading-tight font-bold tabular sm:text-4xl">{fmtPct(c.pct)}</div>
        <div className="text-xs text-muted tabular">
          {fmtInt(c.votos)} votos
          {projetado !== undefined && (
            <div>
              projeção <span className="font-semibold text-foreground">{fmtPct(projetado)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Barra({ esq, dir, pctEsq, altura, fraca }: { esq: Candidato; dir: Candidato; pctEsq: number; altura: string; fraca?: boolean }) {
  return (
    <div className={`flex w-full overflow-hidden rounded-full ${altura} ${fraca ? "opacity-50" : ""}`}>
      <div className="transition-[width] duration-700" style={{ width: `${pctEsq}%`, background: esq.cor }} />
      <div className="flex-1" style={{ background: dir.cor }} />
    </div>
  );
}

function Resumo({ r }: { r: ResultadoAbrangencia }) {
  const itens = [
    { label: "Válidos", valor: fmtInt(r.validos) },
    { label: "Brancos", valor: fmtPct(r.pctBrancos) },
    { label: "Nulos", valor: fmtPct(r.pctNulos) },
    { label: "Abstenção", valor: r.abstencaoDisponivel === false ? "Não registrada" : fmtPct(r.pctAbstencao) },
  ];
  return (
    <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3">
      {itens.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs text-muted">{i.label}</dt>
          <dd className="truncate text-sm font-semibold tabular sm:text-base">{i.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
