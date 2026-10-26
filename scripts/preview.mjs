// Preview do próprio artefato Pages, inclusive sob /<repositório>/.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const root = resolve("out");
const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");
const port = Number(process.env.PORT ?? 3000);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".svg": "image/svg+xml", ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".png": "image/png", ".ico": "image/x-icon", ".mp3": "audio/mpeg", ".woff2": "font/woff2" };

createServer(async (req, res) => {
  try {
    if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (base && pathname !== base && !pathname.startsWith(`${base}/`)) { res.writeHead(404).end(); return; }
    let file = resolve(root, `.${pathname.slice(base.length) || "/"}`);
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    const content = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream", "Content-Length": content.length });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch {
    res.writeHead(404).end();
  }
}).listen(port, "127.0.0.1", () => console.log(`Preview: http://localhost:${port}${base}/`));
