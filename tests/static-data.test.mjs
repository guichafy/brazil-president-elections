import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { SCOPES, candidates, validateArchive, validatePhoto } from "../scripts/lib/archive.mjs";
import { assetPath } from "../src/lib/assets.ts";
import { carregarApuracao, carregarComparacao, carregarTimeline } from "../src/lib/static-data.ts";

test("prefixes public assets for project Pages without doubling the prefix", () => {
  assert.equal(assetPath("/sons/lula.mp3", "/Eleicao"), "/Eleicao/sons/lula.mp3");
  assert.equal(assetPath("/Eleicao/fotos/6258/1.jpeg", "/Eleicao"), "/Eleicao/fotos/6258/1.jpeg");
  assert.equal(assetPath("/imagens/", "/Eleicao/"), "/Eleicao/imagens/");
  assert.equal(assetPath("/lottie/fogos.json", ""), "/lottie/fogos.json");
});

for (const eleicao of ["6257", "6258"]) {
  test(`archived election ${eleicao} and every photo are complete`, async () => {
    const archive = JSON.parse(await readFile(`data/resultados-${eleicao}.json`, "utf8"));
    validateArchive(archive);
    for (const c of candidates(archive.abrangencias.br)) validatePhoto(await readFile(`public/fotos/${eleicao}/${c.sqcand}.jpeg`));
    const last = new Map((await readFile(`data/snapshots-${eleicao}.jsonl`, "utf8")).trim().split("\n").map((s) => { const snap = JSON.parse(s); return [snap.scope, snap]; }));
    for (const scope of SCOPES) {
      const raw = archive.abrangencias[scope], snap = last.get(scope);
      assert.equal(Number(raw.s.st), snap.st, scope);
      assert.equal(Number(raw.v.vv), snap.vv, scope);
      for (const c of candidates(raw)) assert.equal(Number(c.vap), snap.cands.find((s) => s.n === c.n).vap, `${scope}/${c.n}`);
    }
  });
}

test("build data retains official metadata and uses local candidate photos", async () => {
  const d = await carregarApuracao();
  assert(d.nacional.finalizado);
  assert.equal(Object.keys(d.ufs).length, 27);
  assert(d.exterior);
  assert.deepEqual(d.erros, []);
  if (d.nacional.turno === "2") assert(d.nacional.candidatos.some((c) => c.eleito && c.situacao === "Eleito"));
  for (const r of [d.nacional, d.exterior, ...Object.values(d.ufs)]) {
    assert.equal(r.pctTotalizado, 100);
    for (const c of r.candidatos) assert.match(c.foto, new RegExp(`/fotos/${d.eleicao}/[0-9]+\\.jpeg$`));
  }
  for (const c of d.projecao.tendencia.candidatos) assert.equal(c.votosProj, c.votos);
  const raw = JSON.parse(await readFile(`data/resultados-${d.eleicao}.json`, "utf8"));
  assert.equal(d.ufs.rr.finalizado, raw.abrangencias.rr.tf === "s");
});

test("all 29 timelines retain their final point and national historical projections", async () => {
  const d = await carregarApuracao();
  for (const scope of SCOPES) {
    const t = await carregarTimeline(scope);
    assert.equal(t.scope, scope);
    assert(t.pontos.length > 0, scope);
    const last = t.pontos.at(-1);
    assert.equal(last.pctTotalizado, 100, scope);
    const result = scope === "br" ? d.nacional : scope === "zz" ? d.exterior : d.ufs[scope];
    for (const c of result.candidatos) assert.equal(last.votos[c.numero], c.votos, `${scope}/${c.numero}`);
    if (scope === "br") assert(t.pontos.some((p) => p.proj), "projeções históricas ausentes");
  }
});

test("comparison retains 2022 and first-round reference series", async () => {
  const c = await carregarComparacao();
  assert(c.ano2022.pontos.length > 0);
  if ((process.env.TSE_ELEICAO ?? "6258") === "6258") {
    assert(c.primeiroTurno.pontos.length > 0);
    assert.equal(c.primeiroTurno.pontos.at(-1).apurado, 100);
  }
});
