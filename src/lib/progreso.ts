import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getMiniaturaUrl } from "@/lib/mux/miniatura";
import { porcentajeMostrado } from "@/lib/examenes/estadoPorCurso";

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

  const { data: filas } = await supabase
    .from("progreso_cursos_estudiante")
    .select(
      "curso_id, curso_slug, titulo, imagen_portada, lecciones_completadas, lecciones_total, examen_requerido, examen_aprobado",
    )
    .order("ultima_actividad", { ascending: false });

  // Ya no se consultan las categorías: la tarjeta de Progreso dejó de
  // mostrarlas (ver el comentario en ProgresoContent), y era una ida entera
  // a `curso_categorias` por cada carga de la pantalla.

  const cursos: CursoConProgreso[] = (filas ?? []).map((fila) => {
    const total = fila.lecciones_total as number;
    const completadas = fila.lecciones_completadas as number;
    const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;
    const examenRequerido = fila.examen_requerido === true;
    const examenAprobado = fila.examen_aprobado === true;

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
      porcentaje: porcentajeMostrado(porcentaje, { requerido: examenRequerido, aprobado: examenAprobado }),
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
      completado: examenRequerido ? examenAprobado : porcentaje === 100,
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

  return { cursos };
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
  const { data: avances } = await supabase
    .from("progreso")
    .select("id_leccion, segundo_actual")
    .gt("segundo_actual", 0)
    .order("actualizado_en", { ascending: false });

  if (!avances?.length) return vacio;

  const { data: lecciones } = await supabase
    .from("lecciones")
    .select("id, id_modulo, id_video_mux, estado_procesamiento, duracion")
    .in(
      "id",
      avances.map((avance) => avance.id_leccion as string),
    );

  if (!lecciones?.length) return vacio;

  const { data: modulos } = await supabase
    .from("modulos")
    .select("id, id_curso")
    .in(
      "id",
      lecciones.map((leccion) => leccion.id_modulo as string),
    );

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
      const url = await getMiniaturaUrl(playbackId, segundo);
      return [cursoId, url, segundo, duracion] as const;
    }),
  );

  for (const [cursoId, url, segundo, duracion] of firmadas) {
    if (url) vacio.set(cursoId, { url, segundo, duracion });
  }
  return vacio;
}
