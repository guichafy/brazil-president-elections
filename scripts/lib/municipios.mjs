import assert from "node:assert/strict";
import { SCOPES, candidates } from "./archive.mjs";

/** UFs e exterior: as abrangências que têm municípios no catálogo do TSE. */
export const SCOPES_MUNICIPAIS = SCOPES.filter((s) => s !== "br");

const int = (s) => {
  const n = Number(s);
  assert(Number.isInteger(n) && n >= 0, `Número inválido: ${s}`);
  return n;
};

/** Só os campos usados pela análise; a resposta bruta tem ~3 KB por município. */
export function compactMunicipio(entry, raw, numeros) {
  const votos = new Map(candidates(raw).map((c) => [c.n, int(c.vap)]));
  return {
    cd: entry.cd, ibge: entry.cdi, nm: entry.nm, cap: entry.c === "s",
    tf: raw.tf, dt: raw.dt, ht: raw.ht,
    ts: int(raw.s.ts), st: int(raw.s.st),
    te: int(raw.e.te), c: int(raw.e.c), a: int(raw.e.a),
    vv: int(raw.v.vv), vb: int(raw.v.vb), tvn: int(raw.v.tvn),
    v: numeros.map((n) => votos.get(n) ?? 0),
  };
}

const CAMPOS_SOMADOS = [["s", "ts"], ["s", "st"], ["e", "te"], ["e", "c"], ["e", "a"], ["v", "vv"], ["v", "vb"], ["v", "tvn"]];

/**
 * Cada município precisa estar 100% totalizado e consistente, e a soma dos
 * municípios de uma UF precisa bater com o arquivo da UF já arquivado.
 */
export function validateMunicipios(archive, resultados) {
  assert.equal(archive.eleicao, resultados.eleicao, "Eleição diferente do arquivo de resultados");
  assert(Number.isFinite(Date.parse(archive.arquivadoEm)), "Data do arquivo inválida");
  const numeros = candidates(resultados.abrangencias.br).map((c) => c.n);
  assert.deepEqual(archive.candidatos, numeros, "Candidatos diferentes do resultado nacional");
  for (const scope of SCOPES_MUNICIPAIS) {
    const lista = archive.municipios[scope];
    assert(lista?.length, `Municípios ausentes: ${scope}`);
    assert.equal(new Set(lista.map((m) => m.cd)).size, lista.length, `${scope}: município repetido`);
    for (const m of lista) {
      const id = `${scope}/${m.cd}`;
      assert(m.nm && /^\d{5}$/.test(m.cd), `${id}: identificação incompleta`);
      if (scope !== "zz") assert(/^\d{7}$/.test(m.ibge), `${id}: código IBGE ausente`);
      assert(["s", "n"].includes(m.tf), `${id}: indicador de totalização inválido`);
      assert(m.ts > 0 && m.st === m.ts, `${id}: seções incompletas`);
      assert.equal(m.v.length, numeros.length, `${id}: votos por candidato incompletos`);
      assert.equal(m.v.reduce((a, b) => a + b, 0), m.vv, `${id}: votos dos candidatos diferem dos válidos`);
      assert.equal(m.vv + m.vb + m.tvn, m.c, `${id}: votos e comparecimento divergem`);
      // Não exige c + a = te: no exterior há cidade com te=3, c=0 e a=0 no próprio arquivo do TSE.
      assert(m.c <= m.te, `${id}: comparecimento maior que o eleitorado`);
    }
    const uf = resultados.abrangencias[scope];
    for (const [grupo, campo] of CAMPOS_SOMADOS) {
      const soma = lista.reduce((n, m) => n + m[campo], 0);
      assert.equal(soma, Number(uf[grupo][campo]), `${scope}: a soma dos municípios difere da UF em ${grupo}.${campo}`);
    }
    const votosUf = new Map(candidates(uf).map((c) => [c.n, Number(c.vap)]));
    numeros.forEach((n, i) => {
      assert.equal(lista.reduce((s, m) => s + m.v[i], 0), votosUf.get(n) ?? 0, `${scope}: a soma dos municípios difere da UF para o candidato ${n}`);
    });
  }
}

/** Uma linha por município: diffs legíveis sem o volume da indentação completa. */
export function serializeMunicipios(archive) {
  const { municipios, ...cabecalho } = archive;
  const head = JSON.stringify(cabecalho).slice(0, -1);
  const blocos = SCOPES_MUNICIPAIS.map((s) => `${JSON.stringify(s)}:[\n${municipios[s].map((m) => JSON.stringify(m)).join(",\n")}\n]`);
  return `${head},"municipios":{\n${blocos.join(",\n")}\n}}\n`;
}
