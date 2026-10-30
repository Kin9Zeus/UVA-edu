import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { destinoInternoSeguro } from "@/lib/redirect-seguro";
import {
  getNivelAalActual,
  pantallaDeSegundoFactor,
  rutaSegundoFactor,
  type PantallaSegundoFactor,
} from "@/lib/auth/aal";

/** A dónde se va tras el código si la pantalla no recibe `redirect`. */
export const DESTINO_TRAS_SEGUNDO_FACTOR = "/admin";

/**
 * Puerta de las dos pantallas del segundo factor (`/seguridad/activar` y
 * `/seguridad/verificar`) — FASE 8.1 del plan de blindaje.
 *
 * Decide si la persona debe estar en ESTA pantalla y, si no, la manda a la
 * correcta. Así ninguna de las dos se queda esperando a alguien que no le
 * corresponde, y el layout de `/admin` puede redirigir sin saber más:
 *
 *   sin sesión                  → login, y de vuelta aquí
 *   no es administrador         → su panel (por ahora el segundo factor es solo
 *                                 de administradores; a los estudiantes se les
 *                                 ofrecerá más adelante)
 *   sesión ya en aal2           → directo a su destino
 *   le corresponde la otra      → la otra (tiene factor confirmado: verificar;
 *                                 no tiene: activar)
 *
 * Devuelve lo que la pantalla necesita para pintarse.
 */
export async function resolverPantallaSegundoFactor(
  actual: PantallaSegundoFactor,
  redirectCrudo: unknown,
): Promise<{ destino: string }> {
  // Saneado igual que en el login: este valor viaja a un campo oculto y luego
  // a un `redirect()`, así que no puede dejar salir de la plataforma.
  const destino = destinoInternoSeguro(redirectCrudo, DESTINO_TRAS_SEGUNDO_FACTOR);

  const { user, perfil } = await getPerfilActual();
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(rutaSegundoFactor(actual, destino))}`);
  }

  if (perfil?.rol !== "ADMINISTRADOR") redirect("/dashboard");

  if ((await getNivelAalActual()) === "aal2") redirect(destino);

  const corresponde = await pantallaDeSegundoFactor();
  if (corresponde !== actual) redirect(rutaSegundoFactor(corresponde, destino));

  return { destino };
}
