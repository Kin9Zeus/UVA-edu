import { createClient } from "@/lib/supabase/server";
import { tiempoRelativo } from "@/lib/admin/format";
import { logError } from "@/lib/log";

export type CalificacionCurso = {
  id: string;
  autorId: string;
  autorNombre: string;
  autorFotoUrl: string | null;
  puntuacion: number;
  comentario: string | null;
  tiempo: string;
  totalMeGusta: number;
  meGusta: boolean;
};

/** Reseñas por tanda: la primera la pinta el servidor y cada "Ver más
 * reseñas" trae otra. 9 llena tres filas de la cuadrícula de 3 columnas
 * (CursoCalificaciones). */
export const RESENAS_POR_TANDA = 9;

/** Tope de `desde` que acepta cargarMasCalificacionesCurso: un offset enorme
 * no es un uso real, solo una consulta cara a pedido de cualquiera. */
export const DESDE_MAXIMO_RESENAS = 5_000;

export type CalificacionesCurso = {
  promedio: number | null;
  total: number;
  /** Solo la primera tanda (RESENAS_POR_TANDA), no todas. */
  reseñas: CalificacionCurso[];
  /** Si hay más reseñas después de esta tanda. */
  hayMas: boolean;
  /** La reseña propia del usuario actual, si ya calificó — `null` también
   * para un visitante sin sesión. El composer la usa para precargar el
   * formulario en modo edición en vez de dejarlo crear una segunda. Se
   * consulta aparte: ya no se puede buscar dentro de la lista, porque la
   * lista es solo una tanda. */
  miCalificacion: CalificacionCurso | null;
};

export type TandaCalificaciones = {
  reseñas: CalificacionCurso[];
  hayMas: boolean;
};

type FilaCalificacion = {
  id: string;
  id_usuario: string;
  puntuacion: number;
  comentario: string | null;
  creado_en: string;
};

const COLUMNAS_CALIFICACION = "id, id_usuario, puntuacion, comentario, creado_en";

/**
 * Las reseñas son lo accesorio de la ficha: ante un fallo se degradan (sin
 * promedio, sin reseñas, autor genérico, sin "me gusta") en vez de tumbar la
 * página, igual que antes. Lo que cambia es que ahora queda registrado
 * (AUDIT-2026-09-22.md, seguimiento de P2-3): antes el fallo no dejaba
 * rastro, y un permiso roto en una de las vistas públicas podía pasar
 * semanas como "este curso todavía no tiene reseñas".
 */
function registrarFallo(consulta: string, error: unknown): void {
  if (!error) return;
  logError("curso:calificaciones", `falló la consulta de reseñas (${consulta})`, error, { area: "catalogo", consulta });
}

/** Autor (vista pública) y "me gusta" SOLO de las filas recibidas: una
 * tanda, no todas las reseñas del curso. */
async function completarReseñas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filas: FilaCalificacion[],
  usuarioId: string | null,
): Promise<CalificacionCurso[]> {
  if (filas.length === 0) return [];

  const idsAutores = [...new Set(filas.map((fila) => fila.id_usuario))];
  const idsCalificaciones = filas.map((fila) => fila.id);

  const [{ data: autores, error: errorAutores }, { data: reacciones, error: errorReacciones }] = await Promise.all([
    supabase.from("curso_calificacion_autor_publico").select("id, nombre, foto_url").in("id", idsAutores),
    supabase.from("curso_calificacion_reacciones").select("id_calificacion, id_usuario").in("id_calificacion", idsCalificaciones),
  ]);
  registrarFallo("autores", errorAutores);
  registrarFallo("reacciones", errorReacciones);

  const nombrePorAutorId = new Map((autores ?? []).map((a) => [a.id, a.nombre]));
  const fotoPorAutorId = new Map((autores ?? []).map((a) => [a.id, a.foto_url]));
  const totalMeGustaPorId = new Map<string, number>();
  const meGustaDelUsuario = new Set<string>();
  for (const reaccion of reacciones ?? []) {
    totalMeGustaPorId.set(reaccion.id_calificacion, (totalMeGustaPorId.get(reaccion.id_calificacion) ?? 0) + 1);
    if (usuarioId && reaccion.id_usuario === usuarioId) meGustaDelUsuario.add(reaccion.id_calificacion);
  }

  return filas.map((fila) => ({
    id: fila.id,
    autorId: fila.id_usuario,
    autorNombre: nombrePorAutorId.get(fila.id_usuario) ?? "Estudiante UVA",
    autorFotoUrl: fotoPorAutorId.get(fila.id_usuario) ?? null,
    puntuacion: fila.puntuacion,
    comentario: fila.comentario,
    tiempo: tiempoRelativo(fila.creado_en),
    totalMeGusta: totalMeGustaPorId.get(fila.id) ?? 0,
    meGusta: meGustaDelUsuario.has(fila.id),
  }));
}

