/**
 * Valor por defecto de `cursos.imagen_portada` mientras no se sube una
 * portada real (crearCurso, actions/admin/cursos.ts). Vive en un módulo sin
 * "use server" porque tanto el server action como componentes cliente
 * (admin y público) necesitan la misma constante para distinguir un curso
 * con portada real de uno que todavía muestra el placeholder.
 */
export const IMAGEN_PORTADA_PLACEHOLDER = "placeholder://curso-sin-portada";

export function esPortadaReal(url: string | null | undefined): url is string {
  return !!url && url !== IMAGEN_PORTADA_PLACEHOLDER;
}
