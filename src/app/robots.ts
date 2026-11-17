import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/**
 * Rutas que exigen sesión o no tienen nada para un buscador. Las pantallas
 * públicas que no deben salir en Google (login, recuperar, verificar
 * certificado, acceso denegado…) NO van aquí: llevan `noindex` en su
 * metadata, y si estuvieran bloqueadas Google no podría leerlo (SEO fase 14,
 * tarea de robots.txt, paso 1).
 */
export const RUTAS_PRIVADAS = [
  "/dashboard",
  "/admin",
  "/seguridad",
  "/api",
  "/vista-previa",
  "/auth",
];

/**
 * Rastreadores de IA, nombres verificados el 17-nov-2026 en la documentación
 * de cada empresa. Provisional mientras Aleck decide la política: hoy se
 * permiten todos. Cada grupo repite RUTAS_PRIVADAS porque un rastreador con
 * grupo propio ignora el grupo `*`.
 */
// Búsqueda y respuestas: traen visitas (citan y enlazan la fuente).
export const RASTREADORES_IA_BUSQUEDA = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
];
// Entrenamiento de modelos: no afectan Google ni Bing. Para bloquearlos,
// cambiar `allow` por `disallow: "/"` en su grupo.
export const RASTREADORES_IA_ENTRENAMIENTO = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: RUTAS_PRIVADAS },
      { userAgent: RASTREADORES_IA_BUSQUEDA, allow: "/", disallow: RUTAS_PRIVADAS },
      { userAgent: RASTREADORES_IA_ENTRENAMIENTO, allow: "/", disallow: RUTAS_PRIVADAS },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
