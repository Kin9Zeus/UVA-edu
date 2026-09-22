import { createClient } from "@/lib/supabase/server";
import { obtenerAccesoAlCurso } from "@/lib/accesoCurso";
import { getMiniaturaUrl } from "@/lib/mux/miniatura";
import { getInstructoresDeCurso, type InstructorPublico } from "@/lib/instructores";
import { esUuid } from "@/lib/slug";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { logError } from "@/lib/log";

export type LeccionPublica = {
  id: string;
  slug: string;
  titulo: string;
  orden: number;
  duracion: number | null;
  completado: boolean;
  /**
   * Un frame del video para el cuadro del Temario (la misma imagen que ya usa
   * el reproductor en su propio Temario, `LeccionPlayerItem.miniaturaUrl`).
   * `null` si la clase no tiene video LISTO o no se pudo firmar la URL: el
   * cuadro queda oscuro, sin imagen.
   */
  miniaturaUrl: string | null;
};

export type ModuloPublico = {
  id: string;
  titulo: string;
  orden: number;
  lecciones: LeccionPublica[];
};

export type CategoriaDelCurso = {
  id: string;
  slug: string;
  nombre: string;
};

export type CursoPublico = {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  nivel: "BASICO" | "INTERMEDIO" | "AVANZADO";
  /** Todas las categorías del curso — `curso_categorias` es muchos-a-muchos. */
  categorias: CategoriaDelCurso[];
  /**
   * Uno o más: un curso puede dictarlo más de un profesor
   * (`curso_instructores` es muchos-a-muchos). Puede venir vacío si el curso
   * todavía no tiene profesor asignado.
   */
  instructores: InstructorPublico[];
  imagenPortada: string;
  fechaEdicion: string;
  modulos: ModuloPublico[];
  totalClases: number;
  totalRecursos: number;
  duracionTotalSegundos: number;
  tieneAcceso: boolean;
  /**
   * true cuando el estudiante SÍ tuvo acceso y se le terminó: cambia el CTA
   * de "Canjea tu código" a "Renueva tu acceso". Distinto de no haber
   * canjeado nunca — a quien ya estuvo dentro no se le habla como a un
   * recién llegado.
   */
  accesoVencido: boolean;
  /** true si hay al menos una clase con progreso guardado (completada o no). */
  progresoIniciado: boolean;
  /**
   * Primera clase del temario todavía sin completar, para "Seguir viendo".
   * `null` si no hay progreso o si ya se completaron todas las clases.
   */
  leccionContinuarId: string | null;
  leccionContinuarSlug: string | null;
  leccionContinuarTitulo: string | null;
  /** Posición 1..N de `leccionContinuarId` dentro del curso completo. */
  leccionContinuarNumero: number | null;
};

/**
 * Resuelve un curso por slug o UUID (enlaces anteriores al cambio de rutas
 * siguen resolviendo por UUID) — mismo patrón que `resolverCategoria`
 * (lib/categoria.ts).
 */
