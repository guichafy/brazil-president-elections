import { assetPath } from "./assets";
import type { ReplayResponse } from "./types";

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
