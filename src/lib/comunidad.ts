import { createClient } from "@/lib/supabase/server";
import { esUuid } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { tiempoRelativo, extensionArchivo } from "@/lib/admin/format";
import { logError } from "@/lib/log";
import { BUCKET_ADJUNTOS_COMUNIDAD } from "@/lib/comunidad-adjuntos";
import type {
  CategoriaComunidad,
  AccesoComunidad,
  ComunidadPostResumen,
  ComunidadRespuesta,
  ComunidadPostDetalle,
  ComunidadActividadItem,
  ComunidadDestacadoItem,
  ComunidadAdjunto,
  ComunidadFeedResultado,
  ComunidadDatosEmpleo,
} from "@/lib/comunidad-tipos";
import { COMUNIDAD_POSTS_POR_PAGINA } from "@/lib/comunidad-tipos";
import { getPerfilActual, getUsuarioActual } from "@/lib/perfil";

// Cubre la duración de una vista del feed/detalle, no solo un clic —a
// diferencia de la URL de descarga de un documento (obtenerUrlAdjuntoComunidad,
// 300s), esta se pinta directo en un <img> y puede quedar abierta en la
// pestaña un rato.
const DURACION_URL_IMAGEN_SEGUNDOS = 3600;

// Solo tipos, nunca valores (CATEGORIAS_COMUNIDAD/CATEGORIA_LABEL): un
// re-export de valor desde este archivo arrastraría `createClient` al
// bundle de cualquier componente cliente que los importara de acá — deben
// importarse directo de `@/lib/comunidad-tipos`. Ver el comentario de ese
// archivo.
export type {
  CategoriaComunidad,
  AccesoComunidad,
  ComunidadPostResumen,
  ComunidadRespuesta,
  ComunidadPostDetalle,
  ComunidadActividadItem,
  ComunidadDestacadoItem,
  ComunidadAdjunto,
  ComunidadDatosEmpleo,
};

/**
 * Único punto que decide si la sesión actual entra a Comunidad — nunca se
 * reimplementa la regla acá, solo se consulta el wrapper público de
 * `private.comunidad_tiene_acceso()` (083/084_comunidad*.sql). El `motivo`
 * que se calcula si no hay acceso es solo para el copy de `ComunidadPausada`,
 * no participa en la decisión — esa ya la tomó la base de datos.
 */
