"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prepararAdjuntosNuevos, subirAdjuntosProcesados } from "@/lib/comunidad-adjuntos";
import { MAX_ADJUNTOS_COMUNIDAD } from "@/lib/comunidad-tipos";
import {
  tituloSchema,
  contenidoPostSchema,
  contenidoRespuestaSchema,
  empleoEmpresaSchema,
  empleoModalidadSchema,
  empleoUbicacionSchema,
  empleoEnlaceSchema,
} from "@/lib/comunidad-validacion";

export type CrearPostComunidadResultado = { error: string } | { success: true; id: string };
export type CrearRespuestaComunidadResultado = { error: string } | { success: true; id: string };

const CATEGORIAS_COMUNIDAD = ["ANUNCIOS", "PROYECTOS", "PREGUNTAS", "EMPLEO"] as const;
export type CategoriaComunidad = (typeof CATEGORIAS_COMUNIDAD)[number];
const categoriaSchema = z.enum(CATEGORIAS_COMUNIDAD);

/** Solo se lee/exige cuando `categoria === "EMPLEO"` — ver el bloque en
 * `crearPostComunidad` de abajo. `ubicacion` llega como string vacío desde
 * un input sin llenar, por eso el `|| undefined` antes de validar con Zod
 * (que trata "" como presente, no como ausente). */
export type DatosEmpleoComunidad = {
  empresa: string;
  modalidad: string;
  ubicacion: string;
  enlace: string;
};

/**
 * Crea una publicación en el feed de Comunidad.
 *
 * `id_usuario` sale de la sesión, nunca del cliente — la policy
 * `comunidad_posts_insert_propio` (083_comunidad.sql) ya lo exige con
 * `auth.uid() = id_usuario`, esto es la misma regla aplicada antes de
 * intentar el INSERT, para un mensaje claro en vez de un error crudo de
 * RLS. Mismo motivo para las dos comprobaciones de abajo (acceso a
 * comunidad, categoría ANUNCIOS): RLS ya las exige, esto solo mejora el
 * mensaje.
 *
 * `adjuntosFormData` son los archivos que el usuario adjuntó al escribir
 * (`EditorTextoEnriquecido.obtenerAdjuntosPendientes()`, armado como
 * `FormData` por el composer — ver el comentario de
 * `extraerAdjuntosPendientes` en comunidad-adjuntos.ts sobre por qué no es
 * un array plano), cada uno todavía referenciado en `contenido` por un
 * token temporal. Se validan TODOS antes de tocar la base
 * (`prepararAdjuntosNuevos`) — si alguno no sirve, no se crea nada — y se
 * les asigna su id real ahí mismo, así el post se inserta de una sola vez
 * con el contenido definitivo (nunca hace falta un segundo UPDATE para
 * "arreglar" los marcadores). El id del post también se decide acá (no lo
 * genera la base) para poder subir cada archivo a una ruta que ya lo
 * referencia sin depender de una vuelta de más.
 */
