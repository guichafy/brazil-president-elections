import { assetPath } from "./assets";
import type { ReplayResponse } from "./types";
import { desbloquearAudio, somVitoria } from "./sons";

let carregando: Promise<ReplayResponse> | undefined;

/** Compartilha o mesmo arquivo entre o slider e o timelapse; falhas podem ser repetidas. */
export function carregarReplayCliente(): Promise<ReplayResponse> {
  return carregando ??= fetch(assetPath("/dados/replay.json"))
    .then(async r => {
      if (!r.ok) throw new Error(`Histórico: HTTP ${r.status}`);
      const json: ReplayResponse = await r.json();
      if (json.pontos.length < 2) throw new Error("Histórico insuficiente");
      return json;
    })
    .catch(err => { carregando = undefined; throw err; });
}

/** Chamado no clique: libera o contexto antes de esperar a rede e só toca com o filme pronto. */
export async function iniciarVitoriaComAudio(vigente: () => boolean): Promise<boolean> {
  if (!(await desbloquearAudio())) throw new Error("O navegador não liberou o áudio. Toque em iniciar novamente.");
  if (!vigente()) return false;
  await carregarReplayCliente();
  if (!vigente()) return false;
  const duracao = await somVitoria();
  if (!vigente()) return false;
  if (!duracao) throw new Error("Não foi possível carregar a música. Toque em iniciar para tentar novamente.");
  return true;
}