/**
 * Una tanda de reseñas de un curso, de la más reciente a la más antigua,
 * empezando en la posición `desde`. AUDIT-2026-09-15.md — P2-10.
 *
 * Paginación por desplazamiento y no por cursor a propósito: el cursor
 * (fecha + id de la última reseña vista) llegaría del navegador y habría que
 * meterlo en un filtro `.or()` de PostgREST, que es texto. Un entero
 * validado no abre esa superficie. El costo: si alguien publica una reseña
 * entre dos clics, la siguiente tanda repite una (el componente descarta
 * duplicados por id); si alguien borra una, se salta una. En una lista de
 * opiniones eso no le importa a nadie.
 *
 * `id` desempata el orden: dos reseñas con el mismo `creado_en` podrían
 * cambiar de lugar entre dos consultas y aparecer dos veces o ninguna.
 *
 * Se pide una fila de más para saber si hay otra tanda sin contar todas.
 */
export async function getTandaCalificacionesCurso(
  cursoId: string,
  usuarioId: string | null,
  desde: number,
): Promise<TandaCalificaciones> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("curso_calificaciones")
    .select(COLUMNAS_CALIFICACION)
    .eq("id_curso", cursoId)
    .eq("eliminado", false)
    .order("creado_en", { ascending: false })
    .order("id", { ascending: false })
    .range(desde, desde + RESENAS_POR_TANDA);
  registrarFallo("tanda", error);

  const filas = (data ?? []) as FilaCalificacion[];
  return {
    reseñas: await completarReseñas(supabase, filas.slice(0, RESENAS_POR_TANDA), usuarioId),
    hayMas: filas.length > RESENAS_POR_TANDA,
  };
}

/**
 * Reseñas públicas de un curso (estrellas + comentario opcional) — visibles
 * sin sesión, a diferencia de Comunidad: el catálogo ya es público
 * (CursoDetalleContent con basePath="/catalogo"). `curso_calificaciones_resumen`
 * y `curso_calificacion_autor_publico` (102_curso_calificaciones.sql)
 * resuelven el promedio y el nombre del autor sin exponer `perfiles` directo.
 *
 * Trae solo la primera tanda (P2-10): antes traía todas las reseñas del curso
 * con todas sus reacciones, en cada visita a una ficha pública. El promedio
 * y el total siguen saliendo del resumen, así que el JSON-LD no cambia.
 */
export async function getCalificacionesCurso(
  cursoId: string,
  usuarioId: string | null,
): Promise<CalificacionesCurso> {
  const supabase = await createClient();

  const [{ data: resumen, error: errorResumen }, primeraTanda, { data: filaPropia, error: errorPropia }] = await Promise.all([
    supabase.from("curso_calificaciones_resumen").select("promedio, total").eq("id_curso", cursoId).maybeSingle(),
    getTandaCalificacionesCurso(cursoId, usuarioId, 0),
    usuarioId
      ? supabase
          .from("curso_calificaciones")
          .select(COLUMNAS_CALIFICACION)
          .eq("id_curso", cursoId)
          .eq("id_usuario", usuarioId)
          .eq("eliminado", false)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  registrarFallo("resumen", errorResumen);
  registrarFallo("propia", errorPropia);

  const propiaEnLaTanda = filaPropia ? primeraTanda.reseñas.find((reseña) => reseña.id === filaPropia.id) : undefined;
  const miCalificacion =
    propiaEnLaTanda ??
    (filaPropia ? (await completarReseñas(supabase, [filaPropia as FilaCalificacion], usuarioId))[0] : null);

  return {
    promedio: resumen?.promedio ?? null,
    total: resumen?.total ?? 0,
    reseñas: primeraTanda.reseñas,
    hayMas: primeraTanda.hayMas,
    miCalificacion,
  };
}
