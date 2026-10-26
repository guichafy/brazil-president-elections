"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { desbloquearAudio, pararSom, somFeliz, somTriste } from "@/lib/sons";
import { estiloCss } from "./BrazilMap";

// Ajuda aberta apenas pelo botão "Como funciona?"; nunca bloqueia uma primeira visita.

const COR_LULA = "#D60828";
const COR_FLAVIO = "#272D97";

export function useOnboarding() {
  const [aberto, setAberto] = useState(false);
  return {
    aberto,
    revendo: true,
    rever: useCallback(() => setAberto(true), []),
    fechar: useCallback(() => setAberto(false), []),
    concluir: useCallback(() => setAberto(false), []),
  };
}

type Teste = "lula" | "bolsonaro";

export default function Onboarding({
  podeFechar,
  onFechar,
  onConcluir,
}: {
  podeFechar: boolean;
  onFechar: () => void;
  onConcluir: (comSom: boolean) => void;
}) {
  const [passo, setPasso] = useState(0);
  const [ouvidos, setOuvidos] = useState<ReadonlySet<Teste>>(new Set());
  const [bloqueado, setBloqueado] = useState(false);
  const tituloId = useId();
  const painel = useRef<HTMLDivElement>(null);

  // trava a rolagem da página de trás; ao sair, corta o áudio de teste (eles duram 15–22s)
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
      pararSom();
    };
  }, []);

  // a cada passo, teclado e leitor de tela recomeçam do topo
  useEffect(() => {
    painel.current?.focus();
    painel.current?.scrollTo({ top: 0 });
  }, [passo]);

  const ir = (n: number) => {
    pararSom();
    setPasso(n);
  };

  const testar = async (t: Teste) => {
    // libera o áudio antes de tocar: o listener global da página pode ainda não ter terminado
    const ok = await desbloquearAudio();
    setBloqueado(!ok);
    (t === "lula" ? somFeliz : somTriste)();
    setOuvidos((s) => new Set(s).add(t));
  };

  const ouviuTudo = ouvidos.size === 2;
  const passos: { titulo: string; conteudo: ReactNode; trava?: string }[] = [
    { titulo: "Como explorar a apuração", conteudo: <BoasVindas /> },
    { titulo: "Como ler o placar", conteudo: <ComoLerPlacar /> },
    { titulo: "Mapa e linha do tempo", conteudo: <MapaELinha /> },
    {
      titulo: "Ouça os dois alertas",
      conteudo: <Sons ouvidos={ouvidos} bloqueado={bloqueado} onTestar={testar} />,
      trava: ouviuTudo ? undefined : "Toque nos dois áudios para continuar",
    },
    { titulo: "Tudo pronto", conteudo: <Pronto onConcluir={onConcluir} /> },
  ];
  const atual = passos[passo];
  const ultimo = passo === passos.length - 1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onKeyDown={(e) => podeFechar && e.key === "Escape" && onFechar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
      >
        <div className="bg-accent px-5 pt-3 pb-4 text-white">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider opacity-90">
            <span>
              Como acompanhar · passo {passo + 1} de {passos.length}
            </span>
            {podeFechar && (
              <button type="button" onClick={onFechar} className="rounded px-1 text-base hover:bg-white/20" aria-label="Fechar guia">
                ✕
              </button>
            )}
          </div>
          <div className="mt-2 flex gap-1">
            {passos.map((p, i) => (
              <span key={p.titulo} className={`h-1 flex-1 rounded-full ${i <= passo ? "bg-white" : "bg-white/30"}`} />
            ))}
          </div>
          <h2 id={tituloId} className="mt-3 text-xl font-bold">
            {atual.titulo}
          </h2>
        </div>

        <div ref={painel} tabIndex={-1} className="flex-1 overflow-y-auto px-5 py-4 text-sm outline-none">
          {atual.conteudo}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <div className="flex shrink-0 flex-col items-start gap-1 whitespace-nowrap sm:flex-row sm:items-center sm:gap-4">
            {passo > 0 && (
              <button type="button" onClick={() => ir(passo - 1)} className="text-sm font-semibold text-muted hover:text-foreground">
                ← Voltar
              </button>
            )}
            {/* na 1ª visita dá para pular de qualquer passo; revendo, o ✕ já faz isso.
                Pular conclui com som: o clique já serve de gesto para liberar o áudio no navegador */}
            {!ultimo && !podeFechar && (
              <button
                type="button"
                onClick={() => onConcluir(true)}
                className="text-xs font-semibold text-muted underline underline-offset-2 hover:text-foreground"
              >
                Pular tutorial
              </button>
            )}
          </div>
          {!ultimo && (
            <div className="flex items-center gap-3">
              {atual.trava && <span className="text-right text-xs text-muted">{atual.trava}</span>}
              <button
                type="button"
                onClick={() => ir(passo + 1)}
                disabled={!!atual.trava}
                className="shrink-0 rounded-full bg-accent px-5 py-2 text-sm font-bold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
              >
                Próximo →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Item({ icone, children }: { icone: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 text-lg leading-5" aria-hidden="true">
        {icone}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Exemplo({ children }: { children: ReactNode }) {
  return (
    <div className="relative mb-4 rounded-lg border border-border bg-background p-3" aria-hidden="true">
      <span className="absolute -top-2 right-2 rounded bg-surface px-1.5 text-[10px] font-bold uppercase tracking-wider text-subtle">
        Exemplo
      </span>
      {children}
    </div>
  );
}

function Selo({ cor, children }: { cor?: string; children: ReactNode }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${cor ? "text-white" : "bg-amber-100 text-amber-900"}`}
      style={cor ? { background: cor } : undefined}
    >
      {children}
    </span>
  );
}

function BoasVindas() {
  return (
    <ul className="space-y-3">
      <Item icone="📡">
        Os números são do <b>TSE</b>: todas as urnas já foram apuradas. O resultado e o histórico estão preservados neste site.
      </Item>
      <Item icone="🔔">
        Explore os momentos da apuração pelo <b>slider do histórico</b>. O placar, o mapa e o gráfico acompanham sua seleção.
      </Item>
      <Item icone="👆">
        São quatro passos rápidos para você saber ler cada parte da página e ouvir os alertas. Leva menos de um minuto.
      </Item>
    </ul>
  );
}

function BarraDupla({ pctEsq, altura, fraca }: { pctEsq: number; altura: string; fraca?: boolean }) {
  return (
    <div className={`flex w-full overflow-hidden rounded-full ${altura} ${fraca ? "opacity-50" : ""}`}>
      <div style={{ width: `${pctEsq}%`, background: COR_LULA }} />
      <div className="flex-1" style={{ background: COR_FLAVIO }} />
    </div>
  );
}

function ComoLerPlacar() {
  return (
    <>
      <Exemplo>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold">Lula</div>
            <div className="text-2xl leading-tight font-bold tabular">50,8%</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold">Flávio Bolsonaro</div>
            <div className="text-2xl leading-tight font-bold tabular">49,2%</div>
          </div>
        </div>
        <div className="relative mt-2">
          <BarraDupla pctEsq={50.8} altura="h-3" />
          <BarraDupla pctEsq={51.6} altura="mt-1 h-1.5" fraca />
          <div className="absolute -top-1 left-1/2 h-[calc(100%+0.5rem)] border-l-2 border-dashed border-foreground/70" />
        </div>
        <div className="mt-1 text-center text-[11px] font-semibold text-muted">50%</div>
      </Exemplo>
      <ul className="space-y-3">
        <Item icone="▬">
          <b>Barra grossa:</b> quanto cada um tem agora, em % dos votos válidos.
        </Item>
        <Item icone="▭">
          <b>Barra fina:</b> durante a apuração, mostrava a projeção deste site para 100% das urnas. Era uma estimativa, não resultado
          oficial.
        </Item>
        <Item icone="┆">
          <b>Linha tracejada:</b> os 50%. Quem terminar acima dela vence.
        </Item>
        <Item icone="🏷️">
          <span className="block">O selo ao lado do % de urnas resume a situação:</span>
          <span className="mt-1.5 flex flex-col gap-1.5">
            <span>
              <Selo>Cedo para tendência</Selo> poucos votos apurados ainda
            </span>
            <span>
              <Selo>Indefinido</Selo> a projeção muda de lado conforme o método
            </span>
            <span>
              <Selo cor={COR_LULA}>Tendência: Lula vence</Selo> a projeção aponta um vencedor
            </span>
            <span>
              <Selo cor={COR_FLAVIO}>✓ Venceu (matematicamente)</Selo> a vantagem já é maior que os votos que faltam
            </span>
          </span>
        </Item>
      </ul>
    </>
  );
}

function Uf({ sigla, pct, estilo }: { sigla: string; pct: string; estilo: CSSProperties }) {
  return (
    <span className="relative flex w-12 flex-col overflow-hidden rounded py-0.5 text-center leading-tight">
      <span className="absolute inset-0" style={estilo} />
      <span className="relative flex flex-col text-white" style={{ textShadow: "0 0 2px rgba(0,0,0,.8), 0 0 1px rgba(0,0,0,.8)" }}>
        <span className="text-xs font-bold">{sigla}</span>
        <span className="text-[10px] font-semibold tabular">{pct}</span>
      </span>
    </span>
  );
}

function MapaELinha() {
  return (
    <>
      <Exemplo>
        <div className="flex flex-col gap-2 text-xs">
          <span className="flex items-center gap-3">
            <Uf sigla="✓ BA" pct="92%" estilo={estiloCss({ tipo: "solido", cor: COR_LULA, opacity: 1 })} />
            <span>
              <b>Cor sólida com ✓:</b> vitória garantida no estado. A vantagem é maior que os eleitores das urnas que faltam.
            </span>
          </span>
          <span className="flex items-center gap-3">
            <Uf sigla="SP" pct="61%" estilo={estiloCss({ tipo: "listrado", cor: COR_FLAVIO })} />
            <span>
              <b>Listrado:</b> está liderando, mas ainda pode virar.
            </span>
          </span>
          <span className="flex items-center gap-3">
            <Uf sigla="RR" pct="–" estilo={estiloCss({ tipo: "vazio" })} />
            <span>
              <b>Cinza:</b> ainda sem votos apurados.
            </span>
          </span>
        </div>
      </Exemplo>
      <ul className="space-y-3">
        <Item icone="👆">
          <b>Clique num estado</b>, no mapa ou na grade de siglas, para ver o placar e a linha do tempo só dele. &quot;Voltar
          para Brasil&quot; retorna ao resultado nacional.
        </Item>
        <Item icone="🎨">
          Em &quot;Colorir por&quot;, troque &quot;Líder&quot; por um candidato: quanto mais forte a cor, maior o % dele no estado.
        </Item>
        <Item icone="📈">
          <span className="block">
            A <b>linha do tempo</b> mostra como o % de cada um mudou conforme as urnas foram apuradas. O tracejado é a projeção histórica,
            e as abas comparam com o 1º turno e com 2022.
          </span>
          <svg viewBox="0 0 200 50" className="mt-2 h-12 w-full max-w-60" aria-hidden="true">
            <line x1="0" y1="25" x2="200" y2="25" stroke="var(--border)" />
            <polyline points="0,40 40,34 80,30 120,24 160,20 200,18" fill="none" stroke={COR_LULA} strokeWidth="2.5" />
            <polyline points="0,10 40,16 80,20 120,26 160,30 200,32" fill="none" stroke={COR_FLAVIO} strokeWidth="2.5" />
          </svg>
        </Item>
      </ul>
    </>
  );
}

function Sons({
  ouvidos,
  bloqueado,
  onTestar,
}: {
  ouvidos: ReadonlySet<Teste>;
  bloqueado: boolean;
  onTestar: (t: Teste) => void;
}) {
  const cartoes: { t: Teste; titulo: string; cor: string; regra: ReactNode }[] = [
    {
      t: "lula",
      titulo: "Áudio do Lula",
      cor: COR_LULA,
      regra: (
        <>
          Durante a apuração, tocava quando <b>Lula ganhava votos e subia no %</b> e <b>Flávio caía</b>. Aqui você pode testar o áudio.
        </>
      ),
    },
    {
      t: "bolsonaro",
      titulo: "Áudio do Bolsonaro",
      cor: COR_FLAVIO,
      regra: (
        <>
          Durante a apuração, tocava quando <b>Lula caía no %</b> e <b>Flávio subia</b>. Aqui você pode testar o áudio.
        </>
      ),
    },
  ];
  return (
    <>
      <p className="mb-3">Estes eram os alertas da apuração ao vivo. Os testes de som continuam disponíveis. Toque nos dois para conhecê-los:</p>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {cartoes.map((c) => {
          const ouvido = ouvidos.has(c.t);
          return (
            <div key={c.t} className="overflow-hidden rounded-lg border border-border">
              <div className="h-1" style={{ background: c.cor }} />
              <div className="flex h-full flex-col gap-2 p-3">
                <div className="flex items-center justify-between gap-2 font-semibold">
                  {c.titulo}
                  {ouvido && <span className="text-xs text-green-700">✓ ouvido</span>}
                </div>
                <p className="flex-1 text-xs text-muted">{c.regra}</p>
                <button
                  type="button"
                  onClick={() => onTestar(c.t)}
                  aria-label={`${ouvido ? "Ouvir de novo o" : "Ouvir o"} ${c.titulo.toLowerCase()}`}
                  className="rounded-full px-3 py-2 text-sm font-bold text-white hover:opacity-90"
                  style={{ background: c.cor }}
                >
                  {ouvido ? "↻ Ouvir de novo" : "▶ Ouvir"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {bloqueado && (
        <p className="mb-3 rounded-lg border border-accent/40 bg-accent/10 p-2 text-xs">
          O navegador não liberou o som. Você pode continuar e ativá-lo depois pelo botão 🔔 no topo da página.
        </p>
      )}
      <ul className="space-y-3">
        <Item icone="🤐">Os alertas acompanhavam só o Brasil. Com o resultado encerrado, não há novos alertas de variação.</Item>
        <Item icone="💬">
          A comemoração da vitória continua disponível, assim como os botões de teste dos áudios no topo da página.
        </Item>
        <Item icone="📱">No iPhone, desligue o modo silencioso (a chave na lateral) e aumente o volume.</Item>
      </ul>
    </>
  );
}

function Pronto({ onConcluir }: { onConcluir: (comSom: boolean) => void }) {
  return (
    <>
      <p className="mb-4">Como você quer explorar o resultado?</p>
      <div className="mb-4 grid gap-2">
        <button
          type="button"
          onClick={() => onConcluir(true)}
          className="rounded-xl bg-accent px-4 py-3 text-left font-bold text-white hover:bg-accent-strong"
        >
          🔔 Explorar com som
          <span className="block text-xs font-normal opacity-90">Comemoração e testes dos áudios da apuração</span>
        </button>
        <button
          type="button"
          onClick={() => onConcluir(false)}
          className="rounded-xl border border-border px-4 py-3 text-left font-bold hover:bg-track"
        >
          🔕 Explorar sem som
          <span className="block text-xs font-normal text-muted">Comemoração apenas na tela</span>
        </button>
      </div>
      <ul className="space-y-3 text-muted">
        <Item icone="🔔">Dá para mudar a qualquer momento no botão de som do topo. 🙂 e 🙁 ao lado dele repetem os áudios.</Item>
        <Item icone="❓">Para rever este guia, use &quot;Como funciona?&quot; no topo da página.</Item>
      </ul>
    </>
  );
}