export async function crearPostComunidad(
  categoria: CategoriaComunidad,
  titulo: string,
  contenido: string,
  /** Ruta del feed (`/comunidad` o `/comunidad?categoria=...`), para
   * revalidar exactamente lo que Next.js cacheó. */
  ruta: string,
  adjuntosFormData: FormData = new FormData(),
  /** Obligatorio si y solo si `categoria === "EMPLEO"` — refleja en la app
   * el mismo CHECK de la base (comunidad_posts_empleo_coherente,
   * 101_comunidad_empleo_campos.sql): se rechaza si falta en Empleo, y se
   * ignora (nunca se guarda) si viene en cualquier otra categoría. */
  datosEmpleo?: DatosEmpleoComunidad,
): Promise<CrearPostComunidadResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión para publicar." };

  const parseoCategoria = categoriaSchema.safeParse(categoria);
  if (!parseoCategoria.success) return { error: "Categoría inválida." };

  const parseoTitulo = tituloSchema.safeParse(titulo);
  if (!parseoTitulo.success) return { error: parseoTitulo.error.issues[0]?.message ?? "Título inválido." };

  const parseoContenido = contenidoPostSchema.safeParse(contenido);
  if (!parseoContenido.success) {
    return { error: parseoContenido.error.issues[0]?.message ?? "Contenido inválido." };
  }

  let empleoValidado: { empresa: string; modalidad: string; ubicacion: string | null; enlace: string } | null = null;
  if (parseoCategoria.data === "EMPLEO") {
    const parseoEmpresa = empleoEmpresaSchema.safeParse(datosEmpleo?.empresa);
    if (!parseoEmpresa.success) return { error: parseoEmpresa.error.issues[0]?.message ?? "Empresa inválida." };

    const parseoModalidad = empleoModalidadSchema.safeParse(datosEmpleo?.modalidad);
    if (!parseoModalidad.success) return { error: parseoModalidad.error.issues[0]?.message ?? "Modalidad inválida." };

    const parseoUbicacion = empleoUbicacionSchema.safeParse(datosEmpleo?.ubicacion || undefined);
    if (!parseoUbicacion.success) return { error: parseoUbicacion.error.issues[0]?.message ?? "Ubicación inválida." };

    const parseoEnlace = empleoEnlaceSchema.safeParse(datosEmpleo?.enlace);
    if (!parseoEnlace.success) return { error: parseoEnlace.error.issues[0]?.message ?? "Enlace inválido." };

    empleoValidado = {
      empresa: parseoEmpresa.data,
      modalidad: parseoModalidad.data,
      ubicacion: parseoUbicacion.data || null,
      enlace: parseoEnlace.data,
    };
  }

  const { data: tieneAcceso } = await supabase.rpc("comunidad_tiene_acceso");
  if (!tieneAcceso) {
    return { error: "Todavía no tienes acceso a la comunidad. Necesitas una suscripción activa." };
  }

  if (parseoCategoria.data === "ANUNCIOS") {
    const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
    if (perfil?.rol !== "ADMINISTRADOR") {
      return { error: "Solo un administrador puede publicar en Anuncios." };
    }
  }

  if (adjuntosFormData.getAll("token").length > MAX_ADJUNTOS_COMUNIDAD) {
    return { error: `No puedes adjuntar más de ${MAX_ADJUNTOS_COMUNIDAD} archivos por publicación.` };
  }

  const resultadoAdjuntos = await prepararAdjuntosNuevos(parseoContenido.data, adjuntosFormData);
  if ("error" in resultadoAdjuntos) return { error: resultadoAdjuntos.error };

  const postId = crypto.randomUUID();
  const { data, error } = await supabase
    .from("comunidad_posts")
    .insert({
      id: postId,
      id_usuario: user.id,
      categoria: parseoCategoria.data,
      titulo: parseoTitulo.data,
      contenido: resultadoAdjuntos.contenido,
      empleo_empresa: empleoValidado?.empresa ?? null,
      empleo_modalidad: empleoValidado?.modalidad ?? null,
      empleo_ubicacion: empleoValidado?.ubicacion ?? null,
      empleo_enlace: empleoValidado?.enlace ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos publicar tu mensaje." };

  await subirAdjuntosProcesados(supabase, resultadoAdjuntos.procesados, { idPost: postId, idUsuario: user.id });

  revalidatePath(ruta);
  return { success: true, id: data.id };
}

/** Responde a una publicación del feed de Comunidad. Mismo tratamiento de
 * adjuntos que crearPostComunidad. */
export async function responderPostComunidad(
  postId: string,
  contenido: string,
  ruta: string,
  adjuntosFormData: FormData = new FormData(),
): Promise<CrearRespuestaComunidadResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión para responder." };

  const parseo = contenidoRespuestaSchema.safeParse(contenido);
  if (!parseo.success) return { error: parseo.error.issues[0]?.message ?? "Respuesta inválida." };

  const { data: post } = await supabase
    .from("comunidad_posts")
    .select("eliminado")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.eliminado) return { error: "La publicación a la que respondes ya no existe." };

  const { data: tieneAcceso } = await supabase.rpc("comunidad_tiene_acceso");
  if (!tieneAcceso) {
    return { error: "Todavía no tienes acceso a la comunidad. Necesitas una suscripción activa." };
  }

  if (adjuntosFormData.getAll("token").length > MAX_ADJUNTOS_COMUNIDAD) {
    return { error: `No puedes adjuntar más de ${MAX_ADJUNTOS_COMUNIDAD} archivos por respuesta.` };
  }

  const resultadoAdjuntos = await prepararAdjuntosNuevos(parseo.data, adjuntosFormData);
  if ("error" in resultadoAdjuntos) return { error: resultadoAdjuntos.error };

  const respuestaId = crypto.randomUUID();
  const { data, error } = await supabase
    .from("comunidad_respuestas")
    .insert({ id: respuestaId, id_usuario: user.id, id_post: postId, contenido: resultadoAdjuntos.contenido })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos publicar tu respuesta." };

  await subirAdjuntosProcesados(supabase, resultadoAdjuntos.procesados, { idRespuesta: respuestaId, idUsuario: user.id });

  revalidatePath(ruta);
  return { success: true, id: data.id };
}
