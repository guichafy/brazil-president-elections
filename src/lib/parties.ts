// Paleta de partidos usada na apuração do g1 (CSS var --apc-party--clr).
const PARTY_COLORS: Record<string, string> = {
  agir: "#5387C5",
  avante: "#4C8790",
  cid: "#C63C94",
  cidadania: "#C63C94",
  dc: "#AB7C24",
  democrata: "#13617C",
  odem: "#13617C",
  mdb: "#4F9960",
  missão: "#D8942F",
  partidomissão: "#D8942F",
  mob: "#C36969",
  mobiliza: "#C36969",
  ptb: "#C36969",
  pnm: "#C36969",
  novo: "#4083A6",
  pcb: "#E54B5A",
  pcdob: "#800313",
  pco: "#923D00",
  pdt: "#2569AD",
  pl: "#272D97",
  pode: "#658C4C",
  podemos: "#658C4C",
  pp: "#5AA0C8",
  prd: "#009B95",
  prtb: "#2152AB",
  psb: "#C6491D",
  psd: "#A0A00B",
  psdb: "#3683CD",
  psol: "#C5A020",
  pstu: "#B35454",
  pt: "#D60828",
  pv: "#098428",
  rede: "#6D6D6D",
  rep: "#3C678A",
  republicanos: "#3C678A",
  sd: "#D86F3A",
  solidariedade: "#D86F3A",
  união: "#485986",
  uniãobrasil: "#485986",
  up: "#454545",
  unidadepopular: "#454545",
};

export const NEUTRAL_COLOR = "#9DA3AE";

export function partyColor(sigla: string): string {
  const key = sigla.toLowerCase().replace(/[\s_-]/g, "");
  return PARTY_COLORS[key] ?? NEUTRAL_COLOR;
}
