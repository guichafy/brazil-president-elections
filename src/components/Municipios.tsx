"use client";

import { Fragment, memo, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { assetPath } from "@/lib/assets";
import { fmtInt, fmtPct, fmtPP, fmtSinal, primeiroNome } from "@/lib/format";
import type { Candidato, Municipio, MunicipiosResponse, ResultadoAbrangencia } from "@/lib/types";
import { scopeName, type Scope } from "@/lib/ufs";
import CandidateList from "./CandidateList";
import ResumoVotos from "./ResumoVotos";
import { Segmented } from "./Timeline";

type Abrangencia = Exclude<Scope, "br">;

// Um pedido por UF durante a visita: trocar de estado e voltar não baixa de novo.
const pedidos = new Map<Abrangencia, Promise<MunicipiosResponse>>();
function buscar(scope: Abrangencia) {
  let p = pedidos.get(scope);
  if (!p) {
    p = fetch(assetPath(`/dados/municipios/${scope}.json`)).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as MunicipiosResponse;
      if (json.scope !== scope) throw new Error("Municípios de outra abrangência");
      return json;
    });
    p.catch(() => pedidos.delete(scope));
    pedidos.set(scope, p);
  }
  return p;
}

function useMunicipios(scope: Abrangencia) {
  const [estado, setEstado] = useState<{ dados?: MunicipiosResponse; erro?: string }>({});
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let ativo = true;
    buscar(scope).then(
      (dados) => ativo && setEstado({ dados }),
      (e) => ativo && setEstado({ erro: e instanceof Error ? e.message : String(e) }),
    );
    return () => { ativo = false; };
  }, [scope, tentativa]);
  return { ...estado, tentarNovamente: () => { setEstado({}); setTentativa((n) => n + 1); } };
}

interface Linha {
  m: Municipio;
  pct: number[]; // % dos válidos, na ordem de MunicipiosResponse.candidatos
  lider: number | null; // índice do candidato mais votado
  margem: number; // p.p. entre o 1º e o 2º colocados
  pctComparecimento: number;
  pct1T: number[] | null;
  ganhoPP: number[] | null; // p.p. dos válidos ganhos desde o 1º turno
  ganhoVotos: number[] | null;
  virada: boolean; // quem estava à frente no 1º turno (entre estes candidatos) perdeu no 2º
}

const maisVotado = (votos: number[]) => votos.reduce<number | null>((a, v, i) => (a === null || v > votos[a] ? i : a), null);

function calcularLinha(m: Municipio): Linha {
  const pct = m.votos.map((v) => (m.validos ? (v / m.validos) * 100 : 0));
  const ordem = pct.map((_, i) => i).sort((a, b) => m.votos[b] - m.votos[a]);
  const [a, b] = ordem;
  const lider = m.validos && a !== undefined ? a : null;
  const t1 = m.primeiroTurno;
  const pct1T = t1 ? t1.votos.map((v) => (t1.validos ? (v / t1.validos) * 100 : 0)) : null;
  const lider1T = t1?.validos ? maisVotado(t1.votos) : null;
  return {
    m, pct, lider,
    margem: lider === null ? 0 : pct[a] - (b === undefined ? 0 : pct[b]),
    pctComparecimento: m.eleitorado ? (m.comparecimento / m.eleitorado) * 100 : 0,
    pct1T,
    ganhoPP: pct1T && pct.map((p, i) => p - pct1T[i]),
    ganhoVotos: t1 ? m.votos.map((v, i) => v - t1.votos[i]) : null,
    virada: lider !== null && lider1T !== null && lider !== lider1T,
  };
}

/** Soma votos (não percentuais) para que o total bata com o resultado oficial da UF. */
function somarLinhas(linhas: Linha[]): Linha {
  const soma = (f: (m: Municipio) => number) => linhas.reduce((n, l) => n + f(l.m), 0);
  const n = linhas[0]?.m.votos.length ?? 0;
  const comT1 = linhas.length > 0 && linhas.every((l) => l.m.primeiroTurno);
  return calcularLinha({
    cd: "total", ibge: "", nome: "Total", capital: false, dataHora: "", finalizado: true,
    eleitorado: soma((m) => m.eleitorado), comparecimento: soma((m) => m.comparecimento), abstencao: soma((m) => m.abstencao),
    validos: soma((m) => m.validos), brancos: soma((m) => m.brancos), nulos: soma((m) => m.nulos),
    votos: Array.from({ length: n }, (_, i) => soma((m) => m.votos[i])),
    ...(comT1 ? {
      primeiroTurno: {
        validos: soma((m) => m.primeiroTurno!.validos),
        votos: Array.from({ length: n }, (_, i) => soma((m) => m.primeiroTurno!.votos[i])),
      },
    } : {}),
  });
}

