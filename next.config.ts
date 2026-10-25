import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Libera o servidor de dev (HMR/WebSocket e assets) quando acessado via túnel,
  // ex.: `cloudflared tunnel --url http://localhost:3000` -> https://<nome>.trycloudflare.com
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
