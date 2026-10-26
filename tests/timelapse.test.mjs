import assert from "node:assert/strict";
import { test } from "node:test";
import { carregarApuracao, carregarReplay } from "../src/lib/static-data.ts";
import { aplicarReplay } from "../src/lib/replay.ts";
import { DURACAO_COMEMORACAO_MS, criarRoteiro, indiceNoTempo, insightsEstaduais, posicaoTimelapse, segmentoPrincipal } from "../src/lib/timelapse.ts";
import { lulaVenceu } from "../src/lib/humor.ts";

test("presentation follows national votes and does not invent a leader for ties or missing candidates", async () => {
  const { liderApresentacao } = await import("../src/lib/timelapse.ts");
  assert.equal(typeof liderApresentacao, "function");
  const resultado = (lula, flavio) => ({ candidatos: [{numero:"22",votos:flavio,pct:50}, {numero:"13",votos:lula,pct:50}] });
  assert.equal(liderApresentacao(resultado(101, 100)), "13");
  assert.equal(liderApresentacao(resultado(100, 101)), "22");
  assert.equal(liderApresentacao(resultado(100, 100)), null);
  assert.equal(liderApresentacao(resultado(0, 0)), null);
  assert.equal(liderApresentacao({candidatos:[{numero:"22",votos:10}]}), null);
  assert.equal(liderApresentacao(null), null);
});

test("qualification for the second round never triggers a presidential victory", async () => {
  const final = await carregarApuracao();
  const primeiroTurno = structuredClone(final.nacional);
  primeiroTurno.turno = "1";
  Object.assign(primeiroTurno.candidatos.find(c=>c.numero==="13"), {eleito:true,situacao:"2º turno"});
  assert.equal(lulaVenceu(primeiroTurno),false);
});

test("playback clock supports pausing, resuming and seeking without exceeding 90s", () => {
  assert.equal(posicaoTimelapse({posicaoMs:10000,iniciadoEm:1000,pausado:false},4000),13000);
  assert.equal(posicaoTimelapse({posicaoMs:13000,iniciadoEm:null,pausado:true},999999),13000);
  assert.equal(posicaoTimelapse({posicaoMs:30000,iniciadoEm:5000,pausado:false},8000),33000);
  assert.equal(posicaoTimelapse({posicaoMs:85000,iniciadoEm:5000,pausado:false},20000),90000);
});

test("main autoplay segments allow each candidate audio to finish before the next reversal", async()=>{
  const r=await carregarReplay(),roteiro=criarRoteiro(r);
  const viradas=roteiro.marcos.filter(m=>m.tipo==="virada");
  if(viradas.length===2){
    assert.equal(segmentoPrincipal(roteiro,0,6).fim,viradas[0].indice-1);
    assert.equal(segmentoPrincipal(roteiro,viradas[0].indice,6).fim,viradas[1].indice-1);
    assert(segmentoPrincipal(roteiro,viradas[1].indice,60).duracaoMs>=60000);
    assert.equal(segmentoPrincipal(roteiro,viradas[1].indice,60).fim,r.pontos.length-1);
  }
});

test("detects the two actual second-round lead changes and mathematical consolidation", async () => {
  const replay = await carregarReplay(), roteiro = criarRoteiro(replay);
  const viradas = roteiro.marcos.filter(m => m.tipo === "virada");
  if ((process.env.TSE_ELEICAO ?? "6258") === "6258") {
    assert.equal(viradas.length, 2);
    assert.deepEqual(viradas.map(m => m.lider), ["22", "13"]);
    assert.match(replay.pontos[viradas[0].indice].t, /19:44:44/);
    assert.match(replay.pontos[viradas[1].indice].t, /20:24:14/);
    const garantia = roteiro.marcos.find(m=>m.tipo === "garantia");
    assert(garantia.indice > viradas[1].indice);
    const s = replay.snapshots[replay.pontos[garantia.indice].indices.br];
    assert(s.cands.find(c=>c.n==="13").vap - s.cands.find(c=>c.n==="22").vap > s.te-s.est);
  } else assert.equal(viradas.length, 0, "não inventa viradas no primeiro turno");
});

test("90-second schedule includes both lead changes, holds milestones and ends at the final archive", async () => {
  const replay = await carregarReplay(), roteiro = criarRoteiro(replay);
  assert.equal(DURACAO_COMEMORACAO_MS, 90000);
  assert.equal(indiceNoTempo(roteiro, 0), 0);
  assert.equal(indiceNoTempo(roteiro, 90000), replay.pontos.length-1);
  assert.equal(indiceNoTempo(roteiro, 95000), replay.pontos.length-1);
  for(const marco of roteiro.marcos) assert(roteiro.agenda.some(a=>a.indice===marco.indice));
  const indices = Array.from({length:361},(_,i)=>indiceNoTempo(roteiro,i*250));
  assert(indices.every((v,i)=>i===0 || v >= indices[i-1]));
});

test("state insights show exact recorded votes, progress and non-invented deltas for all states", async () => {
  const final = await carregarApuracao(), replay=await carregarReplay();
  const antes=aplicarReplay(final,replay,0), atual=aplicarReplay(final,replay,Math.floor(replay.pontos.length/2));
  const insights=insightsEstaduais(atual,antes);
  assert.equal(insights.length,28);
  const sp=insights.find(i=>i.scope==="sp");
  assert.equal(sp.apurado,atual.ufs.sp.pctTotalizado);
  assert.equal(sp.lula.votos,atual.ufs.sp.candidatos.find(c=>c.numero==="13").votos);
  assert.equal(sp.flavio.votos,atual.ufs.sp.candidatos.find(c=>c.numero==="22").votos);
  assert.equal(sp.lula.delta,sp.lula.votos-antes.ufs.sp.candidatos.find(c=>c.numero==="13").votos);
  assert(insights.every(i=>Number.isFinite(i.apurado) && Number.isFinite(i.lula.delta) && Number.isFinite(i.flavio.delta)));
});
