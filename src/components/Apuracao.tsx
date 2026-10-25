"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtInt, fmtPct } from "@/lib/format";
import type { ApuracaoResponse, ComparacaoResponse, ResultadoAbrangencia, TimelineResponse } from "@/lib/types";
import { UF_LIST, scopeName, type Scope } from "@/lib/ufs";
import { AvisoHumor, BotaoSom, useAlertaSom } from "./AlertaSom";
import BrazilMap, { DecisaoInfo, estiloCss, ufEstilo, type MapMode } from "./BrazilMap";
import CandidateList from "./CandidateList";
import Comparacao from "./Comparacao";
import Projecao from "./Projecao";
import Timeline from "./Timeline";

const POLL_MS = 15_000;

type Vista = "evolucao" | "turnos" | "2022";

function usePolling<T>(url: string, ms: number, onData?: (data: T) => void) {
  const [data, setData] = useState<T | null>(null);
  const onDataRef = useRef(onData);
  useEffect(() => {
    onDataRef.current = onData;
  });
  const [erro, setErro] = useState<string | null>(null);
  const [recebidoEm, setRecebidoEm] = useState(0);

  useEffect(() => {
    let cancelado = false;
    const load = async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as T;
        if (cancelado) return;
        setData(json);
        onDataRef.current?.(json);
        setErro(null);
        setRecebidoEm(Date.now());
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : String(e));
      }
    };
    load();
    // continua consultando com a aba em segundo plano, para os alertas sonoros
    const id = setInterval(load, ms);
    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, [url, ms]);

  return { data, erro, recebidoEm };
}

