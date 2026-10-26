import assert from "node:assert/strict";
import { test } from "node:test";
import { fatiasVotos, posicionarChamadas, setorPizza, marcadoresSemColisao } from "../src/lib/mapa-timelapse.ts";

test("pie sectors follow valid candidate votes and preserve zero/complete states", () => {
  const r={validos:100,candidatos:[{numero:"13",votos:25},{numero:"22",votos:75}]};
  const f=fatiasVotos(r);
  assert.equal(f[0].fracao,0.25); assert.equal(f[1].fracao,0.75);
  assert.equal(f[0].inicio,0); assert.equal(f[1].inicio,0.25);
  assert.equal(fatiasVotos({validos:0,candidatos:[]}).reduce((n,f)=>n+f.fracao,0),0);
  assert.equal(setorPizza(10,10,8,0,0),"");
  assert(!/NaN|Infinity/.test(setorPizza(10,10,8,0,0.25)));
  assert.equal((setorPizza(10,10,8,0,1).match(/ A /g)??[]).length,2);
});

test("pie badges and UF labels do not overlap in tightly spaced states", () => {
  const pontos=[{uf:"rn",x:0,y:0},{uf:"pb",x:5,y:23},{uf:"al",x:4,y:70},{uf:"se",x:8,y:94}];
  const marcadores=marcadoresSemColisao(pontos);
  for(let i=0;i<marcadores.length;i++)for(let j=i+1;j<marcadores.length;j++){
    const a=marcadores[i],b=marcadores[j];
    assert(a.raio+b.raio<Math.hypot(a.x-b.x,a.y-b.y));
  }
  for(const m of marcadores)if(m.rotulo)for(const p of marcadores){
    const dx=Math.max(Math.abs(p.x-m.rotulo.x)-13,0),dy=Math.max(Math.abs(p.y-m.rotulo.y)-7,0);
    assert(Math.hypot(dx,dy)>p.raio);
  }
});

test("geographic callouts remain unique and do not overlap for 27 states", () => {
  const pontos=Array.from({length:27},(_,i)=>({uf:String(i),x:300+i*15,y:100+(i%3)*30}));
  const layout=posicionarChamadas(pontos);
  assert.equal(layout.length,27);
  assert.equal(new Set(layout.map(l=>`${l.x},${l.y}`)).size,27);
  for(const lado of ["esq","dir"]){
    const coluna=layout.filter(l=>l.lado===lado).sort((a,b)=>a.y-b.y);
    assert(coluna.every((l,i)=>i===0||l.y-coluna[i-1].y>=60));
    assert(coluna.at(-1).y+58<=900);
  }
});
