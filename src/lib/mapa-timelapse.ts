import type { ResultadoAbrangencia } from "./types";

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

/** Setor circular, iniciado no topo, inclusive os casos de zero e círculo completo. */
export function setorPizza(cx: number, cy: number, r: number, inicio: number, fracao: number): string {
  if (!Number.isFinite(fracao) || fracao <= 0) return "";
  if (fracao >= 1) return `M ${cx} ${cy-r} A ${r} ${r} 0 1 1 ${cx} ${cy+r} A ${r} ${r} 0 1 1 ${cx} ${cy-r} Z`;
  const a = inicio * Math.PI * 2 - Math.PI / 2, b = a + fracao * Math.PI * 2;
  return `M ${cx} ${cy} L ${cx+r*Math.cos(a)} ${cy+r*Math.sin(a)} A ${r} ${r} 0 ${fracao>0.5 ? 1 : 0} 1 ${cx+r*Math.cos(b)} ${cy+r*Math.sin(b)} Z`;
}

export function posicionarChamadas<T extends string>(pontos: {uf:T;x:number;y:number}[]) {
  const porLongitude=[...pontos].sort((a,b)=>a.x-b.x);
  const metade=Math.ceil(porLongitude.length/2);
  return [porLongitude.slice(0,metade),porLongitude.slice(metade)].flatMap((coluna,n)=>
    coluna.sort((a,b)=>a.y-b.y).map((p,i)=>({uf:p.uf,x:n===0 ? 0 : 996,y:26+i*61,lado:n===0 ? "esq" as const : "dir" as const})),
  );
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
