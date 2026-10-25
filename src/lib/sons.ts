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

const AUDIO_LULA = "/sons/lula.mp3"; // Lula sobe ou diminui a vantagem do adversário
const AUDIO_BOLSONARO = "/sons/bolsonaro.mp3"; // Flávio Bolsonaro sobe

const buffers = new Map<string, Promise<AudioBuffer | null>>();
let tocando: AudioBufferSourceNode | null = null;

function carregar(c: AudioContext, url: string): Promise<AudioBuffer | null> {
  let b = buffers.get(url);
  if (!b) {
    b = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((dados) => c.decodeAudioData(dados))
      .catch(() => null);
    buffers.set(url, b);
  }
  return b;
}

let pedido = 0; // só o pedido mais recente toca, mesmo que um anterior termine de carregar depois

function interromper() {
  tocando?.stop();
  tocando = null;
}

/**
 * Toca o arquivo interrompendo o anterior, para nunca haver dois áudios ao mesmo tempo;
 * sem arquivo, usa o som sintetizado.
 */
async function tocarArquivo(url: string, reserva: () => void) {
  if (!ctx || ctx.state !== "running") return;
  const vez = ++pedido;
  const buf = await carregar(ctx, url);
  if (vez !== pedido) return;
  interromper();
  if (!buf) return reserva();
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.onended = () => {
    if (tocando === src) tocando = null;
  };
  src.start();
  tocando = src;
}

/** Interrompe o áudio em andamento (os arquivos têm 15–22s) e descarta o que ainda estiver carregando. */
export function pararSom() {
  pedido++;
  interromper();
}

export const somFeliz = () => tocarArquivo(AUDIO_LULA, arpejoFeliz);
export const somTriste = () => tocarArquivo(AUDIO_BOLSONARO, tromboneTriste);

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
