"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { geoIdentity, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import brasil from "@/data/brasil-ufs.json";
import { fatiasVotos, posicionarChamadas, setorPizza, marcadoresSemColisao } from "@/lib/mapa-timelapse";
import { fmtInt, fmtPct } from "@/lib/format";
import { UFS, scopeName, type Scope, type UF } from "@/lib/ufs";
import type { ApuracaoResponse } from "@/lib/types";

type UfFeature=Feature<Geometry,{uf:UF}>;
const geo=brasil as unknown as FeatureCollection<Geometry,{uf:UF}>;
const proj=geoIdentity().reflectY(true).fitExtent([[270,70],[970,825]],geo);
const path=geoPath(proj);
const shapes=geo.features.map((f:UfFeature)=>{
  const [x,y]=path.centroid(f),[[x0,y0],[x1,y1]]=path.bounds(f);
  return {uf:f.properties.uf,d:path(f)??"",x,y,raio:Math.hypot(x1-x0,y1-y0)+1};
});
const chamadas=posicionarChamadas(shapes);
const marcadores=marcadoresSemColisao(shapes);
const COR:Record<string,string>={"13":"#ef3340","22":"#6269ef"};
function observarCompacto(cb:()=>void){const m=window.matchMedia("(max-width:767px)");m.addEventListener("change",cb);return()=>m.removeEventListener("change",cb);}
const lerCompacto=()=>window.matchMedia("(max-width:767px)").matches;

