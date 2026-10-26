import assert from "node:assert/strict";
import { test } from "node:test";
import { fatiasVotos, setorPizza, marcadoresSemColisao, posicionarChamada } from "../src/lib/mapa-timelapse.ts";
import * as mapa from "../src/lib/mapa-timelapse.ts";

test("automatic map callouts stay near their states, inside the viewport, and do not overlap", () => {
  assert.equal(typeof mapa.posicionarAtualizacoes,"function","Falta posicionar automaticamente as atualizações no mapa");
  const pontos=[{uf:"rn",x:948,y:285},{uf:"pb",x:950,y:310},{uf:"pe",x:938,y:340}];
  const caixas=mapa.posicionarAtualizacoes(pontos,{largura:1440,altura:800},{largura:264,altura:144});
  assert.equal(caixas.length,3);
  for(const c of caixas){
    assert(c.x>=12&&c.y>=12);
    assert(c.x+264<=1428&&c.y+144<=788);
    assert(c.ponta.x>=c.x&&c.ponta.x<=c.x+264);
    assert(c.ponta.y>=c.y&&c.ponta.y<=c.y+144);
    assert(!(c.ancora.x>c.x&&c.ancora.x<c.x+264&&c.ancora.y>c.y&&c.ancora.y<c.y+144),"A chamada não deve cobrir sua própria âncora");
  }
  for(let i=0;i<caixas.length;i++)for(let j=i+1;j<caixas.length;j++){
    const a=caixas[i],b=caixas[j];
    assert(a.x+264+8<=b.x||b.x+264+8<=a.x||a.y+144+8<=b.y||b.y+144+8<=a.y);
  }
  for(const p of [{uf:"ac",x:280,y:500},{uf:"rn",x:970,y:70},{uf:"rs",x:700,y:825}]){
    const [c]=mapa.posicionarAtualizacoes([p],{largura:358,altura:383},{largura:264,altura:144});
    assert(c.x>=12&&c.x+264<=346&&c.y>=12&&c.y+144<=371);
  }
});

test("automatic callout rotation reaches every updated state without duplicating a state in a group", () => {
  assert.equal(typeof mapa.grupoAtualizacoes,"function","Falta alternar os estados automaticamente");
  const atualizacoes=["ac","al","am","ap","ba","ce","df"].map(uf=>({uf}));
  const vistos=new Set();
  for(let cursor=0;cursor<9;cursor+=3){
    const grupo=mapa.grupoAtualizacoes(atualizacoes,cursor,3);
    assert.equal(grupo.length,3);
    assert.equal(new Set(grupo.map(a=>a.uf)).size,3);
    grupo.forEach(a=>vistos.add(a.uf));
  }
  assert.equal(vistos.size,7);
  assert.deepEqual(mapa.grupoAtualizacoes([],10,3),[]);
  assert.deepEqual(mapa.grupoAtualizacoes(atualizacoes.slice(0,1),10,3),[{uf:"ac"}]);
});

test("state updates include absolute vote changes even when candidate shares do not move", () => {
  assert.equal(typeof mapa.atualizacoesEstaduais, "function", "Falta detectar as atualizações de cada estado");
  const registro=(lula,flavio,apurado=50)=>({validos:lula+flavio,pctTotalizado:apurado,secoesTotalizadas:apurado,candidatos:[{numero:"22",votos:flavio},{numero:"13",votos:lula}]});
  const antes={sp:registro(100,100),mg:registro(300,100),ba:registro(0,0,0)};
  const depois={sp:registro(200,200),mg:registro(300,100),ba:registro(30,70,10)};
  const updates=mapa.atualizacoesEstaduais(antes,depois);
  assert.deepEqual(updates.map(u=>u.uf),["ba","sp"]);
  const sp=updates.find(u=>u.uf==="sp");
  assert.equal(sp.deltaValidos,200);
  assert.deepEqual(sp.candidatos,[
    {numero:"13",antes:{votos:100,pct:50},agora:{votos:200,pct:50},deltaVotos:100},
    {numero:"22",antes:{votos:100,pct:50},agora:{votos:200,pct:50},deltaVotos:100},
  ]);
  assert.equal(updates.find(u=>u.uf==="ba").candidatos[0].antes.votos,0);
  assert.equal(updates.find(u=>u.uf==="ba").candidatos[0].agora.pct,30);
  assert.deepEqual(mapa.atualizacoesEstaduais(depois,structuredClone(depois)),[]);
});

test("state comparisons preserve reverse seeking, vote corrections and progress-only updates", () => {
  assert.equal(typeof mapa.atualizacoesEstaduais,"function");
  const a={validos:200,pctTotalizado:50,secoesTotalizadas:50,candidatos:[{numero:"13",votos:100},{numero:"22",votos:100}]};
  const b={validos:190,pctTotalizado:60,secoesTotalizadas:60,candidatos:[{numero:"13",votos:90},{numero:"22",votos:100}]};
  const [correcao]=mapa.atualizacoesEstaduais({sp:a},{sp:b});
  assert.equal(correcao.deltaValidos,-10);
  assert.equal(correcao.candidatos[0].deltaVotos,-10);
  const [volta]=mapa.atualizacoesEstaduais({sp:b},{sp:a});
  assert.equal(volta.candidatos[0].antes.votos,90);
  assert.equal(volta.candidatos[0].agora.votos,100);
  assert.equal(mapa.atualizacoesEstaduais({sp:a},{sp:{...a,secoesTotalizadas:51}}).length,1);
});

test("animated slices move continuously between historical proportions, including empty states and reversals", () => {
  assert.equal(typeof mapa.interpolarFatias, "function", "Falta interpolar as fatias entre snapshots");
  const antes = fatiasVotos({validos:100,candidatos:[{numero:"13",votos:25},{numero:"22",votos:75}]});
  const depois = fatiasVotos({validos:100,candidatos:[{numero:"13",votos:75},{numero:"22",votos:25}]});
  const meio = mapa.interpolarFatias(antes, depois, 0.5);
  assert.deepEqual(meio, [{numero:"13",inicio:0,fracao:0.5},{numero:"22",inicio:0.5,fracao:0.5}]);
  assert.deepEqual(mapa.interpolarFatias(antes, depois, -1), antes);
  assert.deepEqual(mapa.interpolarFatias(antes, depois, 2), depois);
  assert.deepEqual(mapa.interpolarFatias(depois, antes, 1), antes);
  const vazio = fatiasVotos();
  assert.deepEqual(mapa.interpolarFatias(depois, vazio, 1), vazio);
  assert.deepEqual(mapa.interpolarFatias(vazio, depois, 1), depois);
});

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
