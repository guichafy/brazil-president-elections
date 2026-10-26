"use client";

import { useEffect, useId, useRef, useState } from "react";
import { geoIdentity, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import brasil from "@/data/brasil-ufs.json";
import { fatiasVotos, MAPA_VIEWBOX, posicionarChamada, setorPizza, marcadoresSemColisao } from "@/lib/mapa-timelapse";
import { fmtInt, fmtPct } from "@/lib/format";
import { UFS, scopeName, type Scope, type UF } from "@/lib/ufs";
import type { ApuracaoResponse } from "@/lib/types";
import styles from "./MapaTimelapse.module.css";

type UfFeature = Feature<Geometry, { uf:UF }>;
const geo = brasil as unknown as FeatureCollection<Geometry, { uf:UF }>;
const proj = geoIdentity().reflectY(true).fitExtent([[270,70],[970,825]],geo);
const path = geoPath(proj);
const shapes = geo.features.map((f:UfFeature) => {
  const [x,y] = path.centroid(f), [[x0,y0],[x1,y1]] = path.bounds(f);
  return { uf:f.properties.uf, d:path(f)??"", x, y, raio:Math.hypot(x1-x0,y1-y0)+1 };
});
const marcadores = marcadoresSemColisao(shapes);
const COR:Record<string,string> = { "13":"#ef3340", "22":"#6269ef" };

export default function MapaTimelapse({ apuracao, scope, onSelect }: {
  apuracao:ApuracaoResponse;
  scope:Scope;
  onSelect:(s:Scope)=>void;
}) {
  const id = useId().replace(/:/g,"");
  const area = useRef<HTMLDivElement>(null);
  const cartao = useRef<HTMLDivElement>(null);
  const seletor = useRef<HTMLSelectElement>(null);
  const [medidas,setMedidas] = useState({ largura:0, altura:0, cartaoAltura:320 });
  const candidatos = apuracao.nacional?.candidatos.filter(c=>c.numero==="13"||c.numero==="22")??[];
  const detalhe = scope==="zz" ? apuracao.exterior : scope==="br" ? null : apuracao.ufs[scope];
  const estado = shapes.find(s=>s.uf===scope);
  const chamada = estado && medidas.largura ? posicionarChamada(estado,medidas,{ largura:288, altura:medidas.cartaoAltura }) : null;
  const selecionar = (uf:Scope) => onSelect(scope===uf ? "br" : uf);

  useEffect(() => {
    const medir = () => {
      if (!area.current) return;
      const a=area.current.getBoundingClientRect(), c=cartao.current?.getBoundingClientRect();
      const proxima={ largura:a.width, altura:a.height, cartaoAltura:c?.height??320 };
      setMedidas(anterior=>Object.keys(proxima).every(k=>proxima[k as keyof typeof proxima]===anterior[k as keyof typeof anterior]) ? anterior : proxima);
    };
    const observer = new ResizeObserver(medir);
    observer.observe(area.current!);
    if (cartao.current) observer.observe(cartao.current);
    return () => observer.disconnect();
  },[scope]);

  return (
    <section aria-label="Explorar a votação por estado">
      <div className={styles.cabecalho}>
        <div>
          <h3 className="text-base font-bold sm:text-lg">A apuração pelo Brasil</h3>
          <p id={`${id}-instrucao`} className="mt-1 text-xs text-white/70 sm:text-sm">Clique em um estado para acompanhar seus votos.</p>
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

      <div className={styles.quadro} data-chamada-flutuante={medidas.altura>=medidas.cartaoAltura+32}>
        <div ref={area} role="region" aria-label="Mapa do Brasil com votos por estado" aria-describedby={`${id}-instrucao`} className={styles.area}>
          <svg viewBox={`${MAPA_VIEWBOX.x} ${MAPA_VIEWBOX.y} ${MAPA_VIEWBOX.largura} ${MAPA_VIEWBOX.altura}`} preserveAspectRatio="xMidYMid meet" className={styles.mapa} role="group" aria-label="Mapa animado da votação proporcional por estado">
            <defs>
              {shapes.map(s=><clipPath key={s.uf} id={`${id}-uf-${s.uf}`}><path d={s.d}/></clipPath>)}
            </defs>

            {shapes.map(s=>{
              const r=apuracao.ufs[s.uf], fatias=fatiasVotos(r), ativo=scope===s.uf;
              const descricao=`${UFS[s.uf]}: ${fmtPct(r?.pctTotalizado??0)} apurado; ${candidatos.map(c=>{const d=r?.candidatos.find(x=>x.numero===c.numero);return `${c.nome}, ${fmtInt(d?.votos??0)} votos, ${fmtPct(d?.pct??0)} dos válidos`;}).join("; ")}`;
              return <g key={s.uf} role="button" tabIndex={0} aria-label={descricao} aria-pressed={ativo} aria-controls={ativo ? `${id}-detalhe` : undefined} className={styles.estado} data-selecionado={ativo} onClick={()=>selecionar(s.uf)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selecionar(s.uf);}}}>
                <g clipPath={`url(#${id}-uf-${s.uf})`}>
                  <path d={s.d} fill="#7f9489"/>
                  {fatias.map(f=><path key={f.numero} d={setorPizza(s.x,s.y,s.raio,f.inicio,f.fracao)} fill={COR[f.numero]}/>)}
                </g>
                <path d={s.d} fill="none" className={styles.contorno} vectorEffect="non-scaling-stroke"/>
                <title>{descricao}</title>
              </g>;
            })}

            {marcadores.map(s=>{
              const r=apuracao.ufs[s.uf], fatias=fatiasVotos(r), ativo=scope===s.uf;
              return <g key={`pizza-${s.uf}`} transform={`translate(${s.x},${s.y})`} pointerEvents="none" aria-hidden="true">
                <circle r={s.raio+1} fill={ativo ? "#FFDF00" : "#d4e8dc"}/>
                {fatias.map(f=><path key={f.numero} d={setorPizza(0,0,s.raio,f.inicio,f.fracao)} fill={COR[f.numero]}/>)}
                {s.rotulo && <text x={s.rotulo.x-s.x} y={s.rotulo.y-s.y+4} textAnchor="middle" fill={ativo ? "#FFDF00" : "white"} stroke="#052f18" strokeWidth={3} paintOrder="stroke" fontSize={12} fontWeight={800}>{s.uf.toUpperCase()}</text>}
              </g>;
            })}
          </svg>

          {chamada && detalhe && <svg className={styles.conector} viewBox={`0 0 ${medidas.largura} ${medidas.altura}`} aria-hidden="true">
            <path d={`M ${chamada.ancora.x} ${chamada.ancora.y} L ${chamada.ponta.x+(chamada.lado==="esq" ? 24 : -24)} ${chamada.ancora.y} L ${chamada.ponta.x} ${chamada.ponta.y}`} fill="none" stroke="#FFDF00" strokeWidth={1.5}/>
            <circle cx={chamada.ancora.x} cy={chamada.ancora.y} r={5} fill="#FFDF00" stroke="#052f18" strokeWidth={2}/>
          </svg>}
        </div>

        {detalhe && <div ref={cartao} id={`${id}-detalhe`} role="region" aria-label={`Detalhes de ${scopeName(scope)}`} className={styles.detalhe} style={chamada ? { "--chamada-x":`${chamada.x}px`, "--chamada-y":`${chamada.y}px` } as React.CSSProperties : undefined}>
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
