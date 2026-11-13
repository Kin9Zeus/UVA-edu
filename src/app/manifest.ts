import type { MetadataRoute } from "next";
import { COLOR_BARRA_NAVEGADOR } from "@/lib/tema";
import { DESCRIPCION_SITIO } from "@/lib/seo/metadata";
import { NOMBRE_ORGANIZACION } from "@/lib/seo/organizacion";

/**
 * Manifest para instalar el sitio en el celular (SEO fase 14, tarea de
 * metadatos e íconos). Los íconos son los de `src/app/` (`icon.png` de
 * 512×512 y `apple-icon.png` de 180×180), provisionales: la «U» del trazo
 * del logo hasta que Aleck entregue el ícono oficial.
 *
 * El nombre sale de la misma constante que el JSON-LD de la organización:
 * cuando se decida el nombre oficial, cambia en un solo lugar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: NOMBRE_ORGANIZACION,
    short_name: "UVA",
    description: DESCRIPCION_SITIO,
    lang: "es",
    start_url: "/",
    display: "standalone",
    // El tema por defecto es el oscuro: la pantalla de arranque no destella en blanco.
    background_color: COLOR_BARRA_NAVEGADOR.oscuro,
    theme_color: COLOR_BARRA_NAVEGADOR.oscuro,
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