export default function Apuracao() {
  const [scope, setScope] = useState<Scope>("br");
  const [destaque, setDestaque] = useState<string | null>(null);

  const som = useAlertaSom();
  const apuracao = usePolling<ApuracaoResponse>("/api/presidente", POLL_MS, (r) => som.onNacional(r.nacional));
  const timeline = usePolling<TimelineResponse>(`/api/presidente/timeline?scope=${scope}`, POLL_MS * 2);
  // séries de referência não mudam: uma consulta por hora basta
  const comparacao = usePolling<ComparacaoResponse>("/api/presidente/comparacao", 3_600_000);
  const [vista, setVista] = useState<Vista>("evolucao");

  const d = apuracao.data;
  const atual: ResultadoAbrangencia | null | undefined =
    scope === "br" ? d?.nacional : scope === "zz" ? d?.exterior : d?.ufs[scope];

  const mapMode: MapMode = useMemo(() => {
    const c = d?.nacional?.candidatos.find((x) => x.numero === destaque);
    return c ? { tipo: "candidato", numero: c.numero, cor: c.cor } : { tipo: "lider" };
  }, [d, destaque]);

  const candidatoDestaque = d?.nacional?.candidatos.find((x) => x.numero === destaque);
  // no 2º turno, vantagem maior que o eleitorado restante decide também a eleição nacional
  const mostraDecisao = scope !== "br" || d?.nacional?.turno === "2";

  // as referências são nacionais; o 1º T × 2º T só faz sentido durante o 2º turno
  const segundoTurno = d?.nacional?.turno === "2";
  const abas: { value: Vista; label: string }[] = [{ value: "evolucao", label: "Evolução" }];
  if (scope === "br" && segundoTurno && comparacao.data?.primeiroTurno) abas.push({ value: "turnos", label: "1ºT x 2ºT" });
  if (scope === "br" && segundoTurno && comparacao.data?.ano2022) abas.push({ value: "2022", label: "2022 x 2026" });
  const vistaAtiva = abas.some((a) => a.value === vista) ? vista : "evolucao";
  const referencia =
    vistaAtiva === "turnos" ? comparacao.data?.primeiroTurno : vistaAtiva === "2022" ? comparacao.data?.ano2022 : null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-accent text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Eleições 2026 · {d?.nacional?.turno ?? "1"}º turno</div>
            <h1 className="text-xl font-bold sm:text-2xl">Apuração para Presidente</h1>
            <Item9 />
          </div>
          <div className="flex flex-col items-end gap-2">
            <BotaoSom ativo={som.ativo} liberado={som.liberado} alternar={som.alternar} />
            <div className="flex items-center gap-2 text-sm">
              <span key={apuracao.recebidoEm} className="inline-block size-2 animate-ping rounded-full bg-white [animation-iteration-count:2]" />
              {d?.nacional ? <>Atualizado às {d.nacional.dataHora.slice(11, 16)} (TSE)</> : "Carregando…"}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
        {apuracao.erro && !d && (
          <div className="mb-4 rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
            Não foi possível carregar os dados do TSE ({apuracao.erro}). Tentando novamente…
          </div>
        )}

        {atual && <ProgressoBar r={atual} />}

        {d?.projecao && d.nacional && <Projecao projecao={d.projecao} candidatos={d.nacional.candidatos} turno={d.nacional.turno} />}

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <section className="rounded-xl bg-surface p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{scopeName(scope)}</h2>
              {scope !== "br" && (
                <button type="button" onClick={() => setScope("br")} className="text-sm font-semibold text-accent hover:underline">
                  ← Voltar para Brasil
                </button>
              )}
            </div>
            {atual ? (
              <>
                <CandidateList
                  candidatos={atual.candidatos}
                  destaque={destaque}
                  onDestaque={setDestaque}
                  vencedor={mostraDecisao && atual.decisao.garantido ? atual.decisao.lider : null}
                />
                {mostraDecisao && <DecisaoInfo r={atual} />}
                <ResumoVotos r={atual} />
              </>
            ) : (
              <Skeleton />
            )}
          </section>

          <section className="rounded-xl bg-surface p-4 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Mapa por estado</h2>
              <span className="text-xs text-muted">
                {candidatoDestaque ? (
                  <>
                    Intensidade = % de <b>{candidatoDestaque.nome}</b> ·{" "}
                    <button type="button" className="font-semibold text-accent hover:underline" onClick={() => setDestaque(null)}>
                      ver quem lidera
                    </button>
                  </>
                ) : (
                  "Cor do candidato que lidera em cada estado"
                )}
              </span>
            </div>
            {d ? (
              <>
                <BrazilMap ufs={d.ufs} selected={scope} onSelect={setScope} mode={mapMode} />
                {mapMode.tipo === "lider" && <Legenda d={d} />}
                <UfGrid d={d} selected={scope} onSelect={setScope} mode={mapMode} />
              </>
            ) : (
              <Skeleton />
            )}
          </section>
        </div>

        <section className="mt-5 rounded-xl bg-surface p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-lg font-bold">Linha do tempo da apuração · {scopeName(scope)}</h2>
            <p className="text-xs text-muted">% dos votos válidos de cada candidato conforme as seções são totalizadas</p>
          </div>
          {abas.length > 1 && <Abas value={vistaAtiva} onChange={setVista} options={abas} />}
          {atual && timeline.data && timeline.data.scope === scope ? (
            referencia ? (
              <Comparacao
                pontos={timeline.data.pontos}
                candidatos={atual.candidatos}
                rotuloAtual={`${atual.turno}º T - 2026`}
                referencia={referencia}
              />
            ) : (
              <Timeline pontos={timeline.data.pontos} candidatos={atual.candidatos} />
            )
          ) : (
            <Skeleton />
          )}
        </section>

        <footer className="mt-6 text-center text-xs text-muted">
          <p className="mb-1 font-semibold text-foreground">Acompanhamento dedicado ao grupo do Zap Item 9</p>
          Fonte: Tribunal Superior Eleitoral (resultados.tse.jus.br) · eleição {d?.eleicao ?? "…"} · atualização a cada{" "}
          {POLL_MS / 1000}s
          {d?.erros.length ? <span className="ml-2 text-accent">· {d.erros.length} abrangência(s) com falha na última consulta</span> : null}
        </footer>
      </main>

      <AvisoHumor
        evento={som.evento}
        onFechar={som.fecharAviso}
        corLula={d?.nacional?.candidatos.find((c) => c.numero === "13")?.cor ?? "#D60828"}
        corFlavio={d?.nacional?.candidatos.find((c) => c.numero === "22")?.cor ?? "#272D97"}
      />
    </div>
  );
}

