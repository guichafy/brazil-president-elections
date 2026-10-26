"use client";

import { useEffect, useRef, useState } from "react";
import { capturarGrupoAtualizacoes, type AtualizacaoEstadual } from "@/lib/mapa-timelapse";

export function useChamadasFixas<T extends AtualizacaoEstadual>(atuais:T[], pronto:boolean, limite:number, duracao:number, pausado:boolean, revisao:number) {
  const recentes = useRef(atuais);
  const controle = useRef({ cursor:0, limite:0, revisao:-1 });
  const [exibicao,setExibicao] = useState<{ciclo:number;grupo:T[]}>({ciclo:0,grupo:[]});

  useEffect(() => {
    if (!pronto) return;
    recentes.current = atuais;
    if (!atuais.length) return;
    if (exibicao.grupo.length && controle.current.limite===limite && controle.current.revisao===revisao) return;
    const quadro=requestAnimationFrame(() => {
      controle.current={...controle.current,limite,revisao};
      const grupo=capturarGrupoAtualizacoes(recentes.current,controle.current.cursor,limite);
      setExibicao(anterior=>({ciclo:anterior.ciclo+1,grupo}));
    });
    return ()=>cancelAnimationFrame(quadro);
  },[atuais,pronto,limite,revisao,exibicao.grupo.length]);

  useEffect(() => {
    if (pausado || !exibicao.grupo.length) return;
    const timer=setTimeout(() => {
      controle.current.cursor+=limite;
      const grupo=capturarGrupoAtualizacoes(recentes.current,controle.current.cursor,limite);
      setExibicao(anterior=>({ciclo:anterior.ciclo+1,grupo}));
    },duracao);
    return ()=>clearTimeout(timer);
  },[pausado,limite,duracao,exibicao.ciclo,exibicao.grupo.length]);

  return exibicao.grupo;
}
