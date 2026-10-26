import assert from "node:assert/strict";
import { test } from "node:test";

test("Play unlocks audio immediately but waits for history and music before starting; cancellation never plays late audio", async () => {
  const original = {window:globalThis.window,AudioContext:globalThis.AudioContext,fetch:globalThis.fetch};
  let liberarHistorico, inicioAudio=0, desbloqueios=0, permitirAudio=false, musicaDisponivel=false;
  globalThis.window={};
  globalThis.AudioContext=class {
    state="suspended";destination={};currentTime=0;
    async resume(){desbloqueios++;if(permitirAudio)this.state="running";}
    async decodeAudioData(){return{duration:90};}
    createBufferSource(){return{connect(){},start(){inicioAudio++;},stop(){}};}
  };
  globalThis.fetch=async url => String(url).endsWith("replay.json")
    ? new Promise(resolve=>{liberarHistorico=()=>resolve({ok:true,json:async()=>({pontos:[{},{}]})});})
    : {ok:musicaDisponivel,status:503,arrayBuffer:async()=>new ArrayBuffer(0)};
  try {
    const cliente=await import("../src/lib/replay-client.ts?victory-start");
    assert.equal(typeof cliente.iniciarVitoriaComAudio,"function","Falta aguardar histórico e música no Play");
    await assert.rejects(cliente.iniciarVitoriaComAudio(()=>true), /não liberou o áudio/);
    assert.equal(inicioAudio,0);
    permitirAudio=true;
    let vigente=true;
    const primeiro=cliente.iniciarVitoriaComAudio(()=>vigente);
    assert.equal(desbloqueios,2,"O contexto deve ser liberado dentro do gesto de Play");
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(inicioAudio,0);
    vigente=false;liberarHistorico();
    assert.equal(await primeiro,false);
    assert.equal(inicioAudio,0);
    await assert.rejects(cliente.iniciarVitoriaComAudio(()=>true), /carregar a música/);
    assert.equal(inicioAudio,0,"Falha na música não pode iniciar um filme sem trilha");
    musicaDisponivel=true;
    assert.equal(await cliente.iniciarVitoriaComAudio(()=>true),true);
    assert.equal(inicioAudio,1);
    const audio=await import("../src/lib/sons.ts");audio.pararSom();
  } finally {Object.assign(globalThis,original);}
});
