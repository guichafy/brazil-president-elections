import assert from "node:assert/strict";
import { test } from "node:test";
import { carregarApuracao, carregarReplay } from "../src/lib/static-data.ts";
import { aplicarReplay, indicePorPercentual } from "../src/lib/replay.ts";

test("replays an early recorded state without leaking final elected status or abstention", async () => {
  const final = await carregarApuracao(), replay = await carregarReplay();
  const early = aplicarReplay(final, replay, 0);
  assert(early.nacional.pctTotalizado < 100);
  assert(early.nacional.validos < final.nacional.validos);
  assert(early.nacional.candidatos.every((c) => !c.eleito && !c.situacao));
  assert.equal(early.nacional.abstencaoDisponivel, false);
  assert.equal(early.nacional.candidatos.reduce((n,c) => n+c.votos,0), early.nacional.validos);
  assert.notEqual(early.ufs.sp.validos, final.ufs.sp.validos);
  assert.equal(final.nacional.pctTotalizado, 100, "não modifica o resultado original");
});
test("slider positions update national, regional and projected data from the same recorded cycle", async () => {
  const final = await carregarApuracao(), replay = await carregarReplay();
  assert(replay.pontos.length > 100);
  const idx = Math.floor(replay.pontos.length / 2), frame = replay.pontos[idx];
  const current = aplicarReplay(final, replay, idx);
  assert.equal(current.nacional.validos, replay.snapshots[frame.indices.br].vv);
  assert.equal(current.ufs.sp.validos, replay.snapshots[frame.indices.sp].vv);
  for (const i of Object.values(frame.indices)) assert(Date.parse(replay.snapshots[i].rec) <= Date.parse(frame.rec) + 15_000);
  assert(current.projecao);
});
test("the end of the slider restores the exact official archive, including regional tf", async () => {
  const final = await carregarApuracao(), replay = await carregarReplay();
  assert.equal(aplicarReplay(final, replay, replay.pontos.length-1), final);
  assert.equal(aplicarReplay(final, replay, 999999), final);
  assert.equal(aplicarReplay(final, replay, -1).nacional.validos, replay.snapshots[replay.pontos[0].indices.br].vv);
});

test("early frames retain zero-count regional records for both projection methods", async () => {
  const final = await carregarApuracao(), replay = await carregarReplay();
  const first = replay.pontos[0];
  assert.equal(Object.keys(first.indices).length, 29);
  const early = aplicarReplay(final, replay, 0);
  assert(early.ufs.ac.isoDataHora !== final.ufs.ac.isoDataHora);
  assert(first.projecao.proporcional.validosProj > 100_000_000);
});

test("percentage scrubbing chooses the nearest recorded frame and 100 restores the final", async () => {
  const replay = await carregarReplay();
  assert.equal(indicePorPercentual(replay, 0), 0);
  assert.equal(indicePorPercentual(replay, 100), replay.pontos.length - 1);
  const i = indicePorPercentual(replay, 50), s = replay.snapshots[replay.pontos[i].indices.br];
  const menorDistancia = Math.min(...replay.pontos.map((p) => { const r = replay.snapshots[p.indices.br]; return Math.abs(r.st / r.ts * 100 - 50); }));
  assert.equal(Math.abs(s.st / s.ts * 100 - 50), menorDistancia);
});
