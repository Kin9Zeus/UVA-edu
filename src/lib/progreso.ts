import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { logError } from "@/lib/log";
import { ANCHO_MINIATURA_TARJETA, getMiniaturaUrl } from "@/lib/mux/miniatura";
import { estadoDeCurso, porcentajeLecciones, porcentajeMostrado } from "@/lib/examenes/estadoPorCurso";
import { registrarSiFalla } from "@/lib/supabase/registrar";
import { calcularRacha, hoyEnBogota, semanasDeActividad, type SemanaActividad } from "@/lib/racha";

export type CursoConProgreso = {
  cursoId: string;
  cursoSlug: string;
  titulo: string;
  imagenPortada: string;
  leccionesCompletadas: number;
  leccionesTotal: number;
  porcentaje: number;
  /** El curso tiene examen final publicado, así que terminar las clases no
   * basta para completarlo (docs/functional-spec.md Flujo 07 — Revf5). */
  examenRequerido: boolean;
  examenAprobado: boolean;
  /** Regla de "curso completo" completa, la misma que decide la emisión del
   * certificado: 100% de clases y, si el curso exige examen, aprobado.
   * Centralizada acá para que la tarjeta, el filtro y el badge no la
   * recombinen cada uno por su cuenta. */
  completado: boolean;
  /** Primera categoría del curso, para la fila (ícono y nombre). */
  categoria: string | null;
  /** Última vez que tocó una clase del curso (ISO). */
  ultimaActividad: string | null;
  /** Fecha de emisión del certificado (ISO): "Terminado el…" se mide con él. */
  certificadoEmitido: string | null;
  /** Clase a retomar (la primera sin completar con video listo); null si no queda ninguna. */
  siguienteLeccionSlug: string | null;
  /** Segundos de clase vistos: lo que duran las clases terminadas más lo
   *  avanzado en las que van a medias. No es tiempo real de estudio. */
  segundosVistos: number;
  /**
   * Dónde quedó: el frame firmado y el segundo exacto. `null` cuando no hay
   * nada que reanudar —curso terminado, o empezado sin llegar a darle play—
   * y entonces se muestra la portada de siempre.
   */
  reanudarEn: {
    url: string;
    /** Segundo exacto donde quedó. */
    segundo: number;
    /** Duración de esa lección, en segundos. `null` si el esquema no la tiene
     *  (`lecciones.duracion` es nullable): sin ella no hay contra qué medir el
     *  avance dentro del video, así que no se dibuja la barra. */
    duracion: number | null;
  } | null;
};

export type ProgresoData = {
  cursos: CursoConProgreso[];
  /** Ritmo de estudio desde `actividad_diaria`; null si no se pudo leer. */
  actividad: { racha: number; semanas: SemanaActividad[] } | null;
};

/**
 * Revf3: el % de avance se calcula en Postgres (vista
 * `progreso_cursos_estudiante`, supabase/sql/033_vista_progreso_cursos.sql)
 * con un `count(...) filter (...)` agregado por curso — no trayendo cada
 * fila de `progreso` y sumando acá. La vista ya excluye lecciones sin video
 * listo y ya viene acotada por RLS a las filas del usuario de la sesión, así
 * que esta función no necesita filtrar por usuario sobre ella.
 */
