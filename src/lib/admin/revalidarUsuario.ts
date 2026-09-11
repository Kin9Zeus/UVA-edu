import { revalidatePath } from "next/cache";

/**
 * Invalida las fichas de usuario del panel sin conocer su slug.
 *
 * Mismo motivo que `revalidarCursoAdmin` (src/lib/admin/revalidarCurso.ts): la
 * ficha vive en /admin/usuarios/<slug>, pero las Server Actions solo reciben
 * el `usuarioId`, y `revalidatePath(`/admin/usuarios/${usuarioId}`)` invalida
 * una URL que ya nadie visita. Se invalida el patrón de la ruta, con su grupo.
 */
export function revalidarUsuarioAdmin(): void {
  revalidatePath("/(admin)/admin/usuarios/[usuarioSlug]", "page");
}
