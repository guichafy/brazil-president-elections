// Atualização manual do arquivo permanente. Nunca executado pelo build/deploy.
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { SCOPES, candidates, validateArchive, validatePhoto } from "./lib/archive.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const elections = process.argv.slice(2);
if (!elections.length) elections.push("6257", "6258");
if (elections.some((id) => !["6257", "6258"].includes(id))) throw new Error("Use: npm run archive -- [6257|6258]");

async function download(url) {
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

for (const eleicao of elections) {
  const base = `https://resultados.tse.jus.br/oficial/ele2026/${eleicao}`;
  const abrangencias = {};
  // Lotes pequenos para evitar dezenas de downloads simultâneos do CDN.
  for (let i = 0; i < SCOPES.length; i += 5) {
    await Promise.all(SCOPES.slice(i, i + 5).map(async (scope) => {
      const url = `${base}/dados/${scope}/${scope}-c0001-e${eleicao.padStart(6, "0")}-u.json`;
      abrangencias[scope] = JSON.parse((await download(url)).toString("utf8"));
    }));
  }
  const archive = { eleicao, arquivadoEm: new Date().toISOString(), fonte: base, abrangencias: Object.fromEntries(SCOPES.map((s) => [s, abrangencias[s]])) };
  validateArchive(archive);
  const photos = new Map();
  for (const c of candidates(abrangencias.br)) {
    const photo = await download(`${base}/fotos/br/${c.sqcand}.jpeg`);
    validatePhoto(photo);
    photos.set(c.sqcand, photo);
  }
  // Só grava depois de validar a captura e baixar todas as fotos da eleição.
  const dir = join(root, "public", "fotos", eleicao);
  await mkdir(dir, { recursive: true });
  for (const [id, photo] of photos) await writeFile(join(dir, `${id}.jpeg`), photo);
  await writeFile(join(root, "data", `resultados-${eleicao}.json`), JSON.stringify(archive, null, 2) + "\n");
  console.log(`Eleição ${eleicao}: ${SCOPES.length} resultados completos e ${photos.size} fotos arquivados.`);
}
