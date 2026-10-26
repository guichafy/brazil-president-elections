import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { SCOPES, candidates, validatePhoto } from "./lib/archive.mjs";

const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");
const election = process.env.TSE_ELEICAO ?? "6258";
const archive = JSON.parse(await readFile(`data/resultados-${election}.json`, "utf8"));
const html = await readFile("out/index.html", "utf8");
assert(html.includes("100% apurado"), "O HTML inicial precisa conter o resultado");
assert(html.includes("Momento da apuração"), "Slider de reprodução ausente");
assert(!html.includes("Como explorar a apuração"), "O tutorial não deve abrir por padrão");
for (const c of candidates(archive.abrangencias.br)) {
  assert(html.includes(c.nmu), `Candidato ausente do HTML: ${c.nmu}`);
}
for (const [, url] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  assert(!/^https?:/.test(url), `Recurso externo no HTML: ${url}`);
  if (!url.startsWith("/")) continue;
  assert(!base || url.startsWith(`${base}/`), `Recurso sem basePath: ${url}`);
  const local = url.slice(base.length).split("?")[0];
  await access(join("out", decodeURIComponent(local)));
}
for (const scope of SCOPES) {
  const timeline = JSON.parse(await readFile(`out/dados/timeline/${scope}.json`, "utf8"));
  assert.equal(timeline.scope, scope);
  assert.equal(timeline.pontos.at(-1).pctTotalizado, 100);
  for (const c of candidates(archive.abrangencias[scope])) {
    assert.equal(timeline.pontos.at(-1).votos[c.n], Number(c.vap), `${scope}: histórico não termina no resultado arquivado`);
  }
}
const replay = JSON.parse(await readFile("out/dados/replay.json", "utf8"));
assert(replay.pontos.length > 1 && replay.snapshots.length > 0, "Reprodução ausente do artefato");
for (const ponto of replay.pontos) assert.equal(replay.snapshots[ponto.indices.br].scope, "br");
for (const id of ["6257", "6258"]) {
  const a = JSON.parse(await readFile(`data/resultados-${id}.json`, "utf8"));
  for (const c of candidates(a.abrangencias.br)) validatePhoto(await readFile(`out/fotos/${id}/${c.sqcand}.jpeg`));
}
for (const file of ["sons/lula.mp3", "sons/lula-bota-pra-virar.mp3", "sons/bolsonaro.mp3", "sons/lula-vitoria.mp3", "sons/flavio-apreensao.mp3", "imagens/lula.png", "lottie/confete.json", "lottie/fogos.json", "lottie/urna.json", "lottie/bandeira.json"]) await access(join("out", file));
console.log(`Export validado: HTML com resultado e slider, replay, 29 timelines, 14 fotos e assets locais; basePath=${base || "/"}.`);