export async function getCursoPublico(
  identificadorCurso: string,
  usuarioId: string | null,
): Promise<CursoPublico | null> {
  const supabase = await createClient();
  const columnaCurso = esUuid(identificadorCurso) ? "id" : "slug";

  // Curso + categorías + módulos + lecciones en una sola consulta (embedding
  // de PostgREST, resuelto con joins del lado de Postgres): nunca una
  // consulta por módulo (problema N+1 explícitamente a evitar), y tampoco
  // una consulta aparte por curso/categorías como antes. RLS decide qué
  // filas embebidas devolver en cada tabla igual que si se pidieran sueltas.
  //
  // Sin `.eq("mostrado", true)` a propósito: la policy "cursos_select_publicos"
  // (030_acceso_curso_despublicado.sql) ya deja pasar un curso despublicado
  // si el usuario tiene cortesía, o membresía con progreso ya guardado en
  // él — filtrar acá por `mostrado` otra vez le negaría a esa gente el
  // curso que RLS sí les permite ver. Si el curso está oculto y este
  // usuario no califica para ninguna excepción, RLS ya no devuelve la fila
  // y `curso` sale null, igual que antes.
  //
  // `maybeSingle` y no `single` (AUDIT-2026-09-22.md, seguimiento de P2-3):
  // `single` reporta "no hay fila" como ERROR (PGRST116), así que "no existe"
  // y "la base falló" llegaban juntos como `curso: null`, y la página
  // respondía 404 a los dos. Durante una caída de Supabase cada ficha de
  // curso —las páginas públicas que más importan para buscadores— decía "no
  // existe". Con `maybeSingle`, no encontrar la fila es `data: null` sin
  // error (el slug es @unique: nunca hay más de una), y cualquier `error` es
  // un fallo real que lanza: la página responde 500 ("reintenta"), que un
  // rastreador trata como temporal.
  const { data: curso, error } = await supabase
    .from("cursos")
    .select(
      `id, slug, titulo, descripcion, nivel, imagen_portada, fecha_edicion:actualizado_en, mostrado,
      curso_categorias(categoria:categorias(id, slug, nombre)),
      modulos(id, titulo, orden, lecciones(id, slug, titulo, orden, duracion, estado_procesamiento, id_video_mux))`,
    )
    .eq(columnaCurso, identificadorCurso)
    .maybeSingle();

  lanzarSiFalla(error, "getCursoPublico");
  if (!curso) return null;

  const cursoId = curso.id;

  // Todas las categorías del curso, no solo la primera: `curso_categorias`
  // es muchos-a-muchos y el CMS ya permite asignar varias (mismo criterio
  // que getCatalogo() en lib/categoria.ts). Antes se cortaba con .limit(1) y
  // el detalle del curso solo mostraba una, aunque el admin le hubiera
  // asignado dos o tres.
  const categorias: CategoriaDelCurso[] = (curso.curso_categorias ?? [])
    .map((fila) => {
      const categoria = Array.isArray(fila.categoria) ? fila.categoria[0] : fila.categoria;
      return categoria ? { id: categoria.id, slug: categoria.slug, nombre: categoria.nombre } : null;
    })
    .filter((categoria): categoria is CategoriaDelCurso => categoria !== null);

  // El embedding no garantiza el orden de las filas anidadas (ni PostgREST
  // ni Postgres lo prometen sin un ORDER BY explícito por tabla embebida),
  // así que el orden por `orden` se aplica acá, igual que ya se hacía con
  // las lecciones antes de este cambio.
  const modulosBase = (curso.modulos ?? [])
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((modulo) => ({
      id: modulo.id,
      titulo: modulo.titulo,
      orden: modulo.orden,
      lecciones: (modulo.lecciones ?? [])
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .map((leccion) => ({
          id: leccion.id,
          slug: leccion.slug,
          titulo: leccion.titulo,
          orden: leccion.orden,
          // Sin video LISTO, cualquier valor guardado en `duracion` no
          // corresponde a un video real (ej. datos de siembra con
          // estado_procesamiento SUBIENDO/PROCESANDO/ERROR que nunca subió
          // nada a Mux) — mostrarlo confunde al estudiante y al admin, que
          // ven minutos que no salen de ningún video. Ver también
          // lib/leccion.ts y lib/admin/cursoDetalle.ts, misma regla.
          duracion: leccion.estado_procesamiento === "LISTO" ? leccion.duracion : null,
          // Solo para firmar la miniatura más abajo: no sale en `LeccionPublica`.
          idVideoMuxListo:
            leccion.estado_procesamiento === "LISTO" ? (leccion.id_video_mux as string | null) : null,
        })),
    }));

  const leccionIds = modulosBase.flatMap((modulo) => modulo.lecciones.map((leccion) => leccion.id));
  const totalClases = leccionIds.length;
  const duracionTotalSegundos = modulosBase.reduce(
    (total, modulo) =>
      total + modulo.lecciones.reduce((sub, leccion) => sub + (leccion.duracion ?? 0), 0),
    0,
  );

  // Recursos, acceso e instructores son independientes entre sí — se piden en
  // paralelo en vez de uno tras otro. `obtenerAccesoAlCurso`
  // (src/lib/accesoCurso.ts) es la única función que decide "cortesía O
  // suscripción vigente" — misma regla que usan el reproductor y el
  // reproductor de lección, no una copia paralela.
  //
  // Los instructores van en consulta aparte y no embebidos en el `.select()`
  // de arriba: sus datos viven en `perfiles`, que RLS no le abre a un
  // visitante sin sesión. Se leen por la vista `curso_instructores_publico`,
  // que recorta la proyección a nombre y especialidad — ver lib/instructores.ts.
  //
  // Ante un fallo (AUDIT-2026-09-22.md, seguimiento de P2-3), lo que define
  // qué puede hacer el estudiante LANZA —el acceso (obtenerAccesoAlCurso) y el
  // progreso, más abajo— y la página responde 500 con "Reintentar": mostrar el
  // candado a quien paga, o el temario sin ✓, es peor que no mostrar nada.
  // Lo accesorio se degrada, queda registrado y OCULTA el dato en vez de
  // inventarlo: sin recursos no se pinta el contador (CursoDetalleContent solo
  // lo muestra si es > 0), y los instructores ya se registran y degradan en
  // lib/instructores.ts. Lanzar también por esto convertiría un permiso roto
  // en una sola vista —una migración, no una caída— en un 500 de todas las
  // fichas públicas hasta que alguien lo arregle.
  const [{ count: totalRecursos, error: errorRecursos }, acceso, instructores] = await Promise.all([
    leccionIds.length > 0
      ? supabase
          .from("recursos_descargables")
          .select("id", { count: "exact", head: true })
          .in("id_leccion", leccionIds)
      : Promise.resolve({ count: 0, error: null }),
    obtenerAccesoAlCurso(supabase, usuarioId, cursoId),
    getInstructoresDeCurso(supabase, cursoId),
  ]);
  if (errorRecursos) {
    logError("curso:ficha", "no se pudo contar los recursos del curso", errorRecursos, { area: "catalogo", cursoId });
  }

  const tieneAcceso = acceso.tieneAcceso;
  // Tuvo una suscripción y ya no le sirve: el temario se sigue viendo, pero
  // con candado, y el CTA invita a renovar en vez de a canjear por primera vez.
  const accesoVencido = !tieneAcceso && acceso.suscripcion !== null;

  // Progreso guardado en las clases del curso: qué está completada (para el
  // check ✓ del temario) y cuál es la primera sin completar (para "Seguir
  // viendo" — Revcurso). Se usa el orden del temario, no "la última clase
  // que se abrió": esa pudo haberse completado ya, y retomar ahí mandaría
  // de vuelta a una clase terminada en vez de a la siguiente pendiente.
  let progresoIniciado = false;
  const completadoIds = new Set<string>();
  // Sin `tieneAcceso` en la condición: el progreso es del estudiante y
  // sobrevive al vencimiento — los ✓ del temario y "Seguir viendo" tienen
  // que seguir ahí cuando renueve, en la clase donde se quedó.
  if (usuarioId && leccionIds.length > 0) {
    const { data: progresoRows, error: errorProgreso } = await supabase
      .from("progreso")
      .select("id_leccion, completado")
      .eq("id_usuario", usuarioId)
      .in("id_leccion", leccionIds);
    lanzarSiFalla(errorProgreso, "getCursoPublico:progreso");

    progresoIniciado = (progresoRows ?? []).length > 0;
    for (const fila of progresoRows ?? []) {
      if (fila.completado) completadoIds.add(fila.id_leccion as string);
    }
  }

  // Un signPlaybackId() por clase, en paralelo: es una firma JWT local, no una
  // llamada de red a Mux (mismo razonamiento que en lib/leccion.ts). Se firma
  // para TODAS las clases, con o sin acceso: el Temario muestra el cuadro de
  // las bloqueadas atenuado y con candado, igual que el del reproductor.
  const modulosPublicos: ModuloPublico[] = await Promise.all(
    modulosBase.map(async (modulo) => ({
      id: modulo.id,
      titulo: modulo.titulo,
      orden: modulo.orden,
      lecciones: await Promise.all(
        modulo.lecciones.map(async ({ idVideoMuxListo, ...leccion }) => ({
          ...leccion,
          completado: completadoIds.has(leccion.id),
          miniaturaUrl: idVideoMuxListo ? await getMiniaturaUrl(idVideoMuxListo) : null,
        })),
      ),
    })),
  );

  const leccionesPlanas = modulosPublicos.flatMap((modulo) => modulo.lecciones);
  const siguiente = progresoIniciado
    ? leccionesPlanas.find((leccion) => !leccion.completado)
    : undefined;
  const leccionContinuarId = siguiente?.id ?? null;
  const leccionContinuarSlug = siguiente?.slug ?? null;
  const leccionContinuarTitulo = siguiente?.titulo ?? null;
  const leccionContinuarNumero = siguiente
    ? leccionesPlanas.findIndex((leccion) => leccion.id === siguiente.id) + 1
    : null;

  return {
    id: curso.id,
    slug: curso.slug,
    titulo: curso.titulo,
    descripcion: curso.descripcion,
    nivel: curso.nivel,
    categorias,
    instructores,
    imagenPortada: curso.imagen_portada,
    fechaEdicion: curso.fecha_edicion,
    modulos: modulosPublicos,
    totalClases,
    totalRecursos: totalRecursos ?? 0,
    duracionTotalSegundos,
    tieneAcceso,
    accesoVencido,
    progresoIniciado,
    leccionContinuarId,
    leccionContinuarSlug,
    leccionContinuarTitulo,
    leccionContinuarNumero,
  };
}