// Os mesmos textos servem para as UFs (municípios) e para o exterior (cidades).
const TERMOS = {
  municipio: { plural: "municípios", singular: "município", todos: "Todos os municípios", coluna: "Município", nenhum: "Nenhum município", um: "um município" },
  cidade: { plural: "cidades", singular: "cidade", todos: "Todas as cidades", coluna: "Cidade", nenhum: "Nenhuma cidade", um: "uma cidade" },
};
type Termos = (typeof TERMOS)[keyof typeof TERMOS];

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function Municipios({
  scope,
  uf,
  destaque,
  onDestaque,
  historicoAtivo,
  onVoltar,
}: {
  scope: Abrangencia;
  uf: ResultadoAbrangencia; // resultado final da UF: os municípios não têm histórico
  destaque: string | null;
  onDestaque: (numero: string | null) => void;
  historicoAtivo: boolean;
  onVoltar: () => void;
}) {
  const { dados, erro, tentarNovamente } = useMunicipios(scope);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const detalhe = useRef<HTMLDivElement>(null);
  const linhas = useMemo(() => (dados ? dados.municipios.map(calcularLinha) : []), [dados]);
  const candidatos = useMemo(
    () => (dados?.candidatos ?? []).map((n) => uf.candidatos.find((c) => c.numero === n) ?? candidatoSemDados(n)),
    [dados, uf],
  );
  const exterior = scope === "zz";
  const termos = exterior ? TERMOS.cidade : TERMOS.municipio;
  const linhaSel = linhas.find((l) => l.m.cd === selecionado) ?? null;
  const idxDestaque = destaque && dados ? dados.candidatos.indexOf(destaque) : -1;

  const selecionar = (cd: string | null) => {
    setSelecionado(cd);
    // Em telas estreitas o detalhe fica acima da tabela; traz para a vista.
    if (cd) requestAnimationFrame(() => detalhe.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <button type="button" onClick={onVoltar} className="mb-1 text-sm font-semibold text-accent hover:underline">
            ← Mapa do Brasil
          </button>
          <h2 className="text-lg font-bold">
            {exterior ? "Cidades no exterior" : `Municípios · ${scopeName(scope)}`}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Resultado final de {dados ? fmtInt(dados.municipios.length) : "cada um dos"} {termos.plural}. Clique {exterior ? "" : "no mapa ou "}na tabela para ver o detalhe.
          </p>
          {historicoAtivo && (
            <p className="mt-1 text-xs font-semibold text-muted">
              O momento escolhido no slider não vale aqui: o TSE não guarda o histórico por {termos.singular}.
            </p>
          )}
        </div>
        {candidatos.length > 0 && !exterior && (
          <span className="flex items-center gap-2 text-xs text-muted">
            Colorir por
            <Segmented
              value={idxDestaque >= 0 ? destaque! : "lider"}
              onChange={(v) => onDestaque(v === "lider" ? null : v)}
              options={[{ value: "lider", label: "Líder" }, ...uf.candidatos.slice(0, 2).map((c) => ({ value: c.numero, label: primeiroNome(c.nome) }))]}
            />
          </span>
        )}
      </div>

      {dados ? (
        <>
          <div className={`grid grid-cols-[minmax(0,1fr)] gap-6 ${exterior ? "" : "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"}`}>
            {!exterior && dados.mapa && (
              <MapaMunicipios dados={dados} linhas={linhas} candidatos={candidatos} idxDestaque={idxDestaque} selecionado={selecionado} onSelect={selecionar} />
            )}
            <div ref={detalhe} className="min-w-0 scroll-mt-4">
              {linhaSel ? (
                <DetalheMunicipio linha={linhaSel} candidatos={candidatos} uf={uf} destaque={destaque} onDestaque={onDestaque} onFechar={() => setSelecionado(null)} />
              ) : (
                <ResumoVitorias linhas={linhas} candidatos={candidatos} termos={termos} uf={uf} onSelect={selecionar} />
              )}
            </div>
          </div>
          <TabelaMunicipios linhas={linhas} candidatos={candidatos} uf={uf} termos={termos} selecionado={selecionado} onSelect={selecionar} />
        </>
      ) : erro ? (
        <div role="alert" className="rounded-lg bg-track p-4 text-sm">
          Não foi possível carregar os dados ({erro}).{" "}
          <button type="button" onClick={tentarNovamente} className="font-semibold text-accent underline">Tentar novamente</button>
        </div>
      ) : (
        <div className="h-64 animate-pulse rounded-lg bg-track" />
      )}
    </div>
  );
}

function candidatoSemDados(numero: string): Candidato {
  return {
    numero, sqcand: "", nome: numero, nomeCompleto: numero, partido: "", coligacao: "", vice: "",
    cor: "var(--muted)", foto: "", votos: 0, pct: 0, eleito: false, situacao: "",
  };
}

/** Líder: tom mais forte quanto maior a vantagem. Candidato: tom proporcional ao % dele. */
function preenchimento(l: Linha, candidatos: Candidato[], idxDestaque: number, maxPct: number) {
  if (l.lider === null) return { fill: "var(--map-empty)", opacity: 1 };
  if (idxDestaque < 0) return { fill: candidatos[l.lider].cor, opacity: 0.25 + 0.75 * Math.min(1, l.margem / 50) };
  return { fill: candidatos[idxDestaque].cor, opacity: 0.08 + 0.92 * Math.min(1, l.pct[idxDestaque] / Math.max(maxPct, 1)) };
}

function MapaMunicipios({
  dados,
  linhas,
  candidatos,
  idxDestaque,
  selecionado,
  onSelect,
}: {
  dados: MunicipiosResponse;
  linhas: Linha[];
  candidatos: Candidato[];
  idxDestaque: number;
  selecionado: string | null;
  onSelect: (cd: string | null) => void;
}) {
  const [hover, setHover] = useState<{ cd: string; x: number; y: number } | null>(null);
  const { largura, altura } = dados.mapa!;
  const porCd = useMemo(() => new Map(linhas.map((l) => [l.m.cd, l])), [linhas]);
  const maxPct = useMemo(() => (idxDestaque < 0 ? 100 : Math.max(...linhas.map((l) => l.pct[idxDestaque]))), [linhas, idxDestaque]);
  const semMapa = linhas.filter((l) => !l.m.d).length;
  const sel = selecionado ? porCd.get(selecionado) : undefined;
  const hovered = hover ? porCd.get(hover.cd) : undefined;

  // Delegação: um único handler para centenas de contornos.
  const alvo = (ev: MouseEvent<SVGSVGElement>) => (ev.target as Element).getAttribute("data-cd");
  const onMove = (ev: MouseEvent<SVGSVGElement>) => {
    const cd = alvo(ev);
    if (!cd) return setHover(null);
    const box = ev.currentTarget.getBoundingClientRect();
    setHover({ cd, x: ev.clientX - box.left, y: ev.clientY - box.top });
  };

  return (
    <div className="min-w-0">
      <div className="relative" onMouseLeave={() => setHover(null)}>
        <svg
          viewBox={`0 0 ${largura} ${altura}`}
          className="mx-auto h-auto max-h-[70vh] w-full"
          role="img"
          aria-label={`Mapa dos municípios de ${scopeName(dados.scope)}. A tabela abaixo traz os mesmos dados.`}
          onMouseMove={onMove}
          onClick={(ev) => {
            const cd = alvo(ev);
            if (cd) onSelect(cd === selecionado ? null : cd);
          }}
        >
          <Contornos linhas={linhas} candidatos={candidatos} idxDestaque={idxDestaque} maxPct={maxPct} />
          {hovered?.m.d && hovered !== sel && (
            <path d={hovered.m.d} fill="none" stroke="var(--foreground)" strokeWidth={1} pointerEvents="none" />
          )}
          {sel?.m.d && <path d={sel.m.d} fill="none" stroke="var(--foreground)" strokeWidth={2.5} pointerEvents="none" />}
        </svg>
        {hover && hovered && (
          <div
            className="pointer-events-none absolute z-10 w-60 rounded-lg border border-border bg-surface p-3 text-sm shadow-lg"
            style={{ left: hover.x + 12, top: hover.y + 12, transform: hover.x > 260 ? "translateX(calc(-100% - 24px))" : undefined }}
          >
            <div className="mb-1 font-semibold">{hovered.m.nome}</div>
            <div className="mb-1 text-xs text-muted tabular">{fmtInt(hovered.m.eleitorado)} eleitores</div>
            {hovered.pct
              .map((p, i) => ({ p, i }))
              .sort((a, b) => b.p - a.p)
              .slice(0, 3)
              .map(({ p, i }) => (
                <div key={candidatos[i].numero} className="flex items-center justify-between gap-2 py-0.5">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: candidatos[i].cor }} />
                    <span className="truncate">{candidatos[i].nome}</span>
                  </span>
                  <span className="font-semibold tabular">{fmtPct(p)}</span>
                </div>
              ))}
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        {idxDestaque < 0
          ? "Cor de quem venceu em cada município; quanto mais forte, maior a vantagem sobre o 2º colocado."
          : `Intensidade = % de ${candidatos[idxDestaque].nome} em cada município.`}
        {semMapa > 0 && ` ${semMapa} ${semMapa === 1 ? "município não tem" : "municípios não têm"} contorno na malha do IBGE e aparece${semMapa === 1 ? "" : "m"} só na tabela.`}
      </p>
    </div>
  );
}

// Só redesenha os contornos quando a coloração muda, não a cada movimento do mouse.
const Contornos = memo(function Contornos({ linhas, candidatos, idxDestaque, maxPct }: { linhas: Linha[]; candidatos: Candidato[]; idxDestaque: number; maxPct: number }) {
  return (
    <g stroke="var(--map-stroke)" strokeWidth={0.4} className="cursor-pointer">
      {linhas.map((l) => {
        if (!l.m.d) return null;
        const { fill, opacity } = preenchimento(l, candidatos, idxDestaque, maxPct);
        return <path key={l.m.cd} data-cd={l.m.cd} d={l.m.d} fill={fill} fillOpacity={opacity} />;
      })}
    </g>
  );
});

function ResumoVitorias({ linhas, candidatos, termos, uf, onSelect }: { linhas: Linha[]; candidatos: Candidato[]; termos: Termos; uf: ResultadoAbrangencia; onSelect: (cd: string) => void }) {
  const eleitorado = linhas.reduce((n, l) => n + l.m.eleitorado, 0);
  const porCandidato = candidatos
    .map((c, i) => {
      const venceu = linhas.filter((l) => l.lider === i);
      const melhor = linhas.reduce<Linha | null>((a, l) => (l.m.validos && (!a || l.pct[i] > a.pct[i]) ? l : a), null);
      return { c, i, vitorias: venceu.length, eleitorado: venceu.reduce((n, l) => n + l.m.eleitorado, 0), melhor };
    })
    .filter((x) => x.vitorias > 0 || uf.candidatos.slice(0, 2).some((c) => c.numero === x.c.numero))
    .sort((a, b) => b.vitorias - a.vitorias);
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Onde cada candidato venceu</h3>
      <ul className="space-y-3">
        {porCandidato.map(({ c, i, vitorias, eleitorado: el, melhor }) => (
          <li key={c.numero}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: c.cor }} />
                <span className="truncate">{c.nome}</span>
              </span>
              <span className="shrink-0 text-sm tabular">
                <b>{fmtInt(vitorias)}</b> {termos.plural}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-track">
              <div className="h-full rounded-full" style={{ width: `${linhas.length ? (vitorias / linhas.length) * 100 : 0}%`, background: c.cor }} />
            </div>
            <div className="mt-1 text-xs text-muted">
              {fmtPct(eleitorado ? (el / eleitorado) * 100 : 0)} do eleitorado
              {melhor && (
                <>
                  {" · "}melhor resultado:{" "}
                  <button type="button" onClick={() => onSelect(melhor.m.cd)} className="font-semibold text-accent hover:underline">
                    {melhor.m.nome} ({fmtPct(melhor.pct[i])})
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted">Selecione {termos.um} para ver o resultado completo e as comparações com {uf.scope === "zz" ? "o total do exterior" : "o estado"} e com o 1º turno.</p>
    </div>
  );
}

function DetalheMunicipio({
  linha,
  candidatos,
  uf,
  destaque,
  onDestaque,
  onFechar,
}: {
  linha: Linha;
  candidatos: Candidato[];
  uf: ResultadoAbrangencia;
  destaque: string | null;
  onDestaque: (numero: string | null) => void;
  onFechar: () => void;
}) {
  const { m, pct, pct1T } = linha;
  const lista = candidatos
    .map((c, i) => ({ ...c, votos: m.votos[i], pct: pct[i], eleito: false, situacao: "" }))
    .sort((a, b) => b.votos - a.votos);
  const principais = lista.slice(0, 2);
  const outros1T = pct1T ? 100 - pct1T.reduce((a, b) => a + b, 0) : 0;
  return (
    <div>
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold">
            {m.nome}
            {m.capital && <span className="rounded bg-track px-1.5 py-0.5 text-xs font-semibold text-muted">Capital</span>}
          </h3>
          <p className="text-xs text-muted tabular">
            {fmtInt(m.eleitorado)} eleitores · comparecimento de {fmtPct(linha.pctComparecimento)}
            {m.dataHora && <> · totalizado em {m.dataHora}</>}
          </p>
        </div>
        <button type="button" onClick={onFechar} className="shrink-0 text-sm font-semibold text-accent hover:underline">
          ← Resumo
        </button>
      </div>
      <CandidateList candidatos={lista} destaque={destaque} onDestaque={onDestaque} />
      <ResumoVotos
        r={{
          validos: m.validos,
          pctBrancos: m.comparecimento ? (m.brancos / m.comparecimento) * 100 : 0,
          pctNulos: m.comparecimento ? (m.nulos / m.comparecimento) * 100 : 0,
          pctAbstencao: m.eleitorado ? (m.abstencao / m.eleitorado) * 100 : 0,
        }}
      />
      <div className="mt-3 grid gap-3 border-t border-border pt-3 text-sm sm:grid-cols-2">
        <div>
          <h4 className="mb-1 text-xs font-semibold text-muted">{uf.scope === "zz" ? "Em relação ao total do exterior" : `Em relação a ${scopeName(uf.scope)}`}</h4>
          <ul className="space-y-0.5 tabular">
            {principais.map((c) => {
              const noEstado = uf.candidatos.find((x) => x.numero === c.numero)?.pct ?? 0;
              return (
                <li key={c.numero}>
                  <b>{primeiroNome(c.nome)}</b> {fmtPct(c.pct)} · {uf.scope === "zz" ? "exterior" : "estado"} {fmtPct(noEstado)}{" "}
                  <span className="text-muted">({fmtPP(c.pct - noEstado)})</span>
                </li>
              );
            })}
          </ul>
        </div>
        {pct1T && (
          <div>
            <h4 className="mb-1 text-xs font-semibold text-muted">Do 1º para o 2º turno</h4>
            <ul className="space-y-0.5 tabular">
              {principais.map((c) => {
                const i = candidatos.findIndex((x) => x.numero === c.numero);
                const antes = pct1T[i];
                return (
                  <li key={c.numero}>
                    <b>{primeiroNome(c.nome)}</b> {fmtPct(antes)} → {fmtPct(c.pct)}{" "}
                    <span className="text-muted">({fmtPP(c.pct - antes)}{linha.ganhoVotos && `, ${fmtSinal(linha.ganhoVotos[i])} votos`})</span>
                  </li>
                );
              })}
              {linha.virada && <li className="text-xs font-semibold">Virada: o vencedor estava atrás no 1º turno.</li>}
              <li className="text-xs text-muted">Os demais candidatos somaram {fmtPct(outros1T)} dos válidos no 1º turno.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

type Coluna = "nome" | "eleitorado" | "comparecimento" | "margem" | `c${number}` | `g${number}`;
type Filtro = "todos" | "viradas" | `v${number}`;
const PAGINA = 30;

function valorColuna(l: Linha, coluna: Coluna): number | string | null {
  if (coluna === "nome") return semAcento(l.m.nome);
  if (coluna === "eleitorado") return l.m.eleitorado;
  if (coluna === "comparecimento") return l.pctComparecimento;
  if (coluna === "margem") return l.lider === null ? null : l.margem;
  const i = Number(coluna.slice(1));
  if (coluna.startsWith("g")) return l.ganhoPP ? l.ganhoPP[i] : null;
  return l.pct[i];
}

function ordenar(lista: Linha[], coluna: Coluna, desc: boolean) {
  const sinal = desc ? -1 : 1;
  return lista.sort((a, b) => {
    const va = valorColuna(a, coluna), vb = valorColuna(b, coluna);
    // Sem dado vai para o fim nos dois sentidos.
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    return (typeof va === "string" ? va.localeCompare(vb as string, "pt-BR") : va - (vb as number)) * sinal;
  });
}

/** Barra do % no 2º turno com uma marca onde o candidato estava no 1º. */
function BarraPct({ pct, antes, cor }: { pct: number; antes?: number; cor: string }) {
  return (
    <div aria-hidden className="relative mt-1 ml-auto h-1.5 w-full min-w-14 max-w-24 rounded-full bg-track">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: cor }} />
      {antes !== undefined && (
        <div className="absolute -top-0.5 -bottom-0.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${Math.min(100, antes)}%` }} />
      )}
    </div>
  );
}

function CelulaGanho({ pp, votos, cor }: { pp: number; votos: number; cor: string }) {
  return (
    <>
      <div className="font-semibold whitespace-nowrap">
        <span aria-hidden className="mr-1 text-[0.65rem]" style={{ color: cor }}>{pp > 0 ? "▲" : pp < 0 ? "▼" : "•"}</span>
        {fmtPP(pp)}
      </div>
      <div className="text-xs whitespace-nowrap text-muted">{fmtSinal(votos)} votos</div>
    </>
  );
}

const csvTexto = (s: string) => `"${s.replaceAll('"', '""')}"`;
const csvPct = (n: number) => n.toFixed(2).replace(".", ",");

/** Planilha no formato do Excel em português: ponto e vírgula e vírgula decimal. */
function baixarCsv(arquivo: string, linhas: Linha[], candidatos: Candidato[], termos: Termos) {
  const com1T = linhas.some((l) => l.pct1T);
  const cabecalho = [
    termos.coluna, "Código TSE", "Código IBGE", "Capital", "Eleitorado", "Comparecimento", "Abstenção", "Válidos", "Brancos", "Nulos",
    ...candidatos.flatMap((c) => [`${c.nome} (votos)`, `${c.nome} (% válidos)`]),
    ...(com1T ? candidatos.flatMap((c) => [`${c.nome} 1º turno (votos)`, `${c.nome} 1º turno (% válidos)`, `${c.nome} ganho (p.p.)`]) : []),
  ];
  const corpo = linhas.map((l) => [
    csvTexto(l.m.nome), l.m.cd, l.m.ibge, l.m.capital ? "sim" : "não",
    l.m.eleitorado, l.m.comparecimento, l.m.abstencao, l.m.validos, l.m.brancos, l.m.nulos,
    ...candidatos.flatMap((_, i) => [l.m.votos[i], csvPct(l.pct[i])]),
    ...(com1T ? candidatos.flatMap((_, i) => l.m.primeiroTurno && l.pct1T && l.ganhoPP
      ? [l.m.primeiroTurno.votos[i], csvPct(l.pct1T[i]), csvPct(l.ganhoPP[i])]
      : ["", "", ""]) : []),
  ].join(";"));
  const blob = new Blob([`﻿${[cabecalho.map(csvTexto).join(";"), ...corpo].join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = arquivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function TabelaMunicipios({
  linhas,
  candidatos,
  uf,
  termos,
  selecionado,
  onSelect,
}: {
  linhas: Linha[];
  candidatos: Candidato[];
  uf: ResultadoAbrangencia;
  termos: Termos;
  selecionado: string | null;
  onSelect: (cd: string | null) => void;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [ordem, setOrdem] = useState<{ coluna: Coluna; desc: boolean }>({ coluna: "eleitorado", desc: true });
  const [limite, setLimite] = useState(PAGINA);
  // Colunas para os dois mais votados na UF (no 2º turno, os dois finalistas).
  const colunas = uf.candidatos.slice(0, 2).map((c) => candidatos.findIndex((x) => x.numero === c.numero)).filter((i) => i >= 0);
  const com1T = linhas.some((l) => l.ganhoPP);
  const exterior = uf.scope === "zz";
  const feminino = termos === TERMOS.cidade;

  // O React Compiler memoiza estes cálculos.
  const vitorias = candidatos
    .map((c, i) => ({ c, i, n: linhas.filter((l) => l.lider === i).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  const viradas = linhas.filter((l) => l.virada).length;
  const filtradas = (() => {
    const q = semAcento(busca.trim());
    const lista = linhas.filter((l) => {
      if (q && !semAcento(l.m.nome).includes(q)) return false;
      if (filtro === "viradas") return l.virada;
      if (filtro !== "todos") return l.lider === Number(filtro.slice(1));
      return true;
    });
    return ordenar(lista, ordem.coluna, ordem.desc);
  })();
  const recorte = filtro !== "todos" || busca.trim() !== "";
  const total = filtradas.length ? somarLinhas(filtradas) : null;

  const mudarFiltro = (f: Filtro) => { setFiltro(f); setLimite(PAGINA); };

  const cabecalho = (coluna: Coluna, rotulo: string, extra: { alinhar?: string; rowSpan?: number; titulo?: string; className?: string } = {}) => {
    const ativa = ordem.coluna === coluna;
    const alinhar = extra.alinhar ?? "text-right";
    return (
      <th
        scope="col"
        rowSpan={extra.rowSpan}
        title={extra.titulo}
        aria-sort={ativa ? (ordem.desc ? "descending" : "ascending") : "none"}
        className={`px-2 py-2 align-bottom font-semibold whitespace-nowrap ${alinhar} ${extra.className ?? ""}`}
      >
        <button
          type="button"
          onClick={() => setOrdem({ coluna, desc: ativa ? !ordem.desc : coluna !== "nome" })}
          className={`inline-flex items-center gap-0.5 rounded hover:text-foreground ${ativa ? "text-foreground" : ""}`}
        >
          {rotulo}
          <span aria-hidden className={`inline-block w-2.5 text-[0.65rem] ${ativa ? "" : "opacity-0"}`}>{ordem.desc ? "▼" : "▲"}</span>
        </button>
      </th>
    );
  };

  const chip = (f: Filtro, rotulo: string, n: number, cor?: string) => (
    <button
      key={f}
      type="button"
      aria-pressed={filtro === f}
      onClick={() => mudarFiltro(filtro === f && f !== "todos" ? "todos" : f)}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        filtro === f ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted hover:text-foreground"
      }`}
    >
      {cor && <span className="inline-block size-2 rounded-full ring-1 ring-white/60" style={{ background: cor }} />}
      {rotulo}
      <span className={`tabular ${filtro === f ? "text-white/80" : "text-subtle"}`}>{fmtInt(n)}</span>
    </button>
  );

  // Fundo opaco nas células fixas: o conteúdo rola por baixo delas.
  const fixa = "sticky left-0 z-[1] bg-inherit";

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{termos.todos}</h3>
          <p className="text-xs text-muted">
            {recorte ? `${fmtInt(filtradas.length)} de ${fmtInt(linhas.length)} ${termos.plural}` : `${fmtInt(linhas.length)} ${termos.plural}`} · clique numa linha para ver o detalhe
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input
            type="search"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setLimite(PAGINA); }}
            placeholder={`Buscar ${termos.singular}`}
            aria-label={`Buscar ${termos.plural}`}
            className="min-w-0 flex-1 rounded-full border border-border bg-surface px-3 py-1.5 text-sm sm:w-60 sm:flex-none"
          />
          <button
            type="button"
            onClick={() => baixarCsv(`${exterior ? "cidades-exterior" : `municipios-${uf.scope}`}.csv`, filtradas, candidatos, termos)}
            disabled={filtradas.length === 0}
            title={`Baixar ${recorte ? "os resultados filtrados" : `todos os ${termos.plural}`} em CSV`}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-muted hover:text-foreground disabled:opacity-50"
          >
            ↓ CSV
          </button>
        </div>
      </div>

      <div role="group" aria-label="Filtrar" className="mb-3 flex flex-wrap gap-1.5">
        {chip("todos", "Todos", linhas.length)}
        {vitorias.map(({ c, i, n }) => chip(`v${i}`, `${primeiroNome(c.nome)} venceu`, n, c.cor))}
        {com1T && viradas > 0 && chip("viradas", "Viradas no 2º turno", viradas)}
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-lg border border-border">
        <table className="w-full border-separate border-spacing-0 text-sm tabular">
          <thead className="sticky top-0 z-[2] bg-surface text-xs text-muted shadow-[0_1px_0_var(--border)]">
            <tr>
              {cabecalho("nome", termos.coluna, { alinhar: "text-left", rowSpan: 2, className: `${fixa} bg-surface pl-3` })}
              {cabecalho("eleitorado", "Eleitores", { rowSpan: 2 })}
              <th scope="colgroup" colSpan={colunas.length} className="border-b border-border px-2 pt-2 pb-1 text-center font-semibold whitespace-nowrap">
                % dos válidos
              </th>
              {com1T && (
                <th scope="colgroup" colSpan={colunas.length} className="border-b border-border bg-track/50 px-2 pt-2 pb-1 text-center font-semibold whitespace-nowrap">
                  Ganho desde o 1º turno
                </th>
              )}
              {cabecalho("margem", "Vencedor", { rowSpan: 2, titulo: "Vantagem em p.p. sobre o 2º colocado" })}
              {cabecalho("comparecimento", "Comparec.", { rowSpan: 2, className: "pr-3" })}
            </tr>
            <tr>
              {colunas.map((i) => <Fragment key={i}>{cabecalho(`c${i}`, primeiroNome(candidatos[i].nome))}</Fragment>)}
              {com1T && colunas.map((i) => (
                <Fragment key={i}>{cabecalho(`g${i}`, primeiroNome(candidatos[i].nome), { className: "bg-track/50", titulo: `Variação de ${candidatos[i].nome} entre os turnos, em p.p. dos válidos e em votos` })}</Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.slice(0, limite).map((l) => {
              const sel = l.m.cd === selecionado;
              return (
                <tr
                  key={l.m.cd}
                  onClick={() => onSelect(sel ? null : l.m.cd)}
                  className={`cursor-pointer [&>td]:border-b [&>td]:border-border ${sel ? "bg-track" : "bg-surface hover:bg-track"}`}
                >
                  <td className={`${fixa} py-2 pr-2 pl-3 text-left ${sel ? "shadow-[inset_3px_0_0_var(--accent)]" : ""}`}>
                    {/* Sem onClick próprio: o clique sobe para a linha, e Enter no botão também. */}
                    <button type="button" aria-pressed={sel} className="max-w-[11rem] truncate text-left font-semibold hover:text-accent sm:max-w-none">
                      {l.m.nome}
                    </button>
                    {l.m.capital && <span className="ml-1.5 rounded bg-track px-1 py-0.5 align-middle text-[0.65rem] font-semibold text-muted uppercase">capital</span>}
                  </td>
                  <td className="px-2 py-2 text-right text-muted">{fmtInt(l.m.eleitorado)}</td>
                  {colunas.map((i) => (
                    <td key={i} className="px-2 py-2 text-right">
                      <div className={l.lider === i ? "font-semibold" : ""}>{fmtPct(l.pct[i])}</div>
                      <BarraPct pct={l.pct[i]} antes={l.pct1T?.[i]} cor={candidatos[i].cor} />
                    </td>
                  ))}
                  {com1T && colunas.map((i) => (
                    <td key={i} className="bg-track/30 px-2 py-2 text-right">
                      {l.ganhoPP && l.ganhoVotos ? <CelulaGanho pp={l.ganhoPP[i]} votos={l.ganhoVotos[i]} cor={candidatos[i].cor} /> : "–"}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    {l.lider === null ? "–" : (
                      <>
                        <div className="inline-flex items-center gap-1.5">
                          <span className="inline-block size-2.5 rounded-full" style={{ background: candidatos[l.lider].cor }} />
                          {primeiroNome(candidatos[l.lider].nome)}
                          <span className="rounded bg-track px-1 text-xs font-semibold">{fmtPP(l.margem, "")}</span>
                        </div>
                        {l.virada && <div className="text-xs font-semibold text-accent">virada</div>}
                      </>
                    )}
                  </td>
                  <td className="py-2 pr-3 pl-2 text-right">{fmtPct(l.pctComparecimento)}</td>
                </tr>
              );
            })}
          </tbody>
          {total && (
            <tfoot className="sticky bottom-0 z-[2] bg-surface font-semibold shadow-[0_-1px_0_var(--border)]">
              <tr className="bg-surface">
                <th scope="row" className={`${fixa} py-2 pr-2 pl-3 text-left`}>
                  {recorte ? `Soma dos ${fmtInt(filtradas.length)} filtrad${feminino ? "as" : "os"}` : exterior ? "Total do exterior" : `Total de ${scopeName(uf.scope)}`}
                </th>
                <td className="px-2 py-2 text-right">{fmtInt(total.m.eleitorado)}</td>
                {colunas.map((i) => (
                  <td key={i} className="px-2 py-2 text-right">
                    {fmtPct(total.pct[i])}
                    <BarraPct pct={total.pct[i]} antes={total.pct1T?.[i]} cor={candidatos[i].cor} />
                  </td>
                ))}
                {com1T && colunas.map((i) => (
                  <td key={i} className="bg-track/30 px-2 py-2 text-right">
                    {total.ganhoPP && total.ganhoVotos ? <CelulaGanho pp={total.ganhoPP[i]} votos={total.ganhoVotos[i]} cor={candidatos[i].cor} /> : "–"}
                  </td>
                ))}
                <td className="px-2 py-2 text-right whitespace-nowrap">
                  {total.lider !== null && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block size-2.5 rounded-full" style={{ background: candidatos[total.lider].cor }} />
                      {primeiroNome(candidatos[total.lider].nome)}
                      <span className="rounded bg-track px-1 text-xs">{fmtPP(total.margem, "")}</span>
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 pl-2 text-right">{fmtPct(total.pctComparecimento)}</td>
              </tr>
            </tfoot>
          )}
        </table>
        {filtradas.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted">
            {termos.nenhum} encontrad{feminino ? "a" : "o"}{busca.trim() ? ` para “${busca.trim()}”` : ""}.{" "}
            <button type="button" onClick={() => { setBusca(""); mudarFiltro("todos"); }} className="font-semibold text-accent hover:underline">
              Limpar busca e filtros
            </button>
          </div>
        )}
      </div>

      {filtradas.length > limite && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm">
          <span className="text-muted">Mostrando {fmtInt(limite)} de {fmtInt(filtradas.length)}</span>
          <button type="button" onClick={() => setLimite((n) => n + 50)} className="font-semibold text-accent hover:underline">Mostrar mais 50</button>
          <button type="button" onClick={() => setLimite(filtradas.length)} className="font-semibold text-accent hover:underline">Mostrar todos</button>
        </div>
      )}
      <ul className="mt-3 space-y-0.5 text-xs text-muted">
        <li>Vencedor: vantagem em pontos percentuais sobre o 2º colocado.</li>
        {com1T && (
          <>
            <li>
              Ganho desde o 1º turno: variação do % dos válidos e dos votos de cada finalista. Os dois costumam subir, porque herdam
              os votos dos candidatos eliminados; na barra de %, a marca escura indica onde cada um estava no 1º turno.
            </li>
            <li>Virada: o finalista que estava à frente no 1º turno perdeu {feminino ? "a cidade" : "o município"} no 2º.</li>
          </>
        )}
      </ul>
    </div>
  );
}
