import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/**
 * P2-5 (AUDIT-2026-09-04.md): no existía -- Google podía intentar indexar
 * /dashboard, /admin o /api sin que nada se lo impidiera. `Disallow`
 * enumera todo lo que exige sesión o no tiene sentido en un resultado de
 * búsqueda; el resto (catálogo, fichas de curso, páginas de auth) queda
 * indexable.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/admin",
        "/api",
        "/vista-previa",
        "/verificar-certificado",
        "/acceso-denegado",
        "/auth",
        "/recuperar",
        "/actualizar-password",
        "/verificar-correo",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
