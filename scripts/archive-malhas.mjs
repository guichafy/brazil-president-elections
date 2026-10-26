// Atualização manual das malhas municipais do IBGE. Nunca executado pelo build/deploy.
// Confere os códigos contra data/municipios-<eleição>.json, então rode depois do archive:municipios.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { download } from "./lib/archive.mjs";
import { SCOPES_MUNICIPAIS } from "./lib/municipios.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const eleicao = process.argv[2] ?? "6258";
const { municipios } = JSON.parse(await readFile(join(root, "data", `municipios-${eleicao}.json`), "utf8"));
const dir = join(root, "data", "malhas");
await mkdir(dir, { recursive: true });

// 3 casas decimais (~100 m) bastam para um mapa de ~600 px e reduzem bem o arquivo.
const arredonda = (ring) => {
  const pts = [];
  for (const [x, y] of ring) {
    const p = [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
    const ult = pts.at(-1);
    if (!ult || ult[0] !== p[0] || ult[1] !== p[1]) pts.push(p);
  }
  return pts;
};
const poligono = (rings) => rings.map(arredonda).filter((r) => r.length >= 4);

let semMalha = 0;
for (const scope of SCOPES_MUNICIPAIS.filter((s) => s !== "zz")) {
  const url = `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${scope.toUpperCase()}?intrarregiao=municipio&qualidade=minima&formato=application/vnd.geo+json`;
  const geo = JSON.parse((await download(url)).toString("utf8"));
  const features = geo.features.map((f) => {
    const coordinates = f.geometry.type === "Polygon" ? poligono(f.geometry.coordinates) : f.geometry.coordinates.map(poligono).filter((p) => p.length);
    assert(coordinates.length, `${scope}: geometria vazia em ${f.properties.codarea}`);
    return { type: "Feature", properties: { ibge: f.properties.codarea }, geometry: { type: f.geometry.type, coordinates } };
  });
  const codigos = new Set(features.map((f) => f.properties.ibge));
  const faltando = municipios[scope].filter((m) => !codigos.has(m.ibge));
  // Município criado depois da malha publicada: aparece na tabela, mas não no mapa.
  for (const m of faltando) console.warn(`${scope}: ${m.nm} (${m.ibge}) sem polígono na malha do IBGE`);
  semMalha += faltando.length;
  assert(faltando.length <= 2, `${scope}: ${faltando.length} municípios sem malha`);
  const linhas = features.map((f) => JSON.stringify(f)).join(",\n");
  await writeFile(join(dir, `${scope}.json`), `{"type":"FeatureCollection","features":[\n${linhas}\n]}\n`);
  console.log(`${scope}: ${features.length} municípios`);
}
console.log(`Malhas salvas em data/malhas (${semMalha} municípios sem polígono).`);
