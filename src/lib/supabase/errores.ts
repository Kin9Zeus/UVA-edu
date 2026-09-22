/**
 * Convierte un error de PostgREST en una excepción de verdad.
 *
 * Vivía en lib/examen.ts; se movió aquí cuando el catálogo, la ficha del
 * curso, el reproductor y el muro de acceso empezaron a necesitar lo mismo
 * (AUDIT-2026-09-22.md, seguimiento de P2-3): una copia por módulo era cómo
 * terminaban divergiendo.
 *
 * Por qué existe (AUDIT-2026-09-08, seguimiento del P0-1)
 * -------------------------------------------------------
 * `const { data } = await ...` sin mirar `error` es lo que convirtió un fallo
 * de permisos en un bucle: cuando el GRANT por columna del 081 dejó fuera a
 * `authenticated`, la consulta empezó a fallar con `42501`, `data` venía
 * `null`, y `null` aquí significa "el intento ya no está en curso" — un
 * estado de negocio legítimo. La página redirigía a su propia URL, volvía a
 * fallar y redirigía otra vez, hasta que el navegador cortaba con
 * ERR_TOO_MANY_REDIRECTS. Nada lanzó nunca, así que ni `src/app/error.tsx`
 * ni Sentry se enteraron de un fallo que duró todo un despliegue.
 *
 * Lanzar es lo correcto y el código 500 también: un `42501` es un privilegio
 * que le falta al ROL `authenticated`, y ese rol es idéntico para todos los
 * usuarios — nunca puede significar "tú en particular no puedes". Solo puede
 * significar que el código y el esquema no coinciden, que es un fallo del
 * servidor. Un 403 mentiría al usuario y mandaría a quien lo depure a mirar
 * permisos en vez de el despliegue. La negativa de RLS, que sí es por
 * usuario, no llega por aquí: filtra filas y devuelve 0, sin error.
 *
 * Se envuelve en un `Error` en vez de relanzar el objeto: un PostgrestError
 * es un objeto plano, y lanzarlo tal cual deja a Next sin `digest` y a Sentry
 * sin agrupar. El mensaje de Postgres viaja dentro pero no al navegador: en
 * producción Next solo manda el `digest` al cliente.
 */
export function lanzarSiFalla(
  error: { message?: string; code?: string } | null,
  consulta: string,
): void {
  if (!error) return;
  throw new Error(
    `${consulta} falló: ${error.message ?? "error desconocido"} (code=${error.code ?? "sin código"})`,
  );
}