export default function MapaTimelapse({apuracao,scope,onSelect}:{apuracao:ApuracaoResponse;scope:Scope;onSelect:(s:Scope)=>void}) {
  const id=useId().replace(/:/g,"");
  const [zoom,setZoom]=useState(1);
  const compacto=useSyncExternalStore(observarCompacto,lerCompacto,()=>false);
  const candidatos=apuracao.nacional?.candidatos.filter(c=>c.numero==="13"||c.numero==="22")??[];
  const detalhe=scope==="zz" ? apuracao.exterior : scope==="br" ? null : apuracao.ufs[scope];
  const selecionar=(uf:Scope)=>onSelect(scope===uf ? "br" : uf);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-white/75">
        <p>Fotos, votos e % dos válidos em cada UF · setores nas cores dos candidatos</p>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Diminuir mapa" disabled={zoom<=1} onClick={()=>setZoom(z=>Math.max(1,z-0.25))} className="rounded border border-white/30 px-3 py-1 disabled:opacity-40">−</button>
          <span className="tabular">{Math.round(zoom*100)}%</span>
          <button type="button" aria-label="Ampliar mapa" disabled={zoom>=2} onClick={()=>setZoom(z=>Math.min(2,z+0.25))} className="rounded border border-white/30 px-3 py-1 disabled:opacity-40">+</button>
        </div>
      </div>
      <div tabIndex={0} role="region" aria-label="Mapa ampliado com votos por estado" style={{height:compacto ? "min(64dvh,calc((100vw - 32px) * 1.05))" : "min(72dvh,calc((100vw - 64px) * 0.726))"}} className={`${zoom===1 ? "overflow-hidden" : "overflow-auto"} rounded-xl border border-white/20 bg-[#052f18] focus-visible:outline-2 focus-visible:outline-[#FFDF00]`}>
        <svg viewBox={compacto ? "250 50 740 795" : "0 0 1240 900"} preserveAspectRatio="xMidYMid meet" style={{width:`${zoom*100}%`,height:`${zoom*100}%`}} className="block" role="group" aria-label="Mapa animado da votação proporcional por estado">
          <defs>
            {shapes.map(s=><clipPath key={s.uf} id={`${id}-uf-${s.uf}`}><path d={s.d}/></clipPath>)}
            <clipPath id={`${id}-rosto`}><circle r={8}/></clipPath>
            {candidatos.map(c=><g key={c.numero} id={`${id}-foto-${c.numero}`}>
              <circle r={9} fill={COR[c.numero]}/><image href={c.foto} x={-8} y={-8} width={16} height={16} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-rosto)`}/>
            </g>)}
          </defs>

          {shapes.map(s=>{
            const r=apuracao.ufs[s.uf],fatias=fatiasVotos(r);
            const descricao=`${UFS[s.uf]}: ${fmtPct(r?.pctTotalizado??0)} apurado; ${candidatos.map(c=>{const d=r?.candidatos.find(x=>x.numero===c.numero);return `${c.nome}, ${fmtInt(d?.votos??0)} votos, ${fmtPct(d?.pct??0)} dos válidos`;}).join("; ")}`;
            return <g key={s.uf} role="button" tabIndex={0} aria-label={descricao} aria-pressed={scope===s.uf} className="cursor-pointer outline-none focus:brightness-150" onClick={()=>selecionar(s.uf)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selecionar(s.uf);}}}>
              <g clipPath={`url(#${id}-uf-${s.uf})`}>
                <path d={s.d} fill="#7f9489"/>
                {fatias.map(f=><path key={f.numero} d={setorPizza(s.x,s.y,s.raio,f.inicio,f.fracao)} fill={COR[f.numero]}/>)}
              </g>
              <path d={s.d} fill="none" stroke={scope===s.uf ? "#FFDF00" : "#d4e8dc"} strokeWidth={scope===s.uf ? 3 : 1.2}/>
              <title>{descricao}</title>
            </g>;
          })}

          {!compacto && chamadas.map(c=>{
            const s=shapes.find(s=>s.uf===c.uf)!;
            const ativo=scope===c.uf;
            const x=c.lado==="esq" ? 244 : 996;
            return <path key={c.uf} d={`M ${s.x} ${s.y} L ${c.lado==="esq" ? 255 : 985} ${s.y} L ${x} ${c.y+28}`} fill="none" stroke={ativo ? "#FFDF00" : "#d4e8dc"} strokeWidth={ativo ? 2 : 0.8} opacity={ativo ? 1 : 0.4} pointerEvents="none"/>;
          })}

          {marcadores.map(s=>{
            const r=apuracao.ufs[s.uf],fatias=fatiasVotos(r);
            return <g key={`pizza-${s.uf}`} transform={`translate(${s.x},${s.y})`} pointerEvents="none">
              <circle r={s.raio+1} fill="#d4e8dc"/>
              {fatias.map(f=><path key={f.numero} d={setorPizza(0,0,s.raio,f.inicio,f.fracao)} fill={COR[f.numero]}/>)}
              {s.rotulo && <text x={s.rotulo.x-s.x} y={s.rotulo.y-s.y+4} textAnchor="middle" fill="white" stroke="#052f18" strokeWidth={3} paintOrder="stroke" fontSize={12} fontWeight={800}>{s.uf.toUpperCase()}</text>}
            </g>;
          })}

          {!compacto && chamadas.map(c=>{
            const r=apuracao.ufs[c.uf],ativo=scope===c.uf;
            return <g key={`chamada-${c.uf}`} transform={`translate(${c.x},${c.y})`} role="button" tabIndex={0} aria-label={`Explorar ${UFS[c.uf]}`} aria-pressed={ativo} className="cursor-pointer outline-none focus:brightness-150" onClick={()=>selecionar(c.uf)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selecionar(c.uf);}}}>
              <rect x={0} y={0} width={244} height={57} rx={6} fill={ativo ? "#125832" : "#07401d"} stroke={ativo ? "#FFDF00" : "#326447"}/>
              <text x={9} y={13} fill="#FFDF00" fontSize={11} fontWeight={700}>{c.uf.toUpperCase()} · {UFS[c.uf]}</text>
              <text x={235} y={13} textAnchor="end" fill="#d4e8dc" fontSize={10}>{fmtPct(r?.pctTotalizado??0)} ap.</text>
              {["13","22"].map((n,j)=>{
                const candidato=r?.candidatos.find(c=>c.numero===n);
                return <g key={n}>
                  <use href={`#${id}-foto-${n}`} x={17} y={29+j*18}/>
                  <text x={32} y={33+j*18} fill="white" fontSize={12} fontWeight={650} className="tabular">{fmtInt(candidato?.votos??0)} votos</text>
                  <text x={235} y={33+j*18} textAnchor="end" fill={n==="13" ? "#ffb6bd" : "#c5c9ff"} fontSize={12} fontWeight={700} className="tabular">{fmtPct(candidato?.pct??0)}</text>
                </g>;
              })}
            </g>;
          })}
          {!compacto && <g transform="translate(490,850)"><text fill="#d4e8dc" fontSize={12}>Lula (vermelho) · Flávio (azul)</text><text y={20} fill="#a3c4b0" fontSize={11}>Pizza: participação nos votos válidos</text></g>}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">Explorar
          <select value={scope} onChange={e=>onSelect(e.target.value as Scope)} className="max-w-52 rounded bg-white px-3 py-2 text-[#07401d]">
            <option value="br">Brasil</option>{Object.keys(UFS).map(uf=><option key={uf} value={uf}>{UFS[uf as UF]}</option>)}<option value="zz">Exterior</option>
          </select>
        </label>
        {detalhe && <div className="flex flex-wrap gap-x-4 gap-y-1 tabular"><strong>{scopeName(scope)} · {fmtPct(detalhe.pctTotalizado)} apurado</strong>{["13","22"].map(n=>{const c=detalhe.candidatos.find(c=>c.numero===n);return <span key={n}>{c?.nome}: {fmtInt(c?.votos??0)} votos ({fmtPct(c?.pct??0)})</span>;})}</div>}
        {scope!=="zz" && apuracao.exterior && <button type="button" onClick={()=>onSelect("zz")} className="text-xs underline">Ver votos do exterior</button>}
      </div>
    </div>
  );
}
