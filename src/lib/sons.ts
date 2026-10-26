import { assetPath } from "./assets";

// Alertas sonoros: trechos de áudio em public/sons/, tocados pelo Web Audio; se o arquivo
// não existir ou falhar, toca um som sintetizado no lugar.
// O navegador só libera o áudio depois de um gesto do usuário: chame `desbloquearAudio()` num clique.
// Tocar pelo mesmo AudioContext (e não por <audio>) evita que o Safari bloqueie os alertas automáticos.

let ctx: AudioContext | null = null;

export async function desbloquearAudio(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") await ctx.resume();
  return ctx.state === "running";
}

export const audioLiberado = () => ctx?.state === "running";

function nota(
  c: AudioContext,
  freq: number,
  inicio: number,
  dur: number,
  { tipo = "triangle" as OscillatorType, volume = 0.25, ate, vibrato = 0, filtro }: {
    tipo?: OscillatorType;
    volume?: number;
    ate?: number; // frequência final (glissando)
    vibrato?: number; // profundidade em Hz
    filtro?: number; // corte do passa-baixa em Hz
  } = {},
) {
  const t0 = c.currentTime + inicio;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t0);
  if (ate) osc.frequency.linearRampToValueAtTime(ate, t0 + dur);

  if (vibrato) {
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 6;
    lfoGain.gain.value = vibrato;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + dur);
  }

  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.setValueAtTime(volume, t0 + dur * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  let saida: AudioNode = osc;
  if (filtro) {
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = filtro;
    saida = osc.connect(lp);
  }
  saida.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// Lula sobe ou diminui a vantagem do adversário: sorteia um dos áudios a cada alerta
const AUDIOS_LULA = ["/sons/lula.mp3", "/sons/lula-bota-pra-virar.mp3"];
const AUDIO_BOLSONARO = "/sons/bolsonaro.mp3"; // Flávio Bolsonaro sobe
const AUDIO_VITORIA = "/sons/lula-vitoria.mp3"; // vídeo r4L7BYH1JHA, primeiros 90s; origem em data/audio-vitoria.json
const AUDIO_SUSPENSE = "/sons/flavio-apreensao.mp3"; // vídeo 7y4kJtkioFk; origem em data/audio-suspense.json

const sortear = <T>(lista: T[]) => lista[Math.floor(Math.random() * lista.length)];

const buffers = new Map<string, Promise<AudioBuffer | null>>();
let tocando: AudioBufferSourceNode | null = null;
let faixa:{buffer:AudioBuffer;url:string;loop:boolean;offset:number;inicio:number;pausado:boolean}|null=null;

function carregar(c: AudioContext, url: string): Promise<AudioBuffer | null> {
  let b = buffers.get(url);
  if (!b) {
    b = fetch(assetPath(url))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((dados) => c.decodeAudioData(dados))
      .catch(() => { buffers.delete(url); return null; });
    buffers.set(url, b);
  }
  return b;
}

let pedido = 0; // só o pedido mais recente toca, mesmo que um anterior termine de carregar depois

function interromper() {
  const fonte=tocando;
  tocando = null;
  fonte?.stop();
}

export function posicaoSom():number|null {
  if(!faixa)return null;
  const posicao=faixa.offset+(faixa.pausado ? 0 : Math.max(0,(ctx?.currentTime??0)-faixa.inicio));
  return faixa.loop ? posicao%faixa.buffer.duration : Math.min(faixa.buffer.duration,posicao);
}

export function pausarSom():number|null {
  pedido++;
  const offset=posicaoSom();
  if(faixa&&offset!==null){faixa.offset=offset;faixa.pausado=true;}
  interromper();return offset;
}

export function retomarSom():boolean {
  if(!ctx||ctx.state!=="running"||!faixa||faixa.offset>=faixa.buffer.duration)return false;
  interromper();
  const atual=faixa,src=ctx.createBufferSource();
  src.buffer=atual.buffer;src.loop=atual.loop;src.connect(ctx.destination);
  atual.inicio=ctx.currentTime??0;atual.pausado=false;tocando=src;
  src.onended=()=>{if(tocando===src){tocando=null;atual.offset=atual.buffer.duration;atual.pausado=true;}};
  src.start(0,atual.offset);return true;
}

export function posicionarSom(segundos:number,continuar=true):boolean {
  if(!faixa)return false;
  pausarSom();faixa.offset=Math.max(0,Math.min(faixa.buffer.duration,segundos));
  return continuar ? retomarSom() : true;
}

/**
 * Toca o arquivo interrompendo o anterior, para nunca haver dois áudios ao mesmo tempo;
 * sem arquivo, usa o som sintetizado.
 * Resolve, quando o áudio começa, com a duração dele em segundos; `null` se nada tocou ou se tocou o sintetizado.
 */
async function tocarArquivo(url: string, reserva: () => void, loop=false): Promise<number | null> {
  if (!ctx || ctx.state !== "running") return null;
  const vez = ++pedido;
  const buf = await carregar(ctx, url);
  if (vez !== pedido) return null;
  interromper();
  if (!buf) {
    reserva();
    return null;
  }
  faixa={buffer:buf,url,loop,offset:0,inicio:ctx.currentTime??0,pausado:true};
  return retomarSom() ? buf.duration : null;
}

/** Interrompe o áudio em andamento (os arquivos têm de 6s a 1min) e descarta o que ainda estiver carregando. */
export function pararSom() {
  pedido++;
  interromper();
  faixa=null;
}

export const somFeliz = () => tocarArquivo(sortear(AUDIOS_LULA), arpejoFeliz);
export const somTriste = () => tocarArquivo(AUDIO_BOLSONARO, tromboneTriste);
// A apresentação espera a música real; uma falha permite tentar novamente, sem iniciar um filme mudo.
export const somVitoria = () => tocarArquivo(AUDIO_VITORIA, () => {});

/** Prepara a virada antes do Play, sem tocar uma faixa antecipadamente. */
export async function prepararSonsApresentacao(): Promise<boolean> {
  if (!ctx || ctx.state !== "running") return false;
  const faixas = await Promise.all([carregar(ctx, AUDIO_VITORIA), carregar(ctx, AUDIO_SUSPENSE)]);
  return faixas.every(Boolean);
}

/** Não reinicia a mesma liderança; empate conserva a música atual. O fechamento cancela cargas pendentes. */
export function somApresentacao(lider: "13" | "22" | null, encerrada=false): Promise<number | null> {
  if (encerrada) {
    pararSom();
    return Promise.resolve(null);
  }
  if (lider === null) return Promise.resolve(null);
  const url = lider === "22" ? AUDIO_SUSPENSE : AUDIO_VITORIA;
  if (faixa?.url === url && faixa.loop && tocando) {
    pedido++; // voltar ao líder que já toca também invalida uma troca pendente
    return Promise.resolve(faixa.buffer.duration);
  }
  return tocarArquivo(url, () => {}, true);
}

/** Arpejo maior ascendente com um brilho no final. Também confirma que o som foi ligado. */
export function arpejoFeliz() {
  if (!ctx || ctx.state !== "running") return;
  const notas = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notas.forEach((f, i) => nota(ctx!, f, i * 0.11, i === notas.length - 1 ? 0.6 : 0.16));
  nota(ctx, 2093, 0.44, 0.35, { tipo: "sine", volume: 0.08 });
}

/** "Uá-uá-uá-uáaa" de trombone triste, descendente. */
function tromboneTriste() {
  if (!ctx || ctx.state !== "running") return;
  const opts = { tipo: "sawtooth" as OscillatorType, volume: 0.18, filtro: 900 };
  nota(ctx, 392, 0, 0.32, opts); // G4
  nota(ctx, 369.99, 0.36, 0.32, opts); // F#4
  nota(ctx, 349.23, 0.72, 0.32, opts); // F4
  nota(ctx, 329.63, 1.08, 1.0, { ...opts, ate: 311.13, vibrato: 5 }); // E4 -> Eb4 com vibrato
}