export async function resolverAccesoComunidad(): Promise<AccesoComunidad> {
  const supabase = await createClient();
  const user = await getUsuarioActual();
  if (!user) return { acceso: false, motivo: "SIN_SUSCRIPCION" };

  // El rol sale de getPerfilActual() y no de una consulta propia: está
  // envuelta en cache() de React, así que dentro de un mismo render la
  // comparte con (student)/dashboard/layout.tsx, que ya la resolvió antes de
  // llegar acá. Consultar `perfiles` otra vez era pedir la misma fila dos
  // veces por petición — ~190 ms de ida y vuelta a US-East por nada.
  const [{ data: tieneAcceso }, { perfil }] = await Promise.all([
    supabase.rpc("comunidad_tiene_acceso"),
    getPerfilActual(),
  ]);

  if (tieneAcceso) {
    return { acceso: true, usuarioId: user.id, esAdmin: perfil?.rol === "ADMINISTRADOR" };
  }

  const { data: suscripcion } = await supabase
    .from("suscripciones")
    .select("estado")
    .eq("id_usuario", user.id)
    .order("fecha_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!suscripcion) return { acceso: false, motivo: "SIN_SUSCRIPCION" };
  return { acceso: false, motivo: suscripcion.estado === "CANCELADA" ? "CANCELADA" : "VENCIDA" };
}

type FilaPost = {
  id: string;
  slug: string;
  id_usuario: string;
  categoria: CategoriaComunidad;
  titulo: string;
  contenido: string;
  fijado: boolean;
  eliminado: boolean;
  creado_en: string;
  empleo_empresa: string | null;
  empleo_modalidad: string | null;
  empleo_ubicacion: string | null;
  empleo_enlace: string | null;
};

/** `null` si `fila.categoria !== "EMPLEO"` — ver comentario de
 * `ComunidadDatosEmpleo` en comunidad-tipos.ts. */
function datosEmpleoDeFila(fila: FilaPost): ComunidadDatosEmpleo | null {
  if (fila.categoria !== "EMPLEO" || !fila.empleo_empresa || !fila.empleo_modalidad || !fila.empleo_enlace) {
    return null;
  }
  return {
    empresa: fila.empleo_empresa,
    modalidad: fila.empleo_modalidad as ComunidadDatosEmpleo["modalidad"],
    ubicacion: fila.empleo_ubicacion,
    enlace: fila.empleo_enlace,
  };
}

/**
 * Enriquece filas planas de `comunidad_posts`/`comunidad_respuestas` con
 * nombre de autor (vista pública, 085) y conteo de reacciones — todo con
 * consultas en lote sobre el conjunto de ids ya cargado, nunca una consulta
 * por fila (mismo criterio que `getComentariosDeLeccion`,
 * src/lib/comentarios.ts).
 */
type FilaAdjunto = {
  id: string;
  id_post: string | null;
  id_respuesta: string | null;
  ruta_storage: string;
  nombre_original: string;
  es_imagen: boolean;
  ancho: number | null;
  alto: number | null;
  tamano_bytes: number;
};

async function enriquecer<T extends { id: string; id_usuario: string }>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filas: T[],
  usuarioActualId: string | null,
  /** `false` cuando las reacciones ya llegaron contadas desde SQL
   * (buscar_feed_comunidad): consultarlas otra vez sería doble trabajo y dos
   * fuentes para el mismo número. Sin reacciones, `totalReacciones` queda en
   * 0 y el llamador usa las suyas. */
  { incluirReacciones = true }: { incluirReacciones?: boolean } = {},
): Promise<
  Map<
    string,
    {
      autorNombre: string;
      autorFotoUrl: string | null;
      totalReacciones: number;
      meReaccione: boolean;
      adjuntos: ComunidadAdjunto[];
    }
  >
