import { assetPath } from "./assets";

// Códigos vêm de https://resultados.tse.jus.br/oficial/comum/config/ele-c.json
// 6257 = Eleição Ordinária Federal 2026 1º turno (Presidente); 6258 = 2º turno.
export const ELEICAO = process.env.TSE_ELEICAO ?? "6258";
/** No 2º turno, o 1º turno da mesma eleição serve de referência para a projeção. */
export const ELEICAO_1T = ELEICAO === "6258" ? "6257" : null;
export const CICLO = "ele2026";
export const CARGO_PRESIDENTE = "0001";

export const TSE_BASE = `https://resultados.tse.jus.br/oficial/${CICLO}/${ELEICAO}`;

export const fotoUrl = (sqcand: string) => assetPath(`/fotos/${ELEICAO}/${sqcand}.jpeg`);

export const resultadoUrl = (scope: string, cargo = CARGO_PRESIDENTE) =>
  `${TSE_BASE}/dados/${scope}/${scope}-c${cargo}-e${ELEICAO.padStart(6, "0")}-u.json`;
