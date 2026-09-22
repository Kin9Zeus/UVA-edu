import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { obtenerAccesoAlCurso } from "@/lib/accesoCurso";
import { logError } from "@/lib/log";

export type NotaLeccion = {
  id: string;
  leccionId: string;
  segundo: number;
  contenido: string;
  /** El video de la clase se reemplazó después de escribir la nota: el
   * minuto puede no corresponder (docs/notas-leccion.md §6.5). */
  videoCambio: boolean;
  actualizadoEn: string;
};

type FilaNota = {
  id: string;
  id_leccion: string;
  segundo: number;
  contenido: string;
  id_video_mux: string | null;
  actualizado_en: string;
};

const COLUMNAS_NOTA = "id, id_leccion, segundo, contenido, id_video_mux, actualizado_en";

export function aNotaLeccion(fila: FilaNota, idVideoMuxActual: string | null): NotaLeccion {
  return {
    id: fila.id,
    leccionId: fila.id_leccion,
    segundo: fila.segundo,
    contenido: fila.contenido,
    // Sin video de referencia en alguno de los dos lados no hay forma de
    // afirmar que cambió: no se muestra el aviso.
    videoCambio:
      !!fila.id_video_mux && !!idVideoMuxActual && fila.id_video_mux !== idVideoMuxActual,
    actualizadoEn: fila.actualizado_en,
  };
}

/** Postgres embebe una relación a-uno como objeto, pero el tipo de supabase-js la da como arreglo. */
function uno<T>(valor: T | T[] | null | undefined): T | null {
  return (Array.isArray(valor) ? valor[0] : valor) ?? null;
}

/**
 * Notas privadas del usuario en un conjunto de lecciones, ordenadas por
 * segundo. RLS (115_notas_leccion.sql) ya limita la lectura a las filas
 * propias; el filtro por `id_usuario` es para que el plan use el índice
 * (id_usuario, id_leccion, segundo), no una garantía de seguridad.
 *
 * El `id_video_mux` vigente de cada lección viaja embebido en la misma
 * consulta (sin un viaje extra) y se compara acá, en el servidor: el
 * playback ID nunca llega "a secas" al cliente (ver VideoPlayer.tsx).
 *
 * Recibe el cliente para poder usarse tanto desde un Server Component como
 * desde una Server Action.
 */
export async function leerNotasDeLecciones(
  supabase: SupabaseClient,
  leccionIds: string[],
  usuarioId: string,
): Promise<NotaLeccion[]> {
  if (leccionIds.length === 0) return [];

  const { data, error } = await supabase
    .from("notas_leccion")
    .select(`${COLUMNAS_NOTA}, leccion:lecciones(id_video_mux)`)
    .eq("id_usuario", usuarioId)
    .in("id_leccion", leccionIds)
    .order("segundo", { ascending: true })
    .order("creado_en", { ascending: true });

  if (error) {
    // Nunca el contenido de las notas en el log: es dato personal.
    logError("notas:listar", "no se pudieron leer las notas", error, {
      area: "notas",
      lecciones: leccionIds.length,
    });
    return [];
  }

  return (data ?? []).map((fila) => aNotaLeccion(fila, uno(fila.leccion)?.id_video_mux ?? null));
}

/**
 * Notas de una lección para el reproductor. Sin sesión devuelve [] sin
 * consultar nada: la vista previa pública no tiene notas.
 */
export async function getNotasDeLeccion(
  leccionId: string,
  usuarioId: string | null,
): Promise<NotaLeccion[]> {
  if (!usuarioId) return [];
  return leerNotasDeLecciones(await createClient(), [leccionId], usuarioId);
}

export type LeccionDeNota = {
  titulo: string;
  slug: string;
  orden: number;
  moduloOrden: number;
  cursoId: string;
};

export type CursoDeNotas = {
  titulo: string;
  slug: string;
  /** Con acceso, el minuto enlaza a la clase; sin él, es solo texto y se
   * ofrece renovar (docs/notas-leccion.md §6.6). */
  tieneAcceso: boolean;
};

export type MisNotas = {
  notas: NotaLeccion[];
  lecciones: Record<string, LeccionDeNota>;
  cursos: Record<string, CursoDeNotas>;
};

/**
 * Techo de filas de "Mis notas". Con el tope de 200 por lección haría
 * falta un volumen de apuntes muy poco realista para llegar; si se llega,
 * la fase 3 (búsqueda) trae paginación.
 */
const MAX_NOTAS_PAGINA = 2000;

/**
 * Todas las notas del usuario, para /dashboard/notas. Funciona con o sin
 * acceso vigente: es el único lugar donde un estudiante con la suscripción
 * vencida ve sus apuntes (docs/notas-leccion.md §3.1).
 *
 * Una nota cuya lección o curso RLS ya no deja leer (p. ej. un curso
 * despublicado sin acceso) llega sin datos de lección: no está en
 * `lecciones`, y la página la agrupa aparte en vez de esconderla — la nota
 * sigue siendo del estudiante.
 *
 * El acceso se resuelve una vez por curso, en paralelo, con
 * `obtenerAccesoAlCurso` — la única función que decide el muro.
 */
export async function getMisNotas(usuarioId: string): Promise<MisNotas> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notas_leccion")
    .select(
      `${COLUMNAS_NOTA}, leccion:lecciones(titulo, slug, orden, id_video_mux, modulo:modulos(orden, curso:cursos(id, titulo, slug)))`,
    )
    .eq("id_usuario", usuarioId)
    .order("segundo", { ascending: true })
    .limit(MAX_NOTAS_PAGINA);

  if (error) {
    logError("notas:mis-notas", "no se pudieron leer las notas del usuario", error, { area: "notas" });
    return { notas: [], lecciones: {}, cursos: {} };
  }

  const notas: NotaLeccion[] = [];
  const lecciones: Record<string, LeccionDeNota> = {};
  const cursosSinAcceso: Record<string, { titulo: string; slug: string }> = {};

  for (const fila of data ?? []) {
    const leccion = uno(fila.leccion);
    const modulo = uno(leccion?.modulo);
    const curso = uno(modulo?.curso);
    notas.push(aNotaLeccion(fila, leccion?.id_video_mux ?? null));
    if (leccion && modulo && curso) {
      lecciones[fila.id_leccion] = {
        titulo: leccion.titulo,
        slug: leccion.slug,
        orden: leccion.orden,
        moduloOrden: modulo.orden,
        cursoId: curso.id,
      };
      cursosSinAcceso[curso.id] = { titulo: curso.titulo, slug: curso.slug };
    }
  }

  const accesos = await Promise.all(
    Object.keys(cursosSinAcceso).map(
      async (cursoId) => [cursoId, (await obtenerAccesoAlCurso(supabase, usuarioId, cursoId)).tieneAcceso] as const,
    ),
  );
  const cursos: Record<string, CursoDeNotas> = {};
  for (const [cursoId, tieneAcceso] of accesos) {
    cursos[cursoId] = { ...cursosSinAcceso[cursoId], tieneAcceso };
  }

  return { notas, lecciones, cursos };
}
