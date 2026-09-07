import { createClient } from "@/lib/supabase/server";
import { resolverContenidoLeccion, type DocumentoContenido } from "@/lib/editor/tipos";
import { calcularDisponibilidad } from "@/lib/examen";
import {
  esTipoImplementado,
  type OpcionPregunta,
  type PreguntaCompleta,
} from "@/lib/examenes/tipos";

/**
 * Lectura del examen de un curso para el panel de administración.
 *
 * Es la ÚNICA lectura de `preguntas_examen` de todo el proyecto, y trae las
 * respuestas correctas — la política RLS `preguntas_examen_admin_select`
 * (supabase/sql/067) solo se la abre a administradores, y esta función solo la
 * invoca la pantalla de detalle de curso del panel. El estudiante nunca pasa
 * por acá; su examen sale de `intentos_examen.preguntas_congeladas`, ya
 * despojado.
 */

export type IntentoResumen = {
  id: string;
  usuarioId: string;
  nombre: string;
  estado: "EN_CURSO" | "APROBADO" | "REPROBADO" | "EN_REVISION";
  puntajePct: number | null;
  iniciadoEn: string;
  finalizadoEn: string | null;
  /** Posición de este intento entre los de ESE estudiante para este examen
   * (1 = el primero que rindió), no un id ni el total de filas de la tabla.
   * Es lo que permite leer la fila como "intento 2 de 3" sin contar a mano. */
  numeroIntento: number;
};

/**
 * Situación actual de un estudiante frente al examen, para la fila colapsada
 * del panel — el mismo criterio que `SituacionExamen` (src/lib/examen.ts)
 * pero calculado desde el lado del admin, que ve a TODOS los estudiantes a
 * la vez en vez de a uno solo (`auth.uid()`).
 *
 *   EN_ESPERA_LARGA agotó una tanda completa de intentos sin aprobar y sigue
 *                   dentro de las COOLDOWN_AGOTADO_HORAS de espera. No es
 *                   definitivo — se resuelve solo al cumplirse la espera —
 *                   pero el admin puede saltársela con `otorgarIntentoExtra`.
 */
export type EstadoEstudianteExamen =
  | "APROBADO"
  | "EN_CURSO"
  | "EN_ESPERA_LARGA"
  | "EN_ESPERA_CORTA"
  | "DISPONIBLE";

export type EstudianteResumen = {
  usuarioId: string;
  nombre: string;
  /** Todos sus intentos de este examen, el más reciente primero. */
  intentos: IntentoResumen[];
  /** Máximo puntaje alcanzado entre sus intentos cerrados. `null` si ninguno
   * llegó a calificarse (solo tiene un EN_CURSO). */
  mejorPuntaje: number | null;
  estado: EstadoEstudianteExamen;
};

export type ExamenDetalle = {
  id: string;
  titulo: string;
  instrucciones: DocumentoContenido | null;
  notaAprobatoria: number;
  intentosMaximos: number | null;
  minutosLimite: number | null;
  aleatorizarPreguntas: boolean;
  aleatorizarOpciones: boolean;
  publicado: boolean;
  preguntas: PreguntaCompleta[];
  /** Un elemento por estudiante que ha tocado este examen (al menos un
   * intento), con su historial completo agrupado — no una fila por intento
   * suelto. Ordenados por actividad más reciente. */
  estudiantes: EstudianteResumen[];
  /** Estudiantes distintos que ya aprobaron. Se muestra junto al interruptor
   * de publicación como advertencia: despublicar un examen que ya tiene gente
   * aprobada no les quita el certificado (nunca se revoca, Revf3), pero sí
   * deja de exigirlo a quien venga después. */
  aprobados: number;
};

/**
 * Normaliza el JSONB de `opciones` a la forma tipada. Devuelve `null` si el
 * dato guardado no tiene la forma esperada, en vez de propagar un `any` que
 * reventaría al renderizar: una fila corrupta debe verse como una pregunta sin
 * opciones en el editor, no tumbar la pantalla entera del curso.
 */
function parsearOpciones(valor: unknown): OpcionPregunta[] | null {
  if (!Array.isArray(valor)) return null;

  const opciones: OpcionPregunta[] = [];
  for (const item of valor) {
    if (!item || typeof item !== "object") continue;
    const opcion = item as Record<string, unknown>;
    if (typeof opcion.id !== "string" || typeof opcion.texto !== "string") continue;
    opciones.push({ id: opcion.id, texto: opcion.texto, correcta: opcion.correcta === true });
  }

  return opciones.length > 0 ? opciones : null;
}

