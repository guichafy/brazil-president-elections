"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { assetPath } from "@/lib/assets";
import { fmtInt, fmtPct } from "@/lib/format";
import { aplicarReplay } from "@/lib/replay";
import {pararSom} from "@/lib/sons";
import type { ApuracaoResponse, ComparacaoResponse, ReplayResponse, ResultadoAbrangencia, TimelineResponse } from "@/lib/types";
import { UF_LIST, scopeName, type Scope } from "@/lib/ufs";
import { AvisoHumor, useAlertaSom } from "./AlertaSom";
import AvisoVitoria from "./AvisoVitoria";
import BrazilMap, { DecisaoInfo, estiloCss, ufEstilo, type MapMode } from "./BrazilMap";
import CandidateList from "./CandidateList";
import Comparacao from "./Comparacao";
import Onboarding, { useOnboarding } from "./Onboarding";
import Placar from "./Placar";
import Projecao from "./Projecao";
import ReplayControls from "./ReplayControls";
import Timeline, { Segmented } from "./Timeline";

type Vista = "evolucao" | "turnos";

function useTimeline(scope: Scope, inicial: TimelineResponse) {
  const [historicos, setHistoricos] = useState<Partial<Record<Scope, TimelineResponse>>>({ [inicial.scope]: inicial });
  const [erros, setErros] = useState<Partial<Record<Scope, string>>>({});
  const [tentativa, setTentativa] = useState(0);
  const data = historicos[scope];
  useEffect(() => {
    if (data) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const r = await fetch(assetPath(`/dados/timeline/${scope}.json`), { signal: controller.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as TimelineResponse;
        if (json.scope !== scope) throw new Error("Histórico de outra abrangência");
        if (controller.signal.aborted) return;
        setHistoricos((anteriores) => ({ ...anteriores, [scope]: json }));
        setErros((anteriores) => ({ ...anteriores, [scope]: undefined }));
      } catch (e) {
        if (!controller.signal.aborted) setErros((anteriores) => ({ ...anteriores, [scope]: e instanceof Error ? e.message : String(e) }));
      }
    };
    void load();
    return () => controller.abort();
  }, [scope, data, tentativa]);
  return { data, erro: erros[scope], tentarNovamente: () => setTentativa((n) => n + 1) };
}

