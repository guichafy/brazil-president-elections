import type { ApuracaoResponse, ResultadoAbrangencia } from "./types";
import { UF_LIST, type UF } from "./ufs";

export interface AtualizacaoEstadual {
  uf: UF;
  antesApurado: number;
  agoraApurado: number;
  deltaValidos: number;
  candidatos: { numero: string; antes: { votos: number; pct: number }; agora: { votos: number; pct: number }; deltaVotos: number }[];
}

/** Compara os quadros exibidos, inclusive votos novos com a mesma proporção e navegação para trás. */
export function atualizacoesEstaduais(antes: ApuracaoResponse["ufs"], agora: ApuracaoResponse["ufs"]): AtualizacaoEstadual[] {
  return UF_LIST.flatMap(uf => {
    const a = antes[uf], b = agora[uf];
    const candidatos = ["13", "22"].map(numero => {
      const retrato = (r: ResultadoAbrangencia | undefined) => {
        const votos = r?.candidatos.find(c => c.numero === numero)?.votos ?? 0;
        return { votos, pct: r?.validos ? votos / r.validos * 100 : 0 };
      };
      const anterior = retrato(a), atual = retrato(b);
      return { numero, antes: anterior, agora: atual, deltaVotos: atual.votos - anterior.votos };
    });
    const antesApurado = a?.pctTotalizado ?? 0, agoraApurado = b?.pctTotalizado ?? 0;
    const deltaValidos = (b?.validos ?? 0) - (a?.validos ?? 0);
    const mudou = deltaValidos !== 0 || candidatos.some(c => c.deltaVotos !== 0) || antesApurado !== agoraApurado || (a?.secoesTotalizadas ?? 0) !== (b?.secoesTotalizadas ?? 0);
    return mudou ? [{ uf, antesApurado, agoraApurado, deltaValidos, candidatos }] : [];
  });
}

export function fatiasVotos(r?: Pick<ResultadoAbrangencia,"validos"|"candidatos">) {
  let inicio = 0;
  return ["13","22"].map(numero => {
    const votos = r?.candidatos.find(c=>c.numero===numero)?.votos ?? 0;
    const fracao = r?.validos ? votos / r.validos : 0;
    const fatia = { numero, inicio, fracao };
    inicio += fracao;
    return fatia;
  });
}

/** Interpola ângulos, mantendo as fatias contíguas mesmo em uma virada ou salto para trás. */
export function interpolarFatias(origem: ReturnType<typeof fatiasVotos>, destino: ReturnType<typeof fatiasVotos>, progresso: number) {
  const t = Math.max(0, Math.min(1, progresso));
  let inicio = 0;
  return destino.map(fatia => {
    const antes = origem.find(f => f.numero === fatia.numero)?.fracao ?? 0;
    const fracao = antes + (fatia.fracao - antes) * t;
    const interpolada = { numero: fatia.numero, inicio, fracao };
    inicio += fracao;
    return interpolada;
  });
}

/** Setor circular, iniciado no topo, inclusive os casos de zero e círculo completo. */
export function setorPizza(cx: number, cy: number, r: number, inicio: number, fracao: number): string {
  if (!Number.isFinite(fracao) || fracao <= 0) return "";
  if (fracao >= 1) return `M ${cx} ${cy-r} A ${r} ${r} 0 1 1 ${cx} ${cy+r} A ${r} ${r} 0 1 1 ${cx} ${cy-r} Z`;
  const a = inicio * Math.PI * 2 - Math.PI / 2, b = a + fracao * Math.PI * 2;
  return `M ${cx} ${cy} L ${cx+r*Math.cos(a)} ${cy+r*Math.sin(a)} A ${r} ${r} 0 ${fracao>0.5 ? 1 : 0} 1 ${cx+r*Math.cos(b)} ${cy+r*Math.sin(b)} Z`;
}

export const MAPA_VIEWBOX = { x:250, y:50, largura:740, altura:795 };

type Retangulo = { x:number; y:number; largura:number; altura:number };

function ancoraNoMapa(ponto:{x:number;y:number}, area:{largura:number;altura:number}, desenho?:Retangulo) {
  const mapa = desenho ?? {x:0,y:0,...area};
  const escala = Math.min(mapa.largura / MAPA_VIEWBOX.largura, mapa.altura / MAPA_VIEWBOX.altura);
  return {
    x:mapa.x+(mapa.largura-MAPA_VIEWBOX.largura*escala)/2+(ponto.x-MAPA_VIEWBOX.x)*escala,
    y:mapa.y+(mapa.altura-MAPA_VIEWBOX.altura*escala)/2+(ponto.y-MAPA_VIEWBOX.y)*escala,
  };
}

/** Grupos pequenos e estáveis percorrem todas as UFs que tiveram entradas de votos. */
export function grupoAtualizacoes<T extends { uf:string }>(atualizacoes:T[], cursor:number, limite:number):T[] {
  if (!atualizacoes.length) return [];
  const ordenadas = [...atualizacoes].sort((a,b) => a.uf.localeCompare(b.uf));
  return Array.from({length:Math.min(limite, ordenadas.length)}, (_, i) => ordenadas[(cursor+i)%ordenadas.length]);
}

