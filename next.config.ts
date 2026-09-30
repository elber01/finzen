import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // La validación de tipos YA corre en el build (tsc pasa limpio en 0 errores).
  // Antes había `ignoreBuildErrors: true` (deuda del template que enmascaraba
  // 28 errores de tipos) — removida el 29-sep-2026. No reintroducirla.
  reactStrictMode: false,
  // Oculta el indicador flotante de dev: se superponía con el bottom nav
  // móvil y bloqueaba clicks en la esquina inferior izquierda.
  devIndicators: false,
};

export default nextConfig;
