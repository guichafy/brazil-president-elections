import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { geoIdentity, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { validateArchive } from "../../scripts/lib/archive.mjs";
import { validateMunicipios } from "../../scripts/lib/municipios.mjs";
import { ELEICAO, ELEICAO_1T } from "./config";
import { fmtBrasilia, toIso } from "./tse";
import type { Municipio, MunicipiosResponse } from "./types";
import type { Scope } from "./ufs";

interface MunicipioArquivado {
  cd: string; ibge: string; nm: string; cap: boolean; tf: string; dt: string; ht: string;
  te: number; c: number; a: number; vv: number; vb: number; tvn: number; v: number[];
}
interface ArquivoMunicipios {
  eleicao: string;
  candidatos: string[];
  municipios: Record<Exclude<Scope, "br">, MunicipioArquivado[]>;
}
type Malha = FeatureCollection<Polygon | MultiPolygon, { ibge: string }>;

const LARGURA = 600;
const arquivos = new Map<string, Promise<ArquivoMunicipios>>();

/** Lê e valida uma vez por build; o arquivo de resultados da mesma eleição confere as somas. */
function lerMunicipios(eleicao: string) {
  let p = arquivos.get(eleicao);
  if (!p) {
    p = (async () => {
      const ler = async (nome: string) => JSON.parse(await readFile(join(process.cwd(), "data", nome), "utf8"));
      const [arquivo, resultados] = await Promise.all([ler(`municipios-${eleicao}.json`), ler(`resultados-${eleicao}.json`)]);
      validateArchive(resultados);
      validateMunicipios(arquivo, resultados);
      return arquivo as ArquivoMunicipios;
    })();
    arquivos.set(eleicao, p);
  }
  return p;
}

const MINUSCULAS = new Set(["da", "das", "de", "do", "dos", "e"]);

/** "SANTA BÁRBARA D'OESTE" -> "Santa Bárbara D'Oeste"; "RIO DE JANEIRO" -> "Rio de Janeiro" */
export function nomeProprio(nome: string): string {
  return nome
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.replace(/(^|[-'’])(\p{L})/gu, (_, sep, l) => sep + l.toLocaleUpperCase("pt-BR"))))
    .join(" ");
}

/**
 * Contornos já projetados, para o navegador só desenhar. A longitude é encolhida
 * pelo cosseno da latitude central, o que evita esticar os estados do Sul.
 */
async function contornos(scope: Scope) {
  const malha: Malha = JSON.parse(await readFile(join(process.cwd(), "data", "malhas", `${scope}.json`), "utf8"));
  const lats = malha.features.flatMap((f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates).flatMap((p) => p[0].map((pt) => pt[1])));
  const k = Math.cos((((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI) / 180);
  const ring = (r: Position[]) => r.map(([x, y]) => [x * k, y]);
  const plana: Malha = {
    ...malha,
    features: malha.features.map((f): Feature<Polygon | MultiPolygon, { ibge: string }> => ({
      ...f,
      geometry: f.geometry.type === "Polygon"
        ? { type: "Polygon", coordinates: f.geometry.coordinates.map(ring) }
        : { type: "MultiPolygon", coordinates: f.geometry.coordinates.map((p) => p.map(ring)) },
    })),
  };
  // Projeção plana, como no mapa do Brasil: ignora a orientação dos polígonos do IBGE.
  // Altura folgada: a largura é sempre o limite, e a altura sai do contorno projetado.
  const projection = geoIdentity().reflectY(true).fitSize([LARGURA, LARGURA * 10], plana);
  const path = geoPath(projection).digits(1);
  const [[, topo], [, base]] = path.bounds(plana);
  const [tx, ty] = projection.translate();
  projection.translate([tx, ty - topo]);
  const altura = Math.ceil(base - topo);
  return { largura: LARGURA, altura, porIbge: new Map(plana.features.map((f) => [f.properties.ibge, path(f) ?? ""])) };
}

export async function carregarMunicipios(scope: Exclude<Scope, "br">): Promise<MunicipiosResponse> {
  const atual = await lerMunicipios(ELEICAO);
  const anterior = ELEICAO_1T ? await lerMunicipios(ELEICAO_1T) : null;
  const ref = anterior && new Map(anterior.municipios[scope].map((m) => [m.cd, m]));
  const idx1T = anterior ? atual.candidatos.map((n) => anterior.candidatos.indexOf(n)) : [];
  const mapa = scope === "zz" ? null : await contornos(scope);
  const municipios = atual.municipios[scope].map((m): Municipio => {
    const m1 = ref?.get(m.cd);
    return {
      cd: m.cd, ibge: m.ibge, nome: nomeProprio(m.nm), capital: m.cap,
      // No exterior, dt/ht vêm no fuso de cada país.
      dataHora: scope === "zz" || !m.dt ? "" : fmtBrasilia(toIso(m.dt, m.ht, scope)),
      finalizado: m.tf === "s",
      eleitorado: m.te, comparecimento: m.c, abstencao: m.a,
      validos: m.vv, brancos: m.vb, nulos: m.tvn, votos: m.v,
      ...(m1 ? { primeiroTurno: { validos: m1.vv, votos: idx1T.map((i) => (i >= 0 ? m1.v[i] : 0)) } } : {}),
      ...(mapa?.porIbge.get(m.ibge) ? { d: mapa.porIbge.get(m.ibge) } : {}),
    };
  });
  return {
    scope, candidatos: atual.candidatos,
    mapa: mapa && { largura: mapa.largura, altura: mapa.altura },
    municipios,
  };
}