export async function getExamenDeCurso(cursoId: string): Promise<ExamenDetalle | null> {
  const supabase = await createClient();

  const { data: examen } = await supabase
    .from("examenes")
    .select(
      `id, titulo, instrucciones, nota_aprobatoria, intentos_maximos, minutos_limite,
       aleatorizar_preguntas, aleatorizar_opciones, publicado,
       preguntas_examen(id, tipo, enunciado, puntos, orden, opciones, respuestas_aceptadas, explicacion)`,
    )
    .eq("id_curso", cursoId)
    .maybeSingle();

  if (!examen) return null;

  // El embedding de PostgREST no promete orden en las filas anidadas — se
  // ordena acá, igual que módulos y lecciones en cursoDetalle.ts.
  const preguntas: PreguntaCompleta[] = (examen.preguntas_examen ?? [])
    .slice()
    .sort((a, b) => a.orden - b.orden)
    // Una pregunta de un tipo de Fase 2 (guardada por una versión futura, o a
    // mano) se omite del editor en vez de renderizarse rota: la app v1 no sabe
    // editarla ni calificarla. Se ignora sin borrarla — el dato sigue ahí.
    .filter((pregunta) => esTipoImplementado(pregunta.tipo))
    .map((pregunta) => ({
      id: pregunta.id,
      tipo: pregunta.tipo,
      // `resolverContenidoLeccion(x, null)` es el mismo normalizador que usan
      // las lecciones: devuelve null si el documento está vacío.
      enunciado: resolverContenidoLeccion(pregunta.enunciado, null) ?? { type: "doc", content: [] },
      puntos: pregunta.puntos,
      orden: pregunta.orden,
      opciones: parsearOpciones(pregunta.opciones),
      respuestasAceptadas: (pregunta.respuestas_aceptadas ?? []) as string[],
      explicacion: resolverContenidoLeccion(pregunta.explicacion, null),
    }));

  const { data: intentos } = await supabase
    .from("intentos_examen")
    // Proyección explícita: `preguntas_congeladas` (que sí lleva las
    // respuestas) y `respuestas` no hacen falta para el listado y no tienen
    // por qué viajar hasta el panel.
    //
    // Orden ASCENDENTE (no descendente): así el `numeroIntento` de cada
    // estudiante se numera en el orden en que realmente los rindió, sin tener
    // que ordenar dos veces. La tabla del panel invierte el arreglo al pintar.
    .select(
      "id, id_usuario, estado, puntaje_pct, iniciado_en, finalizado_en, usuario:perfiles(nombre)",
    )
    .eq("id_examen", examen.id)
    .order("iniciado_en", { ascending: true });

  const contadorPorUsuario = new Map<string, number>();
  const intentosResumen: IntentoResumen[] = (intentos ?? []).map((intento) => {
    const usuario = Array.isArray(intento.usuario) ? intento.usuario[0] : intento.usuario;
    const numeroIntento = (contadorPorUsuario.get(intento.id_usuario) ?? 0) + 1;
    contadorPorUsuario.set(intento.id_usuario, numeroIntento);

    return {
      id: intento.id,
      usuarioId: intento.id_usuario,
      nombre: usuario?.nombre ?? "Usuario eliminado",
      estado: intento.estado,
      // `puntaje_pct` llega como string desde Postgres (numeric no cabe en un
      // number de JS sin pérdida en el caso general, así que postgres-js lo
      // devuelve como texto). Acá el rango es 0-100 con dos decimales, donde
      // el Number es exacto.
      puntajePct: intento.puntaje_pct === null ? null : Number(intento.puntaje_pct),
      iniciadoEn: intento.iniciado_en,
      finalizadoEn: intento.finalizado_en,
      numeroIntento,
    };
  }).reverse(); // el más reciente primero, para el listado del panel.

  const aprobados = new Set(
    intentosResumen.filter((intento) => intento.estado === "APROBADO").map((i) => i.usuarioId),
  ).size;

  // Un elemento por estudiante, no por intento — mismo criterio para agrupar
  // (`.filter` conserva el orden relativo, ya más-reciente-primero desde el
  // `.reverse()` de arriba) que el que la propia UI necesitaría rehacer si
  // recibiera la lista plana; se hace una sola vez acá.
  const estudiantes: EstudianteResumen[] = [...contadorPorUsuario.keys()].map((usuarioId) => {
    const intentosDelEstudiante = intentosResumen.filter((intento) => intento.usuarioId === usuarioId);
    const nombre = intentosDelEstudiante[0]?.nombre ?? "Usuario eliminado";

    const puntajes = intentosDelEstudiante
      .map((intento) => intento.puntajePct)
      .filter((puntaje): puntaje is number => puntaje !== null);
    const mejorPuntaje = puntajes.length > 0 ? Math.max(...puntajes) : null;

    const cerrados = intentosDelEstudiante.filter((intento) => intento.estado !== "EN_CURSO");

    // Mismo orden de prioridad que SituacionExamen (src/lib/examen.ts):
    // aprobado > en curso > espera > disponible. `calcularDisponibilidad`
    // es la MISMA función que decide si el propio estudiante puede iniciar
    // un intento — el admin ve exactamente lo que vería el estudiante.
    let estado: EstadoEstudianteExamen;
    if (intentosDelEstudiante.some((intento) => intento.estado === "APROBADO")) {
      estado = "APROBADO";
    } else if (intentosDelEstudiante.some((intento) => intento.estado === "EN_CURSO")) {
      estado = "EN_CURSO";
    } else {
      const disponibilidad = calcularDisponibilidad(
        cerrados.map((intento) => ({ finalizadoEn: intento.finalizadoEn })),
        examen.intentos_maximos,
      );
      estado = disponibilidad.disponible
        ? "DISPONIBLE"
        : disponibilidad.esperaLarga
          ? "EN_ESPERA_LARGA"
          : "EN_ESPERA_CORTA";
    }

    return { usuarioId, nombre, intentos: intentosDelEstudiante, mejorPuntaje, estado };
  });

  // Por actividad más reciente: cada `intentos` ya viene más-reciente-primero,
  // así que el primero de cada estudiante es su propio intento más nuevo.
  estudiantes.sort(
    (a, b) => new Date(b.intentos[0].iniciadoEn).getTime() - new Date(a.intentos[0].iniciadoEn).getTime(),
  );

  return {
    id: examen.id,
    titulo: examen.titulo,
    instrucciones: resolverContenidoLeccion(examen.instrucciones, null),
    notaAprobatoria: examen.nota_aprobatoria,
    intentosMaximos: examen.intentos_maximos,
    minutosLimite: examen.minutos_limite,
    aleatorizarPreguntas: examen.aleatorizar_preguntas,
    aleatorizarOpciones: examen.aleatorizar_opciones,
    publicado: examen.publicado,
    preguntas,
    estudiantes,
    aprobados,
  };
}
