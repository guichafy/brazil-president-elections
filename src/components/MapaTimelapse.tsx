"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { geoIdentity, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import brasil from "@/data/brasil-ufs.json";
import { atualizacoesEstaduais, fatiasVotos, interpolarFatias, MAPA_VIEWBOX, posicionarAtualizacoes, setorPizza, marcadoresSemColisao, type AtualizacaoEstadual } from "@/lib/mapa-timelapse";
import { fmtInt, fmtPct } from "@/lib/format";
import { UFS, scopeName, type Scope, type UF } from "@/lib/ufs";
import type { ApuracaoResponse } from "@/lib/types";
import styles from "./MapaTimelapse.module.css";
import { useChamadasFixas } from "./useChamadasFixas";

type UfFeature = Feature<Geometry, { uf:UF }>;
const geo = brasil as unknown as FeatureCollection<Geometry, { uf:UF }>;
const proj = geoIdentity().reflectY(true).fitExtent([[270,70],[970,825]],geo);
const path = geoPath(proj);
const shapes = geo.features.map((f:UfFeature) => {
  const [x,y] = path.centroid(f), [[x0,y0],[x1,y1]] = path.bounds(f);
  return { uf:f.properties.uf, d:path(f)??"", x, y, limites:{x:x0,y:y0,largura:x1-x0,altura:y1-y0}, raio:Math.hypot(x1-x0,y1-y0)+1 };
});
const marcadores = marcadoresSemColisao(shapes);
const COR:Record<string,string> = { "13":"#ef3340", "22":"#6269ef" };
type Reacao = AtualizacaoEstadual & { versao: number; instante:string };
type Reacoes = Partial<Record<UF, Reacao>>;
const variacao = (votos: number) => `${votos >= 0 ? "+" : "−"}${fmtInt(Math.abs(votos))}`;
const horario = new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit",second:"2-digit"});

function useFatiasAnimadas(ufs: ApuracaoResponse["ufs"]) {
  const alvos = useMemo(() => shapes.map(s => fatiasVotos(ufs[s.uf])), [ufs]);
  const [fatias, setFatias] = useState(alvos);
  const exibidas = useRef(alvos);
  const anteriores = useRef(ufs);
  const versao = useRef(0);
  const recentes = useRef<Reacoes>({});
  const [reacoes, setReacoes] = useState<Reacoes>({});
  const [mudancas, setMudancas] = useState<AtualizacaoEstadual[]>([]);
  const [fonte,setFonte] = useState(ufs);
  useEffect(() => {
    const origem = exibidas.current;
    const atualizacoes = atualizacoesEstaduais(anteriores.current, ufs);
    const rodada = ++versao.current;
    const proximasReacoes = { ...recentes.current };
    for (const atualizacao of atualizacoes) proximasReacoes[atualizacao.uf] = { ...atualizacao, versao: rodada, instante:ufs[atualizacao.uf]!.isoDataHora };
    const inicio = performance.now();
    const movimento = window.matchMedia("(prefers-reduced-motion: reduce)");
    let quadro: number;
    let primeiro = true;
    const desenhar = (agora: number) => {
      if (primeiro) {
        anteriores.current = ufs;
        recentes.current = proximasReacoes;
        setReacoes(proximasReacoes);
        setMudancas(atualizacoes);
        setFonte(ufs);
        primeiro = false;
      }
      const t = movimento.matches ? 1 : Math.min(1, (agora - inicio) / 650);
      const proximas = t === 1 ? alvos : alvos.map((f, i) => interpolarFatias(origem[i], f, t));
      exibidas.current = proximas;
      setFatias(proximas);
      if (t < 1) quadro = requestAnimationFrame(desenhar);
    };
    quadro = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(quadro);
  }, [alvos, ufs]);
  return { fatias, reacoes, mudancas, fonte };
}

