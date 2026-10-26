const intFmt = new Intl.NumberFormat("pt-BR");
const pctFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtInt = (n: number) => intFmt.format(n);
export const fmtPct = (n: number) => `${pctFmt.format(n)}%`;

const ppFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "exceptZero" });
/** Diferença em pontos percentuais: "+3,4 p.p." */
export const fmtPP = (n: number, unidade = " p.p.") => `${ppFmt.format(n)}${unidade}`;

/** "FLAVIO BOLSONARO" -> "Flavio" */
export function primeiroNome(nome: string) {
  const p = nome.split(" ")[0];
  return p.charAt(0) + p.slice(1).toLowerCase();
}