function Abas({ value, onChange, options }: { value: Vista; onChange: (v: Vista) => void; options: { value: Vista; label: string }[] }) {
  return (
    <div role="tablist" className="mb-4 flex justify-center gap-2 border-b border-border">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors sm:px-6 sm:text-base ${
            value === o.value ? "border-accent font-bold text-accent" : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Item9() {
  return (
    <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">
      <svg viewBox="0 0 24 24" className="size-3.5 fill-current" aria-hidden="true">
        <path d="M12 3C6.98 3 3 6.73 3 11.33c0 2.1.83 4.02 2.2 5.48L4.5 21l4.37-1.85c.98.3 2.03.47 3.13.47 5.02 0 9-3.73 9-8.29S17.02 3 12 3Z" />
      </svg>
      Acompanhamento dedicado · Grupo do Zap <span className="font-bold">Item 9</span>
    </div>
  );
}

function ProgressoBar({ r }: { r: ResultadoAbrangencia }) {
  return (
    <div className="rounded-xl bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <span className="text-3xl font-bold tabular">{fmtPct(r.pctTotalizado)}</span>
          <span className="ml-2 text-sm text-muted">das seções totalizadas</span>
        </div>
        <div className="text-xs text-muted tabular">
          {fmtInt(r.secoesTotalizadas)} de {fmtInt(r.secoesTotais)} seções
          {/* sem seção totalizada, a única data do arquivo é a da geração (dias antes) */}
          {r.secoesTotalizadas > 0 && <> · {r.dataHora}</>}
          {r.finalizado && <span className="ml-2 font-semibold text-accent">Totalização finalizada</span>}
        </div>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-track">
        <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${r.pctTotalizado}%` }} />
      </div>
    </div>
  );
}

function ResumoVotos({ r }: { r: ResultadoAbrangencia }) {
  const itens = [
    { label: "Válidos", valor: fmtInt(r.validos) },
    { label: "Brancos", valor: fmtPct(r.pctBrancos) },
    { label: "Nulos", valor: fmtPct(r.pctNulos) },
    { label: "Abstenção", valor: fmtPct(r.pctAbstencao) },
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

function Legenda({ d }: { d: ApuracaoResponse }) {
  const ufs = Object.values(d.ufs);
  const decididos = ufs.filter((r) => r?.decisao.garantido).length;
  const cor = "var(--muted)";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-5 rounded-sm" style={estiloCss({ tipo: "solido", cor, opacity: 1 })} />
        Vitória garantida (✓)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-5 rounded-sm" style={estiloCss({ tipo: "listrado", cor })} />
        Liderando
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-5 rounded-sm" style={estiloCss({ tipo: "vazio" })} />
        Sem votos apurados
      </span>
      <span className="ml-auto font-semibold text-foreground">
        {decididos} de {ufs.length} estados decididos
      </span>
      <p className="w-full">
        Vitória garantida: a vantagem do 1º colocado é maior que o número de eleitores das urnas que ainda faltam
        apurar, então o resultado no estado não pode mais mudar.
      </p>
    </div>
  );
}

function UfGrid({
  d,
  selected,
  onSelect,
  mode,
}: {
  d: ApuracaoResponse;
  selected: Scope;
  onSelect: (s: Scope) => void;
  mode: MapMode;
}) {
  const scopes: Scope[] = [...UF_LIST, "zz"];
  return (
    <div className="mt-3 grid grid-cols-7 gap-1 sm:grid-cols-10">
      {scopes.map((s) => {
        const r = s === "zz" ? (d.exterior ?? undefined) : d.ufs[s];
        const estilo = ufEstilo(r, mode);
        const lider = r?.candidatos[0];
        const garantido = mode.tipo === "lider" && r?.decisao.garantido;
        const sel = selected === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onSelect(sel ? "br" : s)}
            title={`${scopeName(s)}${lider ? ` · ${lider.nome} ${fmtPct(lider.pct)}` : ""}${r ? ` · ${fmtPct(r.pctTotalizado)} apurado` : ""}${garantido ? " · vitória garantida" : ""}`}
            className={`relative overflow-hidden rounded py-0.5 leading-tight ${sel ? "ring-2 ring-foreground" : ""}`}
          >
            <span className="absolute inset-0" style={estiloCss(estilo)} />
            <span className="relative flex flex-col text-white" style={{ textShadow: "0 0 2px rgba(0,0,0,.8), 0 0 1px rgba(0,0,0,.8)" }}>
              <span className="text-xs font-bold uppercase">
                {garantido && "✓ "}
                {s === "zz" ? "EXT" : s}
              </span>
              <span className="text-[10px] font-semibold tabular">{r ? `${Math.floor(r.pctTotalizado)}%` : "–"}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Skeleton() {
  return <div className="h-64 animate-pulse rounded-lg bg-track" />;
}
