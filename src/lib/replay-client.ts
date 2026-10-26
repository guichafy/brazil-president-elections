import { assetPath } from "./assets";
import type { ReplayResponse } from "./types";
import { desbloquearAudio, prepararSonsApresentacao, somApresentacao } from "./sons";

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
  const replay = await carregarReplayCliente();
  if (!vigente()) return false;
  const preparadas = await prepararSonsApresentacao();
  if (!vigente()) return false;
  if (!preparadas) throw new Error("Não foi possível carregar a música. Toque em iniciar para tentar novamente.");
  const candidatos = replay.snapshots[replay.pontos[0].indices.br].cands;
  const lula = candidatos.find(c => c.n === "13")?.vap;
  const flavio = candidatos.find(c => c.n === "22")?.vap;
  // Sem liderança ainda, o filme pode começar com as trilhas prontas, aguardando votos válidos.
  if (lula === undefined || flavio === undefined || lula === flavio) return true;
  const duracao = await somApresentacao(flavio > lula ? "22" : "13");
  if (!vigente()) return false;
  if (!duracao) throw new Error("Não foi possível carregar a música. Toque em iniciar para tentar novamente.");
  return true;
}