> {
  const autorIds = [...new Set(filas.map((fila) => fila.id_usuario))];
  const objetivoIds = filas.map((fila) => fila.id);
  const idsParaReacciones = incluirReacciones ? objetivoIds : [];
  const columnasAdjunto = "id, id_post, id_respuesta, ruta_storage, nombre_original, es_imagen, ancho, alto, tamano_bytes";

  // Dos consultas separadas, no un `.or()` con ids interpolados a mano en el
  // filtro: cada fila de `filas` puede ser un post O una respuesta, así que
  // el mismo id puede caer en la columna `id_post` o en `id_respuesta` sin
  // que se sepa de antemano cuál — Postgres simplemente no encuentra nada en
  // la columna que no aplica, sin necesidad de una condición OR construida
  // como texto. Mismo motivo para separar comunidad_adjuntos en dos.
  const [{ data: autores }, { data: reaccionesPost }, { data: reaccionesRespuesta }, { data: adjuntosPost }, { data: adjuntosRespuesta }] =
    await Promise.all([
      autorIds.length
        ? supabase.from("comunidad_autor_publico").select("id, nombre, foto_url").in("id", autorIds)
        : Promise.resolve({ data: [] }),
      idsParaReacciones.length
        ? supabase.from("comunidad_reacciones").select("id_usuario, id_post").in("id_post", idsParaReacciones)
        : Promise.resolve({ data: [] }),
      idsParaReacciones.length
        ? supabase.from("comunidad_reacciones").select("id_usuario, id_respuesta").in("id_respuesta", idsParaReacciones)
        : Promise.resolve({ data: [] }),
      objetivoIds.length
        ? supabase.from("comunidad_adjuntos").select(columnasAdjunto).in("id_post", objetivoIds)
        : Promise.resolve({ data: [] as FilaAdjunto[] }),
      objetivoIds.length
        ? supabase.from("comunidad_adjuntos").select(columnasAdjunto).in("id_respuesta", objetivoIds)
        : Promise.resolve({ data: [] as FilaAdjunto[] }),
    ]);

  const nombresPorId = new Map((autores ?? []).map((a) => [a.id as string, a.nombre as string]));
  const fotosPorId = new Map((autores ?? []).map((a) => [a.id as string, a.foto_url as string | null]));

  const reaccionesPorObjetivo = new Map<string, string[]>();
  for (const r of reaccionesPost ?? []) {
    const objetivo = r.id_post as string;
    const lista = reaccionesPorObjetivo.get(objetivo) ?? [];
    lista.push(r.id_usuario as string);
    reaccionesPorObjetivo.set(objetivo, lista);
  }
  for (const r of reaccionesRespuesta ?? []) {
    const objetivo = r.id_respuesta as string;
    const lista = reaccionesPorObjetivo.get(objetivo) ?? [];
    lista.push(r.id_usuario as string);
    reaccionesPorObjetivo.set(objetivo, lista);
  }

  const filasAdjuntos = [...((adjuntosPost as FilaAdjunto[] | null) ?? []), ...((adjuntosRespuesta as FilaAdjunto[] | null) ?? [])];

  // Firma todas las imágenes de la página en UNA sola llamada a Storage
  // (createSignedUrls acepta un lote de rutas) en vez de una por imagen —
  // mismo motivo que el resto de esta función evita N+1. Los documentos NO
  // se firman acá: se firman bajo demanda al hacer clic en "Descargar"
  // (obtenerUrlAdjuntoComunidad), para no gastar una URL firmada en cada
  // carga de página sobre archivos que nadie va a abrir.
  const rutasImagen = filasAdjuntos.filter((a) => a.es_imagen).map((a) => a.ruta_storage);
  const urlPorRuta = new Map<string, string>();
  if (rutasImagen.length > 0) {
    const { data: firmadas } = await createAdminClient()
      .storage.from(BUCKET_ADJUNTOS_COMUNIDAD)
      .createSignedUrls(rutasImagen, DURACION_URL_IMAGEN_SEGUNDOS);
    for (const firmada of firmadas ?? []) {
      if (!firmada.error && firmada.signedUrl && firmada.path) urlPorRuta.set(firmada.path, firmada.signedUrl);
    }
  }

  const adjuntosPorObjetivo = new Map<string, ComunidadAdjunto[]>();
  for (const fila of filasAdjuntos) {
    const objetivoId = (fila.id_post ?? fila.id_respuesta) as string;
    const lista = adjuntosPorObjetivo.get(objetivoId) ?? [];
    if (fila.es_imagen) {
      const url = urlPorRuta.get(fila.ruta_storage);
      if (!url || fila.ancho === null || fila.alto === null) continue;
      lista.push({ tipo: "imagen", id: fila.id, nombre: fila.nombre_original, url, ancho: fila.ancho, alto: fila.alto });
    } else {
      lista.push({
        tipo: "archivo",
        id: fila.id,
        nombre: fila.nombre_original,
        tamanoBytes: fila.tamano_bytes,
        extension: extensionArchivo(fila.nombre_original),
      });
    }
    adjuntosPorObjetivo.set(objetivoId, lista);
  }

  const resultado = new Map<
    string,
    {
      autorNombre: string;
      autorFotoUrl: string | null;
      totalReacciones: number;
      meReaccione: boolean;
      adjuntos: ComunidadAdjunto[];
    }
  >();
  for (const fila of filas) {
    const listaReacciones = reaccionesPorObjetivo.get(fila.id) ?? [];
    resultado.set(fila.id, {
      autorNombre: nombresPorId.get(fila.id_usuario) ?? "Usuario",
      autorFotoUrl: fotosPorId.get(fila.id_usuario) ?? null,
      totalReacciones: listaReacciones.length,
      meReaccione: usuarioActualId ? listaReacciones.includes(usuarioActualId) : false,
      adjuntos: adjuntosPorObjetivo.get(fila.id) ?? [],
    });
  }
  return resultado;
}

