import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { SCOPES } from "../scripts/lib/archive.mjs";
import { SCOPES_MUNICIPAIS, serializeMunicipios, validateMunicipios } from "../scripts/lib/municipios.mjs";
import { carregarApuracao } from "../src/lib/static-data.ts";
import { carregarMunicipios, nomeProprio } from "../src/lib/municipios.ts";

function fixture() {
  const uf = (n) => ({
    ele: "6258", tf: "s",
    s: { ts: String(n), st: String(n) }, e: { te: String(10 * n), c: String(8 * n), a: String(2 * n) },
    v: { vv: String(7 * n), vb: "0", tvn: String(n) },
    carg: [{ agr: [{ par: [{ cand: [{ n: "13", vap: String(4 * n) }, { n: "22", vap: String(3 * n) }] }] }] }],
  });
  const mun = (cd) => ({ cd, ibge: scopeIbge(cd), nm: "CIDADE", cap: false, tf: "s", dt: "", ht: "", ts: 1, st: 1, te: 10, c: 8, a: 2, vv: 7, vb: 0, tvn: 1, v: [4, 3] });
  const scopeIbge = (cd) => `99${cd}`;
  return {
    resultados: { eleicao: "6258", abrangencias: Object.fromEntries(SCOPES.map((s) => [s, uf(s === "br" ? 2 * SCOPES_MUNICIPAIS.length : 2)])) },
    archive: {
      eleicao: "6258", arquivadoEm: "2026-10-26T12:00:00Z", candidatos: ["13", "22"],
      municipios: Object.fromEntries(SCOPES_MUNICIPAIS.map((s) => [s, [mun("00001"), mun("00002")]])),
    },
  };
}

test("accepts municipalities that add up to each UF", () => {
  const { archive, resultados } = fixture();
  assert.doesNotThrow(() => validateMunicipios(archive, resultados));
  assert.deepEqual(JSON.parse(serializeMunicipios(archive)), archive);
});

test("rejects missing, partial or inconsistent municipalities", () => {
  let f = fixture(); f.archive.municipios.sp.pop();
  assert.throws(() => validateMunicipios(f.archive, f.resultados), /sp: a soma/);
  f = fixture(); f.archive.municipios.mg[0].st = 0;
  assert.throws(() => validateMunicipios(f.archive, f.resultados), /mg\/00001: seções/);
  f = fixture(); f.archive.municipios.ba[0].v = [5, 2];
  assert.throws(() => validateMunicipios(f.archive, f.resultados), /ba: a soma.*13/);
  f = fixture(); f.archive.municipios.rs[1].cd = "00001";
  assert.throws(() => validateMunicipios(f.archive, f.resultados), /repetido/);
});

test("formats official uppercase names", () => {
  assert.equal(nomeProprio("RIO DE JANEIRO"), "Rio de Janeiro");
  assert.equal(nomeProprio("SANTA BÁRBARA D'OESTE"), "Santa Bárbara D'Oeste");
  assert.equal(nomeProprio("EMBU-GUAÇU"), "Embu-Guaçu");
  assert.equal(nomeProprio("E"), "E");
});

test("archived municipalities match every UF and carry map outlines", async () => {
  const d = await carregarApuracao();
  const archive = JSON.parse(await readFile(`data/municipios-${d.eleicao}.json`, "utf8"));
  for (const scope of SCOPES_MUNICIPAIS) {
    const m = await carregarMunicipios(scope);
    const uf = scope === "zz" ? d.exterior : d.ufs[scope];
    assert.equal(m.municipios.length, archive.municipios[scope].length, scope);
    for (const c of uf.candidatos) {
      const i = m.candidatos.indexOf(c.numero);
      assert.equal(m.municipios.reduce((n, x) => n + x.votos[i], 0), c.votos, `${scope}/${c.numero}`);
    }
    if (scope === "zz") {
      assert.equal(m.mapa, null);
    } else {
      assert(m.mapa.altura > 0 && m.mapa.largura === 600, scope);
      // Boa Esperança do Norte (MT) foi criado depois da malha publicada pelo IBGE.
      assert(m.municipios.filter((x) => !x.d).length <= 1, `${scope}: contornos ausentes`);
    }
    if (d.eleicao === "6258") assert(m.municipios.every((x) => x.primeiroTurno), `${scope}: 1º turno ausente`);
  }
});