export async function getProgresoData(): Promise<ProgresoData> {
  const supabase = await createClient();

  const { data: filas, error } = await supabase
    .from("progreso_cursos_estudiante")
    .select(
      "curso_id, curso_slug, titulo, imagen_portada, lecciones_completadas, lecciones_total, examen_requerido, examen_aprobado, ultima_actividad",
    )
    .order("ultima_actividad", { ascending: false });
  // Un fallo no es "no tienes cursos": lanza para que lo atrape error.tsx.
  lanzarSiFalla(error, "progreso:cursos");

  // Ya no se consultan las categorías: la tarjeta de Progreso dejó de
  // mostrarlas (ver el comentario en ProgresoContent), y era una ida entera
  // a `curso_categorias` por cada carga de la pantalla.

  const cursos: CursoConProgreso[] = (filas ?? []).map((fila) => {
    const total = fila.lecciones_total as number;
    const completadas = fila.lecciones_completadas as number;
    const porcentaje = porcentajeLecciones(completadas, total);
    const examenRequerido = fila.examen_requerido === true;
    const examenAprobado = fila.examen_aprobado === true;
    const examen = { requerido: examenRequerido, aprobado: examenAprobado };

    return {
      cursoId: fila.curso_id as string,
      cursoSlug: fila.curso_slug as string,
      titulo: fila.titulo as string,
      imagenPortada: fila.imagen_portada as string,
      leccionesCompletadas: completadas,
      leccionesTotal: total,
      // Mostrado, no el crudo de lecciones: si ya aprobó el examen que exige
      // el curso, la barra tiene que decir 100% aunque falten clases — mismo
      // criterio que `completado` más abajo, aplicado al número en vez de al
      // booleano (ver `porcentajeMostrado`).
      porcentaje: porcentajeMostrado(porcentaje, examen),
      examenRequerido,
      examenAprobado,
      // Antes esto era `porcentaje === 100` en la UI. Con exámenes, un curso
      // al 100% de clases con el examen sin aprobar NO está completo: no tiene
      // certificado, así que tampoco puede decir "Completado".
      //
      // Y si el curso EXIGE examen, aprobarlo basta aunque falten clases
      // (Revf6, misma regla que `private.curso_esta_completo` en
      // supabase/sql/114_certificado_no_exige_lecciones.sql y que
      // `estadoDeCurso` en src/lib/examenes/estadoPorCurso.ts): el examen ya
      // se puede rendir sin haber visto ninguna lección, así que negar el
      // certificado por las clases sería exigir el requisito en un extremo
      // del flujo y no en el otro.
      //
      // La regla vive solo en `estadoDeCurso`: copiarla acá fue lo que dejó
      // al catálogo del dashboard con la versión vieja (P2-4).
      completado: estadoDeCurso(porcentaje, examen) === "COMPLETADO",
      categoria: null as string | null,
      ultimaActividad: (fila.ultima_actividad as string | null) ?? null,
      certificadoEmitido: null as string | null,
      siguienteLeccionSlug: null as string | null,
      segundosVistos: 0,
      reanudarEn: null as CursoConProgreso["reanudarEn"],
    };
  });

  // Solo para los cursos SIN terminar: uno terminado vuelve a su portada,
  // que es como debe quedar archivado.
  const reanudar = await resolverReanudacion(
    supabase,
    cursos.filter((curso) => !curso.completado).map((curso) => curso.cursoId),
  );
  for (const curso of cursos) {
    curso.reanudarEn = reanudar.get(curso.cursoId) ?? null;
  }

  const [, actividad] = await Promise.all([completarDetalle(supabase, cursos), leerActividad(supabase)]);

  return { cursos, actividad };
}

/**
 * Miniatura del segundo exacto donde quedó cada curso a medias.
 *
 * Es la diferencia entre una rejilla de portadas —todas iguales, sin decir
 * nada— y una que muestra dónde se quedó uno: la portada identifica el
 * curso, el frame identifica el momento.
 *
 * Tres consultas planas en vez de un embed anidado
 * (`progreso -> lecciones -> modulos`): supabase-js no sabe estrechar ese
 * tipo y obliga a castear el resultado entero, que es peor que dos viajes
 * más en un camino que ya es asíncrono. Mismo criterio que `enviarRecibo`
 * en lib/pagos/conciliacion.ts.
 *
 * Nada de esto puede romper la pantalla: sin credenciales de Mux, con un
 * video que todavía se procesa o si falla la firma, se devuelve el mapa sin
 * esa entrada y la tarjeta cae a la portada.
 */