export default function Apuracao({
  apuracao: resultadoFinal,
  comparacao,
  timelineInicial,
}: {
  apuracao: ApuracaoResponse;
  comparacao: ComparacaoResponse;
  timelineInicial: TimelineResponse;
}) {
  const [scope, setScope] = useState<Scope>("br");
  const [destaque, setDestaque] = useState<string | null>(null);
  const [replay, setReplay] = useState<{ dados: ReplayResponse; indice: number } | null>(null);
  const [vista, setVista] = useState<Vista>("evolucao");
  const tituloAnalise = useRef<HTMLHeadingElement>(null);
  const painelId = useId();
  const abrirAnalise = useCallback(() => {
    setReplay(null);
    setScope("br");
    setVista("evolucao");
    requestAnimationFrame(() => {
      tituloAnalise.current?.focus({ preventScroll:true });
      window.scrollTo({ top:0, behavior:"instant" });
    });
  }, []);
  const selecionarScope = (s: Scope) => { setScope(s); setVista("evolucao"); };
  const selecionarVista = (v: Vista) => { setVista(v); if (v !== "evolucao") setScope("br"); };
  const d = useMemo(() => replay ? aplicarReplay(resultadoFinal, replay.dados, replay.indice) : resultadoFinal, [resultadoFinal, replay]);
  const historicoAtivo = !!replay && replay.indice < replay.dados.pontos.length - 1;

  const guia = useOnboarding();
  // com o guia aberto, os alertas de verdade esperam, para não se misturar aos testes de som
  const som = useAlertaSom(guia.aberto, resultadoFinal.nacional, abrirAnalise);
  const controleReplay = <ReplayControls scope={scope} bloqueado={!!som.vitoria||guia.aberto} somAtivo={false} indice={replay?.indice ?? null} onChange={(dados, indice) => setReplay({ dados, indice })} />;
  const timeline = useTimeline(scope, timelineInicial);

  // O resultado é fixo; fechar o tutorial também precisa liberar a comemoração.
  const onNacional = som.onNacional;
  useEffect(() => {
    if (!guia.aberto) onNacional(resultadoFinal.nacional);
  }, [guia.aberto, resultadoFinal.nacional, onNacional]);

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
  // no 2º turno, progresso + projeção viram um placar nacional único
  const comPlacar = segundoTurno && d?.nacional?.candidatos.length === 2;
  const abas: { value: Vista; label: string }[] = [{ value: "evolucao", label: "Evolução" }];
  if (segundoTurno && comparacao.primeiroTurno) abas.push({ value: "turnos", label: "1ºT × 2ºT" });
  const vistaAtiva = abas.some((a) => a.value === vista) ? vista : "evolucao";
  const referencia =
    vistaAtiva === "turnos" ? comparacao.primeiroTurno : null;

  const conteudoMapa = d ? (
    <>
      <BrazilMap ufs={d.ufs} selected={scope} onSelect={selecionarScope} mode={mapMode} />
      {mapMode.tipo === "lider" && <Legenda d={d} />}
      <UfGrid d={d} selected={scope} onSelect={selecionarScope} mode={mapMode} />
    </>
  ) : (
    <Skeleton />
  );

  const conteudoLinha = (
    <div role="tabpanel" id={painelId} aria-labelledby={`${painelId}-${vistaAtiva}`}>
      {atual && timeline.data && timeline.data.scope === scope ? (
        referencia ? (
          <Comparacao
            pontos={timeline.data.pontos}
            candidatos={atual.candidatos}
            rotuloAtual={`${atual.turno}º T - 2026`}
            referencia={referencia}
            selecionado={historicoAtivo ? { pctTotalizado: atual.pctTotalizado, pct: Object.fromEntries(atual.candidatos.map((c) => [c.numero, c.pct])) } : undefined}
          />
        ) : (
          <Timeline pontos={timeline.data.pontos} candidatos={atual.candidatos} atualizadoEm={atual.dataHora} momento={historicoAtivo ? { t: atual.isoDataHora, pctTotalizado: atual.pctTotalizado } : undefined} />
        )
      ) : timeline.erro ? (
        <div role="alert" className="rounded-lg bg-track p-4 text-sm">
          Não foi possível carregar o histórico ({timeline.erro}).{" "}
          <button type="button" onClick={timeline.tentarNovamente} className="font-semibold text-accent underline">Tentar novamente</button>
        </div>
      ) : (
        <Skeleton />
      )}
    </div>
  );

  return (
    <>
      <div className="flex min-h-screen flex-col" inert={guia.aberto || !!som.vitoria}>
        <header className="bg-accent text-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Eleições 2026 · {d?.nacional?.turno ?? "1"}º turno</div>
              <h1 ref={tituloAnalise} tabIndex={-1} className="text-xl font-bold outline-none sm:text-2xl">Análise da eleição presidencial</h1>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={()=>{pararSom();guia.rever();}}
                  className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold whitespace-nowrap hover:bg-white/25"
                >
                  ❓ Como funciona?
                </button>
                <button type="button" onClick={som.testarVitoria} className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-accent hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Rever apresentação</button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-block size-2 rounded-full bg-white" />
                {d.nacional ? <>{historicoAtivo ? `${fmtPct(d.nacional.pctTotalizado)} apurado` : "100% apurado"} · {d.nacional.dataHora} (TSE)</> : "Resultado arquivado"}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
          {comPlacar && d?.nacional ? (
            <>
              <Placar
                r={atual ?? d.nacional}
                projecao={scope === "br" ? d.projecao : null}
                controleReplay={controleReplay}
                onVoltar={scope !== "br" ? () => setScope("br") : undefined}
              />
            </>
          ) : (
            <>
              {atual && <ProgressoBar r={atual} controleReplay={controleReplay} />}
              {d?.projecao && d.nacional && <Projecao projecao={d.projecao} candidatos={d.nacional.candidatos} turno={d.nacional.turno} />}
            </>
          )}

          {comPlacar ? (
            <section className="mt-5 rounded-xl bg-surface p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">Evolução e comparações</h2>
                  <p className="mt-1 text-sm text-muted">Consulte a evolução dos votos ou compare os resultados entre os turnos de 2026.</p>
                </div>
                {scope !== "br" && (
                  <button type="button" onClick={() => setScope("br")} className="text-sm font-semibold text-accent hover:underline">
                    ← Voltar para Brasil
                  </button>
                )}
              </div>
              <Abas value={vistaAtiva} onChange={selecionarVista} options={abas} painelId={painelId} />
              <p className="mb-5 text-xs text-muted">A comparação entre turnos usa os dados do Brasil. Selecione um estado no mapa para consultar a evolução dele.</p>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Mapa</h3>
                    {d?.nacional && (
                      <span className="flex items-center gap-2 text-xs text-muted">
                        Colorir por
                        <Segmented
                          value={destaque ?? "lider"}
                          onChange={(v) => setDestaque(v === "lider" ? null : v)}
                          options={[
                            { value: "lider", label: "Líder" },
                            ...d.nacional.candidatos.map((c) => ({ value: c.numero, label: primeiroNome(c.nome) })),
                          ]}
                        />
                      </span>
                    )}
                  </div>
                  {candidatoDestaque && (
                    <p className="mb-1 text-xs text-muted">
                      Intensidade = % de <b>{candidatoDestaque.nome}</b> em cada estado
                    </p>
                  )}
                  {conteudoMapa}
                </div>
                <div className="order-first min-w-0 lg:order-last">
                  <h3 className="mb-2 text-sm font-semibold">{scopeName(scope)} · % dos votos válidos</h3>
                  {conteudoLinha}
                </div>
              </div>
            </section>
          ) : (
            <>
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
                  {conteudoMapa}
                </section>
              </div>

              <section className="mt-5 rounded-xl bg-surface p-4 shadow-sm">
                <div className="mb-3">
                  <h2 className="text-lg font-bold">Linha do tempo da apuração · {scopeName(scope)}</h2>
                  <p className="text-xs text-muted">% dos votos válidos de cada candidato conforme as seções são totalizadas</p>
                </div>
                <Abas value={vistaAtiva} onChange={selecionarVista} options={abas} painelId={painelId} />
                {conteudoLinha}
              </section>
            </>
          )}

          <footer className="mt-6 text-center text-xs text-muted">
            Fonte: Tribunal Superior Eleitoral (resultados.tse.jus.br) · eleição {d.eleicao} · resultado e histórico preservados
          </footer>
        </main>

        <AvisoHumor
          evento={som.evento}
          onFechar={som.fecharAviso}
          corLula={d?.nacional?.candidatos.find((c) => c.numero === "13")?.cor ?? "#D60828"}
          corFlavio={d?.nacional?.candidatos.find((c) => c.numero === "22")?.cor ?? "#272D97"}
        />
      </div>
      <AvisoVitoria
        onAlternar={som.alternarVitoria}
        onPosicionar={som.posicionarVitoria}
        resultadoFinal={resultadoFinal}
        vitoria={som.vitoria}
        onFechar={som.fecharVitoria}
        onOuvir={som.ouvirVitoria}
        corLula={d?.nacional?.candidatos.find((c) => c.numero === "13")?.cor ?? "#D60828"}
      />
      {guia.aberto && (
        <Onboarding
          podeFechar={guia.revendo}
          onFechar={guia.fechar}
          onConcluir={guia.concluir}
        />
      )}
    </>
  );
}