/** Una fila de `buscar_feed_comunidad` (112_feed_comunidad_paginado.sql). */
type FilaFeed = FilaPost & {
  total_respuestas: number;
  total_reacciones: number;
  me_reaccione: boolean;
  total_resultados: number;
  pagina: number;
};

/**
 * Feed de Comunidad, opcionalmente filtrado por categoría o restringido a
 * las publicaciones del usuario actual ("Mis publicaciones", mutuamente
 * excluyente con la categoría). Fijadas primero; después por `orden`:
 * "reciente" (el default) o "relevancia" (reacciones + respuestas).
 * `busqueda` encuentra por título, contenido o nombre del autor, sin
 * distinguir tildes ni mayúsculas.
 *
 * Todo eso —filtro, búsqueda, orden y paginación— ocurre en Postgres
 * (`buscar_feed_comunidad`, AUDIT-2026-09-15.md P2-10). Antes se traía el
 * feed ENTERO a Node y se enriquecía completo (reacciones, adjuntos y una
 * firma de Storage por cada imagen) para mostrar 20 publicaciones; con
 * suficientes publicaciones eso además fallaba en silencio (URL demasiado
 * larga en los `.in()`, conteos truncados por el tope de filas de la API).
 * Ahora solo se enriquecen las filas de la página, y las reacciones llegan
 * contadas desde SQL.
 *
 * La función es `security invoker`: la RLS de Comunidad sigue decidiendo
 * qué se ve, y "Mis publicaciones" usa `auth.uid()`, no un id de la app.
 */
export async function getComunidadFeed(opciones?: {
  categoria?: CategoriaComunidad;
  soloPropios?: boolean;
  busqueda?: string;
  orden?: "relevancia" | "reciente";
  pagina?: number;
}): Promise<ComunidadFeedResultado> {
  const supabase = await createClient();
  const user = await getUsuarioActual();

  const soloPropios = opciones?.soloPropios ?? false;
  const { data, error } = await supabase.rpc("buscar_feed_comunidad", {
    p_categoria: soloPropios ? null : (opciones?.categoria ?? null),
    p_solo_propios: soloPropios,
    p_busqueda: opciones?.busqueda?.trim() || null,
    p_orden: opciones?.orden ?? "reciente",
    p_pagina: Math.max(1, Math.floor(opciones?.pagina ?? 1) || 1),
    p_por_pagina: COMUNIDAD_POSTS_POR_PAGINA,
  });

  if (error) {
    logError("comunidad:feed", "no se pudo leer el feed de comunidad", error, { opciones });
    return { posts: [], pagina: 1, totalPaginas: 1 };
  }

  const filas = (data ?? []) as FilaFeed[];
  if (filas.length === 0) return { posts: [], pagina: 1, totalPaginas: 1 };

  const enriquecido = await enriquecer(supabase, filas, user?.id ?? null, { incluirReacciones: false });

  return {
    pagina: filas[0].pagina,
    totalPaginas: Math.max(1, Math.ceil(Number(filas[0].total_resultados) / COMUNIDAD_POSTS_POR_PAGINA)),
    posts: filas.map((fila) => {
      const extra = enriquecido.get(fila.id)!;
      return {
        id: fila.id,
        slug: fila.slug,
        categoria: fila.categoria,
        titulo: fila.titulo,
        contenido: fila.contenido,
        fijado: fila.fijado,
        // La función ya excluye las eliminadas.
        eliminado: false,
        eliminadoPorAdmin: false,
        tiempo: tiempoRelativo(fila.creado_en),
        autorId: fila.id_usuario,
        autorNombre: extra.autorNombre,
        autorFotoUrl: extra.autorFotoUrl,
        totalRespuestas: Number(fila.total_respuestas),
        totalReacciones: Number(fila.total_reacciones),
        meReaccione: fila.me_reaccione,
        adjuntos: extra.adjuntos,
        datosEmpleo: datosEmpleoDeFila(fila),
      };
    }),
  };
}

