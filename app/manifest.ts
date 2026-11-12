import type { MetadataRoute } from "next";

// Necesario para instalar la app en la pantalla de inicio del iPhone/iPad y recibir avisos ahí.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Croacia",
    short_name: "Croacia",
    description: "Sistema de gestión de trabajos",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    icons: [{ src: "/logo.png", sizes: "32x32", type: "image/png" }],
  };
}