async function resolverReanudacion(
  supabase: SupabaseClient,
  cursoIds: string[],
): Promise<Map<string, NonNullable<CursoConProgreso["reanudarEn"]>>> {
  const vacio = new Map<string, NonNullable<CursoConProgreso["reanudarEn"]>>();
  if (cursoIds.length === 0) return vacio;

  const permitidos = new Set(cursoIds);

  // RLS ya acota `progreso` a las filas del usuario de la sesión, así que no
  // hace falta filtrar por usuario.
  //
  // NO se exige `completado = false`. Ese filtro parecía el correcto —"la
  // lección que dejó a medias"— pero se cumple casi nunca: lo normal es
  // terminar una clase y volver otro día, no abandonarla a mitad. Medido
  // sobre una cuenta real: 7 filas de progreso, 3 con segundo guardado, y
  // las 3 completadas — o sea cero miniaturas. Lo que importa es el último
  // frame que la persona vio en ese curso, esté la clase terminada o no.
  const { data: avances, error: errorAvances } = await supabase
    .from("progreso")
    .select("id_leccion, segundo_actual")
    .gt("segundo_actual", 0)
    .order("actualizado_en", { ascending: false });

  // Aquí sí se degrada: la miniatura es un adorno y la tarjeta cae a la
  // portada. Pero se registra, para que un fallo no pase en silencio.
  if (errorAvances) {
    logError("progreso:reanudacion", "no se pudo leer el avance por lección", errorAvances, { area: "progreso" });
    return vacio;
  }
  if (!avances?.length) return vacio;

  const { data: lecciones, error: errorLecciones } = await supabase
    .from("lecciones")
    .select("id, id_modulo, id_video_mux, estado_procesamiento, duracion")
    .in(
      "id",
      avances.map((avance) => avance.id_leccion as string),
    );

  if (errorLecciones) {
    logError("progreso:reanudacion", "no se pudieron leer las lecciones", errorLecciones, { area: "progreso" });
    return vacio;
  }
  if (!lecciones?.length) return vacio;

  const { data: modulos, error: errorModulos } = await supabase
    .from("modulos")
    .select("id, id_curso")
    .in(
      "id",
      lecciones.map((leccion) => leccion.id_modulo as string),
    );
  if (errorModulos) {
    logError("progreso:reanudacion", "no se pudieron leer los módulos", errorModulos, { area: "progreso" });
    return vacio;
  }

  const cursoDeModulo = new Map(
    (modulos ?? []).map((modulo) => [modulo.id as string, modulo.id_curso as string]),
  );
  const leccionPorId = new Map(lecciones.map((leccion) => [leccion.id as string, leccion]));

  // `avances` viene ordenado por actividad reciente, así que el primero que
  // aparece de cada curso es el último que estuvo viendo.
  const elegido = new Map<
    string,
    { playbackId: string; segundo: number; duracion: number | null }
  >();
  for (const avance of avances) {
    const leccion = leccionPorId.get(avance.id_leccion as string);
    if (!leccion?.id_video_mux || leccion.estado_procesamiento !== "LISTO") continue;

    const cursoId = cursoDeModulo.get(leccion.id_modulo as string);
    if (!cursoId || !permitidos.has(cursoId) || elegido.has(cursoId)) continue;

    elegido.set(cursoId, {
      playbackId: leccion.id_video_mux as string,
      segundo: avance.segundo_actual as number,
      duracion: (leccion.duracion as number | null) ?? null,
    });
  }

  const firmadas = await Promise.all(
    [...elegido].map(async ([cursoId, { playbackId, segundo, duracion }]) => {
      const url = await getMiniaturaUrl(playbackId, ANCHO_MINIATURA_TARJETA, segundo);
      return [cursoId, url, segundo, duracion] as const;
    }),
  );

  for (const [cursoId, url, segundo, duracion] of firmadas) {
    if (url) vacio.set(cursoId, { url, segundo, duracion });
  }
  return vacio;
}

