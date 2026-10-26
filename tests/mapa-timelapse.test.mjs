import assert from "node:assert/strict";
import { test } from "node:test";
import { fatiasVotos, setorPizza, marcadoresSemColisao, posicionarChamada } from "../src/lib/mapa-timelapse.ts";

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

test("selected state callout stays inside the map and on the opposite side of its anchor", () => {
  for(const ponto of [{x:300,y:70},{x:950,y:800},{x:620,y:447.5}]){
    const layout=posicionarChamada(ponto,{largura:1440,altura:660},{largura:288,altura:320});
    assert.ok(layout,"A seleção precisa de uma chamada individual");
    assert(layout.x>=16&&layout.x+288<=1424);
    assert(layout.y>=16&&layout.y+320<=644);
    if(layout.ancora.x<720) assert(layout.x>layout.ancora.x);
    else assert(layout.x+288<layout.ancora.x);
  }
});

test("selected state connector follows the fitted map after a viewport resize", () => {
  // O centro do viewBox (250, 50, 740, 795) continua no centro da área,
  // inclusive com as margens criadas por preserveAspectRatio=meet.
  const layout=posicionarChamada({x:620,y:447.5},{largura:1480,altura:795},{largura:288,altura:320});
  assert.ok(layout,"A chamada precisa acompanhar o mapa redimensionado");
  assert.deepEqual(layout.ancora,{x:740,y:397.5});
});

test("a short viewport keeps the state detail out of the clipped map area", () => {
  assert.equal(posicionarChamada({x:750,y:600},{largura:1280,altura:262},{largura:288,altura:320}),null);
});
