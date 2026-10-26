// Atualização manual do resultado por município. Nunca executado pelo build/deploy.
// Depende de data/resultados-<eleição>.json, usado para conferir a soma de cada UF.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { candidates, download, validateArchive } from "./lib/archive.mjs";
import { SCOPES_MUNICIPAIS, compactMunicipio, serializeMunicipios, validateMunicipios } from "./lib/municipios.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const elections = process.argv.slice(2);
if (!elections.length) elections.push("6257", "6258");
if (elections.some((id) => !["6257", "6258"].includes(id))) throw new Error("Use: npm run archive:municipios -- [6257|6258]");

// Poucos downloads simultâneos: são ~5,8 mil arquivos por turno no mesmo CDN.
const CONCORRENCIA = 5;

async function emParalelo(itens, fn) {
  let proximo = 0;
  let feitos = 0;
  await Promise.all(Array.from({ length: CONCORRENCIA }, async () => {
    while (proximo < itens.length) {
      const item = itens[proximo++];
      await fn(item);
      if (++feitos % 500 === 0) console.log(`  ${feitos}/${itens.length}`);
    }
  }));
}

for (const eleicao of elections) {
  const base = `https://resultados.tse.jus.br/oficial/ele2026/${eleicao}`;
  const ele = eleicao.padStart(6, "0");
  const resultados = JSON.parse(await readFile(join(root, "data", `resultados-${eleicao}.json`), "utf8"));
  validateArchive(resultados);
  const numeros = candidates(resultados.abrangencias.br).map((c) => c.n);

  const catalogo = JSON.parse((await download(`${base}/config/mun-e${ele}-cm.json`)).toString("utf8"));
  const porUf = new Map(catalogo.abr.map((a) => [a.cd, a.mu]));
  const tarefas = SCOPES_MUNICIPAIS.flatMap((scope) => {
    const lista = porUf.get(scope);
    if (!lista?.length) throw new Error(`Catálogo sem municípios: ${scope}`);
    return lista.map((entry) => ({ scope, entry }));
  });
  console.log(`Eleição ${eleicao}: baixando ${tarefas.length} municípios`);

  const resultadosMun = new Map();
  await emParalelo(tarefas, async ({ scope, entry }) => {
    const url = `${base}/dados/${scope}/${scope}${entry.cd}-c0001-e${ele}-u.json`;
    const raw = JSON.parse((await download(url)).toString("utf8"));
    if (raw.ele !== eleicao || raw.cdabr !== entry.cd) throw new Error(`${url}: arquivo de outra abrangência`);
    resultadosMun.set(`${scope}/${entry.cd}`, compactMunicipio(entry, raw, numeros));
  });

  const archive = {
    eleicao, arquivadoEm: new Date().toISOString(), fonte: base, candidatos: numeros,
    municipios: Object.fromEntries(SCOPES_MUNICIPAIS.map((scope) => [
      scope, porUf.get(scope).map((entry) => resultadosMun.get(`${scope}/${entry.cd}`)),
    ])),
  };
  // Só grava depois de conferir cada município e a soma de cada UF.
  validateMunicipios(archive, resultados);
  await writeFile(join(root, "data", `municipios-${eleicao}.json`), serializeMunicipios(archive));
  console.log(`Eleição ${eleicao}: ${tarefas.length} municípios arquivados.`);
}