/**
 * Lo que completa cada fila: categoría, certificado, clase a retomar y
 * segundos vistos. Todo secundario: si una lectura falla se registra y la
 * fila queda con menos detalle (sin categoría, "Continuar" lleva a la ficha
 * del curso), nunca con un dato falso.
 */
async function completarDetalle(supabase: SupabaseClient, cursos: CursoConProgreso[]) {
  if (cursos.length === 0) return;
  const ids = cursos.map((curso) => curso.cursoId);
  const porId = new Map(cursos.map((curso) => [curso.cursoId, curso]));

  const [
    { data: categorias, error: errorCategorias },
    { data: certificados, error: errorCertificados },
    { data: modulos, error: errorModulos },
  ] = await Promise.all([
    supabase.from("curso_categorias").select("id_curso, categoria:categorias(nombre)").in("id_curso", ids),
    supabase.from("certificados").select("id_curso, fecha_emision").in("id_curso", ids),
    supabase
      .from("modulos")
      .select("id_curso, orden, lecciones(slug, orden, duracion, estado_procesamiento, progreso(completado, segundo_actual))")
      .in("id_curso", ids),
  ]);

  if (!registrarSiFalla(errorCategorias, "progreso:categorias", "no se pudieron leer las categorías de los cursos")) {
    for (const fila of categorias ?? []) {
      const curso = porId.get(fila.id_curso as string);
      const categoria = Array.isArray(fila.categoria) ? fila.categoria[0] : fila.categoria;
      if (curso && !curso.categoria && categoria) curso.categoria = categoria.nombre as string;
    }
  }

  if (!registrarSiFalla(errorCertificados, "progreso:certificados", "no se pudieron leer los certificados")) {
    for (const fila of certificados ?? []) {
      const curso = porId.get(fila.id_curso as string);
      if (curso) curso.certificadoEmitido = fila.fecha_emision as string;
    }
  }

  if (registrarSiFalla(errorModulos, "progreso:temario", "no se pudo leer el temario de los cursos")) return;
  const porCurso = new Map<string, NonNullable<typeof modulos>>();
  for (const modulo of modulos ?? []) {
    const lista = porCurso.get(modulo.id_curso as string) ?? [];
    lista.push(modulo);
    porCurso.set(modulo.id_curso as string, lista);
  }
  for (const [cursoId, lista] of porCurso) {
    const curso = porId.get(cursoId);
    if (!curso) continue;
    // Mismo temario que cuenta el progreso: solo clases con video listo.
    const lecciones = lista
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .flatMap((modulo) =>
        (modulo.lecciones ?? [])
          .filter((leccion) => leccion.estado_procesamiento === "LISTO")
          .slice()
          .sort((a, b) => a.orden - b.orden),
      );
    let segundos = 0;
    for (const leccion of lecciones) {
      const avance = leccion.progreso?.[0];
      const duracion = (leccion.duracion as number | null) ?? 0;
      if (avance?.completado) segundos += duracion;
      else if (avance) segundos += duracion > 0 ? Math.min(avance.segundo_actual as number, duracion) : 0;
    }
    curso.segundosVistos = segundos;
    curso.siguienteLeccionSlug =
      (lecciones.find((leccion) => !leccion.progreso?.[0]?.completado)?.slug as string | undefined) ?? null;
  }
}

/** Racha y semanas del último mes, desde `actividad_diaria` (supabase/sql/119). */
async function leerActividad(supabase: SupabaseClient): Promise<ProgresoData["actividad"]> {
  const { data, error } = await supabase
    .from("actividad_diaria")
    .select("fecha")
    .order("fecha", { ascending: false })
    .limit(400);
  if (registrarSiFalla(error, "progreso:actividad", "no se pudieron leer los días de estudio")) return null;
  const fechas = (data ?? []).map((fila) => fila.fecha as string);
  const hoy = hoyEnBogota();
  return { racha: calcularRacha(fechas, hoy), semanas: semanasDeActividad(fechas, hoy) };
}
