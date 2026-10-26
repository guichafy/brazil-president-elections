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
