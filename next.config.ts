import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Oculta el indicador flotante de dev: se superponía con el bottom nav
  // móvil y bloqueaba clicks en la esquina inferior izquierda.
  devIndicators: false,
};

export default nextConfig;
