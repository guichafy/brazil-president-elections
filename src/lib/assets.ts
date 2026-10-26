/** Prefixo fixado no build: vazio no domínio raiz, /<repositório> no Pages. */
export function assetPath(path: string, basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""): string {
  const base = basePath.replace(/\/+$/, "");
  if (!base || path === base || path.startsWith(`${base}/`)) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