/** Un post con su hilo de respuestas, para la pantalla de detalle.
 * `identificador` es el slug de la URL, o el UUID de un enlace viejo (la
 * página redirige ese caso al slug). `null` si no existe o está eliminado
 * (la página responde con 404). */
export async function getComunidadPost(identificador: string): Promise<ComunidadPostDetalle | null> {
  const supabase = await createClient();
  const user = await getUsuarioActual();

  const { data: post, error } = await supabase
    .from("comunidad_posts")
    .select(
      "id, slug, id_usuario, categoria, titulo, contenido, fijado, eliminado, eliminado_por_admin, creado_en, empleo_empresa, empleo_modalidad, empleo_ubicacion, empleo_enlace",
    )
    .eq(esUuid(identificador) ? "id" : "slug", identificador)
    .maybeSingle();

  // Un fallo de la base (p. ej. un Gateway Timeout de Supabase) no es "no
  // existe": con `return null` la página lo pintaba como un 404 "No
  // encontramos esta página", igual que un enlace roto. Lanzado, cae en
  // dashboard/error.tsx (500 con "Reintentar") y `onRequestError`
  // (instrumentation.ts) lo reporta a Sentry — por eso no pasa además por
  // logError, que lo duplicaría. Se envuelve en un Error porque un
  // PostgrestError es un objeto plano (ver `lanzarSiFalla` en examen.ts).
  if (error) {
    throw new Error(
      `comunidad:detalle — no se pudo leer la publicación "${identificador}": ${error.message} (code=${error.code ?? "sin código"})`,
    );
  }
  if (!post) return null;

  // Un post eliminado (por su autor o por moderación) ya no aparece en el
  // feed, pero un enlace directo — o justo la notificación de "tu reporte
  // fue revisado" (100_comunidad_notificaciones_moderacion_reportes.sql,
  // que apunta acá) — sí puede llegar a esta URL. Antes esto devolvía
  // `null` y la página mandaba a un 404 genérico sin explicar qué pasó;
  // ahora se arma un objeto mínimo (sin respuestas ni reacciones: ya no hay
  // nada que ver) para que ComunidadPostDetalleContent pueda mostrar un
  // placeholder claro, mismo criterio que ya usan las respuestas eliminadas
  // dentro de un hilo (nunca 404, un texto "[respuesta eliminada]").
  if (post.eliminado) {
    const { data: autor } = await supabase
      .from("comunidad_autor_publico")
      .select("nombre, foto_url")
      .eq("id", post.id_usuario)
      .maybeSingle();

    return {
      id: post.id,
      slug: post.slug,
      categoria: post.categoria,
      titulo: "",
      contenido: "",
      fijado: false,
      eliminado: true,
      eliminadoPorAdmin: post.eliminado_por_admin,
      tiempo: tiempoRelativo(post.creado_en),
      autorId: post.id_usuario,
      autorNombre: autor?.nombre ?? "Estudiante UVA",
      autorFotoUrl: autor?.foto_url ?? null,
      totalRespuestas: 0,
      totalReacciones: 0,
      meReaccione: false,
      adjuntos: [],
      datosEmpleo: null,
      respuestas: [],
    };
  }

  const { data: respuestasFilas, error: errorRespuestas } = await supabase
    .from("comunidad_respuestas")
    .select("id, id_usuario, contenido, eliminado, eliminado_por_admin, creado_en")
    .eq("id_post", post.id)
    .order("creado_en", { ascending: true });

  if (errorRespuestas) {
    logError("comunidad:detalle", "no se pudieron leer las respuestas", errorRespuestas, { postId: post.id });
  }
  const filasRespuestas = respuestasFilas ?? [];

  const todasLasFilas = [post as FilaPost, ...filasRespuestas];
  const enriquecido = await enriquecer(supabase, todasLasFilas, user?.id ?? null);
  const extraPost = enriquecido.get(post.id)!;

  return {
    id: post.id,
    slug: post.slug,
    categoria: post.categoria,
    titulo: post.titulo,
    contenido: post.contenido,
    fijado: post.fijado,
    eliminado: post.eliminado,
    eliminadoPorAdmin: post.eliminado_por_admin,
    tiempo: tiempoRelativo(post.creado_en),
    autorId: post.id_usuario,
    autorNombre: extraPost.autorNombre,
    autorFotoUrl: extraPost.autorFotoUrl,
    totalRespuestas: filasRespuestas.filter((r) => !r.eliminado).length,
    totalReacciones: extraPost.totalReacciones,
    meReaccione: extraPost.meReaccione,
    adjuntos: extraPost.adjuntos,
    datosEmpleo: datosEmpleoDeFila(post as FilaPost),
    respuestas: filasRespuestas.map((r) => {
      const extra = enriquecido.get(r.id)!;
      return {
        id: r.id,
        contenido: r.eliminado ? "" : r.contenido,
        eliminado: r.eliminado,
        eliminadoPorAdmin: r.eliminado_por_admin,
        tiempo: tiempoRelativo(r.creado_en),
        creadoEn: r.creado_en,
        autorId: r.id_usuario,
        autorNombre: extra.autorNombre,
        autorFotoUrl: extra.autorFotoUrl,
        totalReacciones: extra.totalReacciones,
        meReaccione: extra.meReaccione,
        adjuntos: r.eliminado ? [] : extra.adjuntos,
      };
    }),
  };
}