function Abas({ value, onChange, options, painelId }: { value: Vista; onChange: (v: Vista) => void; options: { value: Vista; label: string }[]; painelId:string }) {
  return (
    <div role="tablist" aria-label="Análises da eleição" className="mb-4 flex justify-center gap-1 border-b border-border sm:gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          id={`${painelId}-${o.value}`}
          aria-controls={painelId}
          tabIndex={value === o.value ? 0 : -1}
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          onKeyDown={e => {
            const i = options.findIndex(option => option.value === o.value);
            const proximo = { ArrowRight:(i+1)%options.length, ArrowLeft:(i+options.length-1)%options.length, Home:0, End:options.length-1 }[e.key];
            if (proximo === undefined) return;
            e.preventDefault();
            onChange(options[proximo].value);
            e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[proximo]?.focus();
          }}
          className={`-mb-px border-b-2 px-2 py-2 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-accent sm:px-6 sm:text-base ${
            value === o.value ? "border-accent font-bold text-accent" : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ProgressoBar({ r, controleReplay }: { r: ResultadoAbrangencia; controleReplay?: ReactNode }) {
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
      {controleReplay ?? <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-track">
        <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${r.pctTotalizado}%` }} />
      </div>}
    </div>
  );
}

function ResumoVotos({ r }: { r: ResultadoAbrangencia }) {
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

/** "FLAVIO BOLSONARO" -> "Flavio" */
function primeiroNome(nome: string) {
  const p = nome.split(" ")[0];
  return p.charAt(0) + p.slice(1).toLowerCase();
}

function Skeleton() {
  return <div className="h-64 animate-pulse rounded-lg bg-track" />;
}
