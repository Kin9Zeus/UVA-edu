import { revalidatePath } from "next/cache";
import { logError } from "@/lib/log";
import { unaVezPorMinuto } from "@/lib/una-vez-por-minuto";

/**
 * Las rutas que comentarios y comunidad pueden pedir refrescar. La ruta llega
 * del navegador (es la página donde está el comentario o la publicación), así
 * que sin esta lista cualquiera con sesión podía vaciar el caché de la
 * portada o del catálogo llamando la acción a mano (P3-2, AUDIT-2026-11-23).
 * Los slugs son los de `src/lib/slug.ts`: minúsculas, números y guiones.
 */
const RUTAS_PERMITIDAS = [
  /^\/cursos\/[a-z0-9-]+\/[a-z0-9-]+$/,
  /^\/dashboard\/comunidad(?:\/[a-z0-9-]+)?$/,
  /^\/dashboard\/comunidad\?(?:mias=1|categoria=(?:ANUNCIOS|PROYECTOS|PREGUNTAS|EMPLEO))$/,
];

export function esRutaRefrescable(ruta: string): boolean {
  return RUTAS_PERMITIDAS.some((patron) => patron.test(ruta));
}

/**
 * `revalidatePath` para una ruta que mandó el cliente. Si no es una de las
 * permitidas, no refresca nada (la acción ya se guardó: solo se pierde el
 * refresco) y deja un aviso por minuto.
 */
export function revalidarRutaDelCliente(ruta: string): void {
  if (esRutaRefrescable(ruta)) {
    revalidatePath(ruta);
    return;
  }
  if (unaVezPorMinuto("revalidarRutaDelCliente")) {
    logError("revalidarRutaDelCliente", "Ruta fuera de la lista blanca", undefined, {
      ruta: ruta.slice(0, 200),
      nivel: "warning",
    });
  }
}
