import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { getNivelAalActual, pantallaDeSegundoFactor, rutaSegundoFactor } from "@/lib/auth/aal";

/**
 * La puerta de LECTURA del panel: sesión, cuenta activa, rol ADMINISTRADOR
 * y segundo factor (aal2). Escribir tiene la suya, `requireAdmin()` en cada
 * Server Action, y detrás RLS con `private.es_administrador()`.
 *
 * La llaman el layout de /admin Y cada página (fase 6 del plan de blindaje).
 * El layout solo no alcanza: Next no lo vuelve a ejecutar al navegar entre
 * páginas que lo comparten, y un layout no impide que la página corra ni
 * que su contenido viaje en la respuesta
 * (node_modules/next/dist/docs/01-app/02-guides/authentication.md, "Layouts
 * and auth checks"). Si una página lee algo con la llave maestra, la única
 * puerta es esta llamada. `src/lib/admin/muro-admin.test.ts` falla si una
 * página la olvida.
 *
 * No cuesta consultas de más: `getPerfilActual` y `getNivelAalActual` van en
 * `cache()` de React, así que layout y página comparten el resultado.
 *
 * El orden importa: el rol va ANTES del segundo factor (a un estudiante se
 * le dice "acceso denegado", no que active el 2FA).
 */
export async function exigirAdministradorEnPagina(rutaDeVuelta = "/admin") {
  const { user, perfil } = await getPerfilActual();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(rutaDeVuelta)}`);
  }

  // Defensa en profundidad: el middleware ya cierra la sesión de una cuenta
  // suspendida en cada petición a una ruta protegida.
  if (perfil?.estado === "SUSPENDIDO") {
    redirect("/login");
  }

  if (perfil?.rol !== "ADMINISTRADOR") {
    redirect("/acceso-denegado");
  }

  // Se redirige y no se muestra un 403: un aal1 aquí suele ser inocente (el
  // administrador acaba de entrar o dejó una pestaña abierta); solo le falta
  // escribir su código.
  if ((await getNivelAalActual()) !== "aal2") {
    redirect(rutaSegundoFactor(await pantallaDeSegundoFactor(), rutaDeVuelta));
  }

  return { user, perfil };
}