/** Últimas publicaciones nuevas de toda la comunidad (todas las
 * categorías), para el riel "Publicaciones recientes". Deliberadamente
 * solo publicaciones, no respuestas: cualquier respuesta, hasta un
 * "gracias" de una palabra, calificaba como "actividad" y volvía la lista
 * ruidosa — el volumen de respuestas ya lo resume el bloque de "Más
 * respondidas esta semana". */
export async function getComunidadActividadReciente(): Promise<ComunidadActividadItem[]> {
  const supabase = await createClient();

  const { data: posts, error } = await supabase
    .from("comunidad_posts")
    .select("id, slug, id_usuario, titulo, creado_en")
    .eq("eliminado", false)
    .order("creado_en", { ascending: false })
    .limit(6);

  if (error) {
    logError("comunidad:actividad-reciente", "no se pudo leer la actividad reciente", error, {});
    return [];
  }

  const filas = posts ?? [];
  if (filas.length === 0) return [];

  const autorIds = [...new Set(filas.map((p) => p.id_usuario as string))];
  const { data: autores } = autorIds.length
    ? await supabase.from("comunidad_autor_publico").select("id, nombre").in("id", autorIds)
    : { data: [] as { id: string; nombre: string }[] };

  const nombrePorAutorId = new Map((autores ?? []).map((a) => [a.id as string, a.nombre as string]));

  return filas.map((p) => ({
    id: p.id as string,
    slug: p.slug as string,
    titulo: p.titulo as string,
    autorNombre: nombrePorAutorId.get(p.id_usuario as string) ?? "Usuario",
    tiempo: tiempoRelativo(p.creado_en as string),
  }));
}

/** Publicaciones con más respuestas en los últimos 7 días, para el riel
 * "Más respondidas esta semana" — conteo real sobre `comunidad_respuestas`,
 * sin ningún contador inventado ni algoritmo de tendencias. */
export async function getComunidadDestacados(): Promise<ComunidadDestacadoItem[]> {
  const supabase = await createClient();
  // Agregado y cortado en SQL (comunidad_mas_respondidas, 112): antes se
  // traían todas las publicaciones de la semana y se contaban sus respuestas
  // en Node, con un `.in()` que crecía con la actividad.
  const { data, error } = await supabase.rpc("comunidad_mas_respondidas", { p_dias: 7, p_limite: 4 });
  if (error) {
    logError("comunidad:destacados", "no se pudieron leer los destacados", error, {});
    return [];
  }
  return ((data ?? []) as { id: string; slug: string; titulo: string; total_respuestas: number }[]).map((fila) => ({
    id: fila.id,
    slug: fila.slug,
    titulo: fila.titulo,
    totalRespuestas: Number(fila.total_respuestas),
  }));
}
