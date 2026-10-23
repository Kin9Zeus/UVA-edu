/**
 * Temario de un curso en el orden en que se cursa: módulos por `orden` y,
 * dentro de cada uno, sus clases por `orden`. Solo cuentan las clases con
 * video listo (`LISTO`), la misma regla que el avance y el certificado.
 *
 * Inicio ("Sigue aprendiendo") y Mis cursos ("Continuar donde quedaste")
 * eligen la clase a retomar sobre esta lista: si cada pantalla la ordenara
 * por su cuenta, podrían mandar al estudiante a clases distintas.
 */
type LeccionDeTemario = { orden: number; estado_procesamiento: string | null };

export function temarioListo<M extends { orden: number; lecciones?: LeccionDeTemario[] | null }>(
  modulos: M[],
): { leccion: NonNullable<M["lecciones"]>[number]; modulo: M }[] {
  return modulos
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .flatMap((modulo) =>
      (modulo.lecciones ?? [])
        .filter((leccion) => leccion.estado_procesamiento === "LISTO")
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .map((leccion) => ({ leccion, modulo })),
    );
}
