import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { desbloquearAudio, pararSom, somVitoria } from "../src/lib/sons.ts";

test("the victory asset matches the recorded video source and 90-second cut", async () => {
  const source = JSON.parse(await readFile("data/audio-vitoria.json", "utf8"));
  assert.equal(source.video, "https://www.youtube.com/watch?v=r4L7BYH1JHA");
  assert.equal(source.duracaoSegundos, 90);
  const audio = await readFile(source.arquivo);
  assert.equal(createHash("sha256").update(audio).digest("hex"), source.sha256);
});

test("closing during audio load prevents late playback; replay can start and stop cleanly", async () => {
  const previous = { window: globalThis.window, AudioContext: globalThis.AudioContext, fetch: globalThis.fetch };
  let starts = 0, stops = 0, release;
  globalThis.window = {};
  globalThis.AudioContext = class {
    state = "running"; destination = {};
    async decodeAudioData() { return { duration: 90 }; }
    createBufferSource() { return { connect() {}, start() { starts++; }, stop() { stops++; this.onended?.(); } }; }
  };
  globalThis.fetch = () => new Promise(resolve => { release = resolve; });
  try {
    assert(await desbloquearAudio());
    const pending = somVitoria();
    pararSom();
    release({ ok: true, arrayBuffer: async()=>new ArrayBuffer(0) });
    assert.equal(await pending, null);
    assert.equal(starts, 0);
    assert.equal(await somVitoria(), 90);
    assert.equal(starts, 1);
    pararSom();
    assert.equal(stops, 1);
  } finally {
    globalThis.window = previous.window;
    globalThis.AudioContext = previous.AudioContext;
    globalThis.fetch = previous.fetch;
  }
});

test("a transient audio failure can be retried without reloading the page", async () => {
  const previous = { window: globalThis.window, AudioContext: globalThis.AudioContext, fetch: globalThis.fetch };
  let requests = 0;
  const control = {setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};
  const node = () => ({frequency:control,gain:control,connect(){return this;},start(){},stop(){}});
  globalThis.window = {};
  globalThis.AudioContext = class {
    state="running"; currentTime=0; destination={};
    async decodeAudioData(){return{duration:90};}
    createOscillator(){return node();} createGain(){return node();} createBufferSource(){return node();}
  };
  globalThis.fetch = async () => { requests++; return requests === 1 ? {ok:false,status:503} : {ok:true,arrayBuffer:async()=>new ArrayBuffer(0)}; };
  try {
    const audio = await import("../src/lib/sons.ts?retry-test");
    await audio.desbloquearAudio();
    assert.equal(await audio.somVitoria(),null);
    assert.equal(await audio.somVitoria(),90);
    assert.equal(requests,2);
    audio.pararSom();
  } finally {
    globalThis.window=previous.window; globalThis.AudioContext=previous.AudioContext; globalThis.fetch=previous.fetch;
  }
});

test("audio pause, resume and seeking retain the correct buffer position",async()=>{
  const previous={window:globalThis.window,AudioContext:globalThis.AudioContext,fetch:globalThis.fetch};
  const starts=[];
  const FakeContext=class{
    static instance;
    state="running";currentTime=0;destination={};constructor(){FakeContext.instance=this;}
    async decodeAudioData(){return{duration:90};}
    createBufferSource(){return{connect(){},start(...args){starts.push(args);},stop(){this.onended?.();}};}
  };
  globalThis.window={};globalThis.AudioContext=FakeContext;
  globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)});
  try{
    const a=await import("../src/lib/sons.ts?transport-test");await a.desbloquearAudio();await a.somVitoria();
    const context=FakeContext.instance;
    context.currentTime=12;assert.equal(a.pausarSom(),12);assert(a.retomarSom());assert.equal(starts.at(-1)[1],12);
    context.currentTime=17;assert(a.posicionarSom(30,true));assert.equal(starts.at(-1)[1],30);
    context.currentTime=20;assert.equal(a.pausarSom(),33);a.pararSom();assert.equal(a.retomarSom(),false);
  }finally{globalThis.window=previous.window;globalThis.AudioContext=previous.AudioContext;globalThis.fetch=previous.fetch;}
});

test("presentation changes music only with the leader, loops through long pauses and cancels obsolete loads", async () => {
  const original={window:globalThis.window,AudioContext:globalThis.AudioContext,fetch:globalThis.fetch};
  const requests=[],sources=[];
  let release,failSuspense=false,clockTime=0;
  globalThis.window={};
  globalThis.AudioContext=class {
    state="running";destination={};get currentTime(){return clockTime;}
    async decodeAudioData(bytes){return{duration:new Uint8Array(bytes)[0]};}
    createBufferSource(){const source={loop:false,connect(){},start(){this.started=true;},stop(){this.stopped=true;this.onended?.();}};sources.push(source);return source;}
  };
  globalThis.fetch=async url=>{
    requests.push(String(url));
    if(String(url).endsWith("flavio-apreensao.mp3")){
      if(failSuspense)return{ok:false,status:503};
      return new Promise(resolve=>{release=()=>resolve({ok:true,arrayBuffer:async()=>new Uint8Array([103]).buffer});});
    }
    return{ok:true,arrayBuffer:async()=>new Uint8Array([90]).buffer};
  };
  try{
    const audio=await import("../src/lib/sons.ts?presentation-test");
    assert.equal(typeof audio.somApresentacao,"function");
    assert.equal(typeof audio.prepararSonsApresentacao,"function");
    await audio.desbloquearAudio();
    assert.equal(await audio.somApresentacao("13"),90);
    const pending=audio.somApresentacao("22");
    assert.equal(await audio.somApresentacao("13"),90);
    release();assert.equal(await pending,null,"A faixa atrasada não pode substituir a liderança atual");
    assert.equal(sources.length,1);assert.equal(sources[0].buffer.duration,90);
    assert.equal(await audio.somApresentacao("22"),103);
    assert(sources[0].stopped);assert.equal(sources.at(-1).buffer.duration,103);assert(sources.at(-1).loop);
    clockTime=120;assert.equal(audio.posicaoSom(),17,"A trilha continua em loop durante pausas longas");
    await audio.somApresentacao("22");await audio.somApresentacao(null);
    assert.equal(sources.length,2,"Atualizações e empate não reiniciam a música");
    assert.equal(await audio.prepararSonsApresentacao(),true);
    assert.equal(requests.filter(url=>url.endsWith("flavio-apreensao.mp3")).length,1);
    clockTime=300;assert.equal(audio.posicaoSom(),94,"A música segue em loop além dos 90s, até fechar a apresentação");
    assert(!sources.at(-1).stopped);
    audio.pararSom();assert(sources.at(-1).stopped);
    await audio.somApresentacao("13");audio.pararSom();assert(sources.at(-1).stopped);
    failSuspense=true;
    const retry=await import("../src/lib/sons.ts?presentation-retry");await retry.desbloquearAudio();
    assert.equal(await retry.prepararSonsApresentacao(),false);
    failSuspense=false;const preparing=retry.prepararSonsApresentacao();await new Promise(r=>setImmediate(r));release();assert.equal(await preparing,true);
  }finally{Object.assign(globalThis,original);}
});
