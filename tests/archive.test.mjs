import assert from "node:assert/strict";
import { test } from "node:test";
import { SCOPES, validateArchive, validatePhoto } from "../scripts/lib/archive.mjs";

function fixture() {
  return {
    eleicao: "6258",
    arquivadoEm: "2026-10-26T12:00:00Z",
    abrangencias: Object.fromEntries(SCOPES.map((scope) => [scope, {
      ele: "6258", t: "2", tf: "s",
      s: { st: scope === "br" ? "28" : "1", ts: scope === "br" ? "28" : "1" },
      e: { te: scope === "br" ? "280" : "10", est: scope === "br" ? "280" : "10", c: scope === "br" ? "280" : "10" },
      v: { vv: scope === "br" ? "280" : "10", vb: "0", tvn: "0" },
      carg: [{ agr: [{ par: [{ sg: "PT", cand: [{ n: "13", sqcand: "123", nmu: "Nome", nm: "Nome completo", vap: scope === "br" ? "280" : "10", e: "s", st: "Eleito" }] }] }] }],
    }])),
  };
}

test("accepts complete finalized results for all 29 scopes", () => {
  assert.doesNotThrow(() => validateArchive(fixture()));
});
test("rejects a missing scope and unfinished counting", () => {
  const missing = fixture(); delete missing.abrangencias.sp;
  assert.throws(() => validateArchive(missing), /sp/);
  const unfinished = fixture(); unfinished.abrangencias.zz.s.st = "0";
  assert.throws(() => validateArchive(unfinished), /zz/);
});
test("preserves regional tf=n at 100% while requiring national finalization", () => {
  const archive = fixture();
  archive.abrangencias.rr.tf = "n";
  archive.abrangencias.rr.carg[0].agr[0].par[0].cand[0].st = "";
  assert.doesNotThrow(() => validateArchive(archive));
  assert.equal(archive.abrangencias.rr.tf, "n");
  archive.abrangencias.br.tf = "n";
  assert.throws(() => validateArchive(archive), /nacional/);
});
test("rejects inconsistent candidate votes and national totals", () => {
  const votes = fixture(); votes.abrangencias.br.v.vv = "279";
  assert.throws(() => validateArchive(votes), /votos|válidos/);
  const totals = fixture(); totals.abrangencias.sp.s.ts = "2"; totals.abrangencias.sp.s.st = "2";
  assert.throws(() => validateArchive(totals), /soma|total/);
});
test("rejects an HTML error page saved as a candidate photo", () => {
  assert.throws(() => validatePhoto(Buffer.from("<html>404</html>")), /JPEG/);
  assert.doesNotThrow(() => validatePhoto(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9])));
});
