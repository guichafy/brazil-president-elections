const intFmt = new Intl.NumberFormat("pt-BR");
const pctFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtInt = (n: number) => intFmt.format(n);
export const fmtPct = (n: number) => `${pctFmt.format(n)}%`;
