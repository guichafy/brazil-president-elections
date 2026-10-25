export const UFS = {
  ac: "Acre",
  al: "Alagoas",
  am: "Amazonas",
  ap: "Amapá",
  ba: "Bahia",
  ce: "Ceará",
  df: "Distrito Federal",
  es: "Espírito Santo",
  go: "Goiás",
  ma: "Maranhão",
  mg: "Minas Gerais",
  ms: "Mato Grosso do Sul",
  mt: "Mato Grosso",
  pa: "Pará",
  pb: "Paraíba",
  pe: "Pernambuco",
  pi: "Piauí",
  pr: "Paraná",
  rj: "Rio de Janeiro",
  rn: "Rio Grande do Norte",
  ro: "Rondônia",
  rr: "Roraima",
  rs: "Rio Grande do Sul",
  sc: "Santa Catarina",
  se: "Sergipe",
  sp: "São Paulo",
  to: "Tocantins",
} as const;

export type UF = keyof typeof UFS;
export const UF_LIST = Object.keys(UFS) as UF[];

/** br = nacional, zz = exterior */
export type Scope = UF | "br" | "zz";
export const ALL_SCOPES: Scope[] = ["br", ...UF_LIST, "zz"];

export function scopeName(scope: Scope): string {
  if (scope === "br") return "Brasil";
  if (scope === "zz") return "Exterior";
  return UFS[scope];
}

export function isScope(s: string | null | undefined): s is Scope {
  return !!s && (s === "br" || s === "zz" || s in UFS);
}