/** Chamadas próximas ao estado, ligadas à âncora, com espaço reservado entre os cartões. */
export function posicionarAtualizacoes<T extends string>(
  pontos:{uf:T;x:number;y:number;limites?:Retangulo}[],
  area:{largura:number;altura:number},
  caixa:{largura:number;altura:number},
  layout:{mapa?:Retangulo;evitar?:Retangulo[]}={},
) {
  const margem=12, gap=8, w=caixa.largura, h=caixa.altura;
  const colocadas:{uf:T;x:number;y:number;ancora:{x:number;y:number};ponta:{x:number;y:number}}[]=[];
  if (area.largura<w+2*margem || area.altura<h+2*margem) return colocadas;
  const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
  const ancoras=pontos.map(p=>({...p,ancora:ancoraNoMapa(p,area,layout.mapa)}));
  const protegidos=[...pontos.flatMap(p=>p.limites ? [p.limites] : []),...(layout.evitar??[])].map(r=>{
    const inicio=ancoraNoMapa(r,area,layout.mapa);
    const fim=ancoraNoMapa({x:r.x+r.largura,y:r.y+r.altura},area,layout.mapa);
    return {x:inicio.x,y:inicio.y,largura:fim.x-inicio.x,altura:fim.y-inicio.y};
  });
  for (const p of ancoras) {
    const a=p.ancora;
    const opcoes=[
      {x:a.x+24,y:a.y-h/2}, {x:a.x-w-24,y:a.y-h/2},
      {x:a.x-w/2,y:a.y-h-24}, {x:a.x-w/2,y:a.y+24},
      {x:a.x+24,y:a.y-h-24}, {x:a.x-w-24,y:a.y+24},
      {x:a.x-w-24,y:a.y-h-24}, {x:a.x+24,y:a.y+24},
    ];
    const xs=[area.largura-w-margem], ys=[area.altura-h-margem];
    for(let x=margem;x<=area.largura-w-margem;x+=w+gap)xs.push(x);
    for(let y=margem;y<=area.altura-h-margem;y+=h+gap)ys.push(y);
    for(const y of ys)for(const x of xs)opcoes.push({x,y});
    const candidatos=opcoes.map(o=>({x:clamp(o.x,margem,area.largura-w-margem),y:clamp(o.y,margem,area.altura-h-margem)}))
      .filter(o=>colocadas.every(c=>o.x+w+gap<=c.x||c.x+w+gap<=o.x||o.y+h+gap<=c.y||c.y+h+gap<=o.y))
      .filter(o=>protegidos.every(r=>o.x+w+gap<=r.x||r.x+r.largura+gap<=o.x||o.y+h+gap<=r.y||r.y+r.altura+gap<=o.y))
      .map(o=>{
        const ponta={x:clamp(a.x,o.x,o.x+w),y:clamp(a.y,o.y,o.y+h)};
        const cobre=(b:{x:number;y:number})=>b.x>o.x-8&&b.x<o.x+w+8&&b.y>o.y-8&&b.y<o.y+h+8;
        const custo=Math.hypot(a.x-ponta.x,a.y-ponta.y)+ancoras.filter(b=>cobre(b.ancora)).length*10000;
        return {...o,ponta,custo};
      }).sort((a,b)=>a.custo-b.custo);
    const melhor=candidatos[0];
    if (melhor) colocadas.push({uf:p.uf,x:melhor.x,y:melhor.y,ancora:a,ponta:melhor.ponta});
  }
  return colocadas;
}

/** Uma chamada, na margem oposta ao estado, acompanhando o SVG sem zoom. */
export function posicionarChamada(
  ponto:{x:number;y:number},
  area:{largura:number;altura:number},
  caixa:{largura:number;altura:number},
) {
  if (area.altura<caixa.altura+32) return null;
  const ancora=ancoraNoMapa(ponto,area);
  const lado=ancora.x>=area.largura/2 ? "esq" : "dir";
  const x=lado==="esq" ? 16 : area.largura-caixa.largura-16;
  const y=Math.max(16,Math.min(area.altura-caixa.altura-16,ancora.y-48));
  const ponta={x:lado==="esq" ? x+caixa.largura : x,y:y+48};
  return {x,y,lado,ancora,ponta};
}

export function marcadoresSemColisao<T extends string>(pontos:{uf:T;x:number;y:number}[]) {
  const rotulos:{x:number;y:number}[]=[];
  const circulos=pontos.map(p=>({...p,raio:Math.max(0,Math.min(13,(Math.min(...pontos.filter(o=>o!==p).map(o=>Math.hypot(o.x-p.x,o.y-p.y)))-3)/2))}));
  return circulos.map(p=>{
    const candidatos=[{x:p.x,y:p.y+p.raio+11},{x:p.x,y:p.y-p.raio-11},{x:p.x+p.raio+18,y:p.y},{x:p.x-p.raio-18,y:p.y}];
    const rotulo=candidatos.find(r=>circulos.every(c=>Math.hypot(Math.max(Math.abs(c.x-r.x)-13,0),Math.max(Math.abs(c.y-r.y)-7,0))>c.raio)&&rotulos.every(o=>Math.abs(o.x-r.x)>=26||Math.abs(o.y-r.y)>=14));
    if(rotulo)rotulos.push(rotulo);
    return {...p,rotulo};
  });
}
