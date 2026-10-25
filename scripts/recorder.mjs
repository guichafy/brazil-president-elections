// Gravador de snapshots da apuração (TSE não guarda histórico).
// Uso: node scripts/recorder.mjs   (variáveis: ELEICAO=6258 INTERVAL=30)
import { appendFileSync, mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ELEICAO = process.env.ELEICAO ?? "6258";
const CARGO = "0001";
const INTERVAL = Number(process.env.INTERVAL ?? 30) * 1000;
const BASE = `https://resultados.tse.jus.br/oficial/ele2026/${ELEICAO}/dados`;
const SCOPES = ["br", "ac", "al", "am", "ap", "ba", "ce", "df", "es", "go", "ma", "mg", "ms", "mt", "pa", "pb", "pe", "pi", "pr", "rj", "rn", "ro", "rr", "rs", "sc", "se", "sp", "to", "zz"];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "data", `snapshots-${ELEICAO}.jsonl`);
// eleitorado (fixo) de cada abrangência, usado pela projeção para todas as linhas
const outEleitorado = join(root, "data", `eleitorado-${ELEICAO}.json`);
mkdirSync(dirname(out), { recursive: true });

// último idg gravado por abrangência, para não duplicar
const last = new Map();
if (existsSync(out)) {
  for (const line of readFileSync(out, "utf8").split("\n")) {
    if (!line) continue;
    try {
      const s = JSON.parse(line);
      last.set(s.scope, `${s.dt} ${s.ht}|${s.st}`);
    } catch {}
  }
}

function compact(scope, d) {
  const cands = [];
  for (const agr of d.carg[0].agr)
    for (const par of agr.par)
      for (const c of par.cand) cands.push({ n: c.n, vap: Number(c.vap) });
  return {
    scope,
    dt: d.dt,
    ht: d.ht,
    idg: d.idg,
    st: Number(d.s.st),
    ts: Number(d.s.ts),
    vv: Number(d.v.vv),
    vb: Number(d.v.vb),
    tvn: Number(d.v.tvn),
    c: Number(d.e.c),
    te: Number(d.e.te),
    est: Number(d.e.est),
    rec: new Date().toISOString(),
    cands,
  };
}

async function tick() {
  const results = await Promise.allSettled(
    SCOPES.map(async (uf) => {
      const r = await fetch(`${BASE}/${uf}/${uf}-c${CARGO}-e00${ELEICAO}-u.json`, { cache: "no-store" });
      if (!r.ok) throw new Error(`${uf} HTTP ${r.status}`);
      return compact(uf, await r.json());
    }),
  );
  const eleitorado = Object.fromEntries(
    results.flatMap((r) => (r.status === "fulfilled" ? [[r.value.scope, r.value.te]] : [])),
  );
  if (Object.keys(eleitorado).length === SCOPES.length) writeFileSync(outEleitorado, JSON.stringify(eleitorado));

  let n = 0;
  for (const res of results) {
    if (res.status !== "fulfilled") {
      console.error(new Date().toISOString(), res.reason?.message ?? res.reason);
      continue;
    }
    const s = res.value;
    const key = `${s.dt} ${s.ht}|${s.st}`;
    if (last.get(s.scope) === key) continue;
    last.set(s.scope, key);
    appendFileSync(out, JSON.stringify(s) + "\n");
    n++;
  }
  const br = results[0].status === "fulfilled" ? results[0].value : null;
  console.log(new Date().toISOString(), `gravados=${n}`, br ? `br ${br.ht} ${((br.st / br.ts) * 100).toFixed(2)}%` : "");
}

console.log(`Gravando eleição ${ELEICAO} a cada ${INTERVAL / 1000}s em ${out}`);
await tick();
setInterval(() => tick().catch((e) => console.error(e)), INTERVAL);