export default function MapaTimelapse({ apuracao, scope, onSelect, pausado=false, revisaoNavegacao=0 }: {
  apuracao:ApuracaoResponse;
  scope:Scope;
  onSelect:(s:Scope)=>void;
  pausado?:boolean;
  revisaoNavegacao?:number;
}) {
  const id = useId().replace(/:/g,"");
  const area = useRef<HTMLDivElement>(null);
  const desenho = useRef<SVGSVGElement>(null);
  const seletor = useRef<HTMLSelectElement>(null);
  const [medidas,setMedidas] = useState({ largura:0, altura:0, mapa:{x:0,y:0,largura:0,altura:0} });
  const { fatias: fatiasAnimadas, reacoes, mudancas, fonte } = useFatiasAnimadas(apuracao.ufs);
  const atualizados = new Set(mudancas.map(m => m.uf));
  const candidatos = apuracao.nacional?.candidatos.filter(c=>c.numero==="13"||c.numero==="22")??[];
  const detalhe = scope==="zz" ? apuracao.exterior : scope==="br" ? null : apuracao.ufs[scope];
  const selecionar = (uf:Scope) => onSelect(scope===uf ? "br" : uf);
  const limite = medidas.largura >= 1040 && medidas.altura >= 420 ? 3 : medidas.largura >= 740 ? 2 : 1;
  const duracaoChamada = medidas.largura >= 740 ? 6000 : 3000;
  const larguraChamada = Math.max(0, Math.min(340, medidas.largura - 24));
  const candidatas=useMemo(()=>Object.values(reacoes).filter(r=>r.candidatos.some(c=>c.deltaVotos!==0)),[reacoes]);
  const grupo = useChamadasFixas(candidatas,fonte===apuracao.ufs,limite,duracaoChamada,pausado,revisaoNavegacao);
  const chamadas = posicionarAtualizacoes(grupo.map(r=>shapes.find(s=>s.uf===r.uf)!), medidas, {largura:larguraChamada,altura:196}, {mapa:medidas.mapa,evitar:shapes.map(s=>s.limites)});

  useEffect(() => {
    const medir = () => {
      if (!area.current || !desenho.current) return;
      const a=area.current.getBoundingClientRect();
      const d=desenho.current.getBoundingClientRect();
      const proxima={ largura:a.width, altura:a.height, mapa:{x:d.left-a.left,y:d.top-a.top,largura:d.width,altura:d.height} };
      setMedidas(anterior=>JSON.stringify(anterior)===JSON.stringify(proxima) ? anterior : proxima);
    };
    const observer = new ResizeObserver(medir);
    observer.observe(area.current!);
    observer.observe(desenho.current!);
    return () => observer.disconnect();
  },[]);

  return (
    <section aria-label="Explorar a votação por estado" className={styles.exploracao} data-detalhe={!!detalhe}>
      <div className={styles.cabecalho}>
        <div>
          <h3 className="text-base font-bold sm:text-lg">A apuração pelo Brasil</h3>
          <p id={`${id}-instrucao`} className="text-white/65">Chamadas fixas para leitura; mapa e música continuam.</p>
        </div>
        <label className={styles.seletor}>
          <span className="sr-only">Escolher estado</span>
          <select ref={seletor} value={scope} onChange={e=>onSelect(e.target.value as Scope)}>
            <option value="br">Escolher estado</option>
            {Object.keys(UFS).map(uf=><option key={uf} value={uf}>{UFS[uf as UF]}</option>)}
            <option value="zz">Exterior</option>
          </select>
        </label>
      </div>

      <div className={styles.quadro}>
        <div ref={area} role="region" aria-label="Mapa do Brasil com votos por estado" aria-describedby={`${id}-instrucao`} className={styles.area}>
          <svg ref={desenho} viewBox={`${MAPA_VIEWBOX.x} ${MAPA_VIEWBOX.y} ${MAPA_VIEWBOX.largura} ${MAPA_VIEWBOX.altura}`} preserveAspectRatio="xMidYMid meet" className={styles.mapa} role="group" aria-label="Mapa animado da votação proporcional por estado">
            <defs>
              {shapes.map(s=><clipPath key={s.uf} id={`${id}-uf-${s.uf}`}><path d={s.d}/></clipPath>)}
            </defs>

            {shapes.map((s, i)=>{
              const r=apuracao.ufs[s.uf], fatias=fatiasAnimadas[i], ativo=scope===s.uf;
              const descricao=`${UFS[s.uf]}: ${fmtPct(r?.pctTotalizado??0)} apurado; ${candidatos.map(c=>{const d=r?.candidatos.find(x=>x.numero===c.numero);return `${c.nome}, ${fmtInt(d?.votos??0)} votos, ${fmtPct(d?.pct??0)} dos válidos`;}).join("; ")}`;
              return <g key={s.uf} role="button" tabIndex={0} aria-label={descricao} aria-pressed={ativo} aria-controls={ativo ? `${id}-detalhe` : undefined} className={styles.estado} data-selecionado={ativo} data-atualizado={atualizados.has(s.uf)} onClick={()=>selecionar(s.uf)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selecionar(s.uf);}}}>
                <g clipPath={`url(#${id}-uf-${s.uf})`}>
                  <path d={s.d} fill="#7f9489"/>
                  {fatias.map(f=><path key={f.numero} d={setorPizza(s.x,s.y,s.raio,f.inicio,f.fracao)} fill={COR[f.numero]}/>)}
                </g>
                <path d={s.d} fill="none" className={styles.contorno} vectorEffect="non-scaling-stroke"/>
                {atualizados.has(s.uf) && <path key={`reacao-${reacoes[s.uf]?.versao}`} d={s.d} fill="none" className={styles.reacaoEstado} vectorEffect="non-scaling-stroke" aria-hidden="true" />}
                <title>{descricao}</title>
              </g>;
            })}

            {marcadores.map((s, i)=>{
              const fatias=fatiasAnimadas[i], ativo=scope===s.uf;
              return <g key={`pizza-${s.uf}`} transform={`translate(${s.x},${s.y})`} pointerEvents="none" aria-hidden="true">
                <circle r={s.raio+1} fill={ativo ? "#FFDF00" : "#d4e8dc"}/>
                {atualizados.has(s.uf) && <circle key={`pulso-${reacoes[s.uf]?.versao}`} r={s.raio+5} fill="none" className={styles.pulsoEstado} />}
                {fatias.map(f=><path key={f.numero} d={setorPizza(0,0,s.raio,f.inicio,f.fracao)} fill={COR[f.numero]}/>)}
                {s.rotulo && <text x={s.rotulo.x-s.x} y={s.rotulo.y-s.y+4} textAnchor="middle" fill={ativo ? "#FFDF00" : "white"} stroke="#052f18" strokeWidth={3} paintOrder="stroke" fontSize={12} fontWeight={800}>{s.uf.toUpperCase()}</text>}
              </g>;
            })}
          </svg>
          <svg className={styles.conectoresAutomaticos} viewBox={`0 0 ${medidas.largura} ${medidas.altura}`} aria-hidden="true">
            {chamadas.map(c=><g key={c.uf}>
              <path d={`M ${c.ancora.x} ${c.ancora.y} L ${c.ponta.x} ${c.ponta.y}`} fill="none" stroke="#052f18" strokeWidth={5}/>
              <path d={`M ${c.ancora.x} ${c.ancora.y} L ${c.ponta.x} ${c.ponta.y}`} fill="none" stroke="#FFDF00" strokeWidth={1.5}/>
              <circle cx={c.ancora.x} cy={c.ancora.y} r={5} fill="#FFDF00" stroke="#052f18" strokeWidth={2}/>
            </g>)}
          </svg>
          {chamadas.map(c=>{
            const r=grupo.find(r=>r.uf===c.uf)!;
            return <div key={c.uf} role="region" aria-label={`Atualização automática de ${UFS[c.uf]}`} data-uf={c.uf} className={styles.chamadaAutomatica} style={{left:c.x,top:c.y,width:larguraChamada,height:196}}>
              <strong className={styles.tituloChamada} title={UFS[c.uf]}>{c.uf.toUpperCase()} · {UFS[c.uf]}</strong>
              <p className={styles.legendaChamada}>Antes → Depois · registro das {horario.format(new Date(r.instante))}</p>
              {r.candidatos.map(candidato=><div key={candidato.numero} className={styles.candidatoChamada}>
                <div className={styles.nomeChamada}><strong style={{color:candidato.numero==="13" ? "#ffb6bd" : "#c5c9ff"}}>{candidato.numero==="13" ? "Lula" : "Flávio Bolsonaro"}</strong><span>{variacao(candidato.deltaVotos)}</span></div>
                <div className={styles.votosChamada}><span>{fmtInt(candidato.antes.votos)}</span><span aria-hidden="true">→</span><strong>{fmtInt(candidato.agora.votos)}</strong></div>
              </div>)}
            </div>;
          })}
        </div>

        {detalhe && <div id={`${id}-detalhe`} role="region" aria-label={`Detalhes de ${scopeName(scope)}`} className={styles.detalhe}>
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs text-white/60">{scope==="zz" ? "Votos no exterior" : scope.toUpperCase()}</p><h4 className="mt-0.5 text-lg font-bold">{scopeName(scope)}</h4></div>
            <button type="button" aria-label="Fechar detalhes do estado" onClick={()=>{onSelect("br");seletor.current?.focus();}} className={styles.fechar}>✕</button>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-white/75"><span>Urnas apuradas</span><strong className="tabular text-[#FFDF00]">{fmtPct(detalhe.pctTotalizado)}</strong></div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[#FFDF00]" style={{width:`${Math.max(0,Math.min(100,detalhe.pctTotalizado))}%`}}/></div>
          </div>
          <div className="mt-4 space-y-3">
            {["13","22"].map(n=>{
              const c=detalhe.candidatos.find(c=>c.numero===n), foto=c?.foto??candidatos.find(c=>c.numero===n)?.foto;
              return <div key={n} className={styles.candidato}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {foto && <img src={foto} alt="" className="size-9 rounded-full object-cover" style={{border:`2px solid ${COR[n]}`}}/>}
                <div className="min-w-0 flex-1"><p className="text-xs font-semibold">{n==="13" ? "Lula" : "Flávio Bolsonaro"}</p><p className="mt-1 text-xs text-white/65 tabular">{fmtInt(c?.votos??0)} votos</p></div>
                <strong className="text-lg font-bold tabular" style={{color:n==="13" ? "#ffb6bd" : "#c5c9ff"}}>{fmtPct(c?.pct??0)}</strong>
              </div>;
            })}
          </div>
          <p className="mt-4 border-t border-white/15 pt-3 text-[11px] text-white/65 tabular">{fmtInt(detalhe.validos)} votos válidos neste momento.</p>
        </div>}
      </div>
      <div className={styles.rodape}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/80" aria-label="Legenda dos candidatos">
          {["13","22"].map(n=><span key={n} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{background:COR[n]}}/>{n==="13" ? "Lula" : "Flávio Bolsonaro"}</span>)}
          <span className="text-white/55">Proporção dos votos válidos</span>
        </div>
        {scope!=="zz" && apuracao.exterior && <button type="button" onClick={()=>onSelect("zz")} className="text-xs text-white/75 underline underline-offset-4 hover:text-[#FFDF00] focus-visible:outline-2 focus-visible:outline-[#FFDF00]">Ver votos do exterior</button>}
      </div>
    </section>
  );
}
