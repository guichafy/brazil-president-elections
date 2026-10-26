import assert from "node:assert/strict";

export const SCOPES = ["br", "ac", "al", "am", "ap", "ba", "ce", "df", "es", "go", "ma", "mg", "ms", "mt", "pa", "pb", "pe", "pi", "pr", "rj", "rn", "ro", "rr", "rs", "sc", "se", "sp", "to", "zz"];

export async function download(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt === 3) throw err;
      console.warn(`Nova tentativa ${attempt + 1}: ${url}`);
    }
  }
}

export function candidates(raw) {
  return raw.carg.flatMap((cargo) => cargo.agr.flatMap((agr) => agr.par.flatMap((par) => par.cand)));
}

/** Não permite publicar silenciosamente uma captura parcial ou inconsistente. */
export function validateArchive(archive) {
  assert(["6257", "6258"].includes(archive.eleicao), "Eleição desconhecida");
  assert(Number.isFinite(Date.parse(archive.arquivadoEm)), "Data do arquivo inválida");
  for (const scope of SCOPES) {
    const r = archive.abrangencias[scope];
    assert(r, `Abrangência ausente: ${scope}`);
    assert.equal(r.ele, archive.eleicao, `${scope}: eleição diferente`);
    assert(["s", "n"].includes(r.tf), `${scope}: indicador de totalização inválido`);
    if (scope === "br") assert.equal(r.tf, "s", "Totalização nacional não finalizada");
    assert(Number(r.s.ts) > 0 && r.s.st === r.s.ts, `${scope}: seções incompletas`);
    const cands = candidates(r);
    assert(cands.length > 0, `${scope}: candidatos ausentes`);
    for (const c of cands) {
      assert(c.n && c.nmu && c.nm && c.sqcand && typeof c.st === "string" && ["s", "n"].includes(c.e), `${scope}: metadados incompletos`);
      assert(Number.isFinite(Number(c.vap)) && Number(c.vap) >= 0, `${scope}: votos inválidos`);
    }
    assert.equal(cands.reduce((n, c) => n + Number(c.vap), 0), Number(r.v.vv), `${scope}: votos dos candidatos diferem dos válidos`);
    assert.equal(Number(r.v.vv) + Number(r.v.vb) + Number(r.v.tvn), Number(r.e.c), `${scope}: votos e comparecimento divergem`);
  }
  const br = archive.abrangencias.br;
  for (const [group, keys] of [["s", ["st", "ts"]], ["v", ["vv", "vb", "tvn"]], ["e", ["te", "est", "c"]]]) {
    for (const key of keys) {
      const sum = SCOPES.filter((s) => s !== "br").reduce((n, s) => n + Number(archive.abrangencias[s][group][key]), 0);
      assert.equal(sum, Number(br[group][key]), `A soma regional difere do total nacional: ${group}.${key}`);
    }
  }
}

export function validatePhoto(buffer) {
  assert(buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff && buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9, "Foto não é um JPEG completo");
}
