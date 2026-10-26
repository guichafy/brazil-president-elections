"use client";

import { useCallback,useEffect,useRef,useState } from "react";
import { criarRoteiro,segmentoPrincipal } from "@/lib/timelapse";
import { desbloquearAudio,pararSom,pausarSom,retomarSom,somFeliz,somTriste } from "@/lib/sons";
import type {ReplayResponse} from "@/lib/types";

type Segmento=ReturnType<typeof segmentoPrincipal>&{decorridoMs:number;iniciadoEm:number};

export function useReplayPlayer(dados:ReplayResponse|null,indice:number|null,onChange:(dados:ReplayResponse,i:number)=>void,bloqueado:boolean,somAtivo:boolean){
  const [tocando,setTocando]=useState(false),[preparando,setPreparando]=useState(false);
  const segmento=useRef<Segmento|null>(null),versao=useRef(0),posicao=useRef(0),onChangeRef=useRef(onChange),somRef=useRef(somAtivo),tocandoRef=useRef(false);
  useEffect(()=>{onChangeRef.current=onChange;somRef.current=somAtivo;});
  useEffect(()=>{posicao.current=indice??(dados?.pontos.length??1)-1;},[indice,dados]);
  const parar=useCallback((silenciar=true)=>{
    versao.current++;segmento.current=null;tocandoRef.current=false;
    if(silenciar)pararSom();setTocando(false);setPreparando(false);
  },[]);
  useEffect(()=>{if(bloqueado)queueMicrotask(()=>parar(false));},[bloqueado,parar]);
  useEffect(()=>()=>{versao.current++;if(tocandoRef.current)pararSom();},[]);

  const preparar=useCallback(async(inicio:number)=>{
    if(!dados)return;
    const pedido=++versao.current;
    setPreparando(true);
    const roteiro=criarRoteiro(dados);
    let duracao=0;
    if(inicio>0&&somRef.current){
      const s=dados.snapshots[dados.pontos[inicio].indices.br];
      const lider=[...s.cands].sort((a,b)=>b.vap-a.vap)[0]?.n;
      duracao=(await(lider==="13"?somFeliz():somTriste()))??0;
    }
    if(pedido!==versao.current)return;
    segmento.current={...segmentoPrincipal(roteiro,inicio,duracao),decorridoMs:0,iniciadoEm:Date.now()};
    setPreparando(false);
  },[dados]);

  const alternar=useCallback(async()=>{
    if(!dados||bloqueado)return;
    if(tocandoRef.current){
      versao.current++;tocandoRef.current=false;
      if(segmento.current)segmento.current.decorridoMs+=Date.now()-segmento.current.iniciadoEm;
      pausarSom();setTocando(false);setPreparando(false);return;
    }
    const pedido=++versao.current;
    if(somAtivo)await desbloquearAudio();
    if(bloqueado||pedido!==versao.current)return;
    tocandoRef.current=true;setTocando(true);
    if(segmento.current){segmento.current.iniciadoEm=Date.now();if(somAtivo)retomarSom();}
    else{
      const inicio=posicao.current>=dados.pontos.length-1 ? 0 : posicao.current;
      posicao.current=inicio;onChangeRef.current(dados,inicio);void preparar(inicio);
    }
  },[dados,bloqueado,somAtivo,preparar]);

  useEffect(()=>{
    if(!tocando||bloqueado||!dados)return;
    const id=setInterval(()=>{
      const s=segmento.current;if(!s)return;
      const fracao=Math.min(1,(s.decorridoMs+Date.now()-s.iniciadoEm)/s.duracaoMs);
      const i=Math.floor(s.inicio+(s.fim-s.inicio)*fracao);
      if(i!==posicao.current){posicao.current=i;onChangeRef.current(dados,i);}
      if(fracao>=1){
        segmento.current=null;
        if(s.proximo!==null){posicao.current=s.proximo;onChangeRef.current(dados,s.proximo);void preparar(s.proximo);}
        else parar();
      }
    },250);
    return()=>clearInterval(id);
  },[tocando,bloqueado,dados,preparar,parar]);
  return{tocando:tocando&&!bloqueado,preparando,alternar,parar};
}
