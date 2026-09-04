"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { IMAGEN_PORTADA_PLACEHOLDER } from "@/lib/media";
import { procesarPortada } from "@/lib/admin/portada";
import { procesarRecurso } from "@/lib/admin/recurso";
import { motivosParaNoPublicar } from "@/lib/admin/publicacion";
import type { AdminActionResult } from "@/actions/admin/categorias";
import type { RecursoDetalle } from "@/lib/admin/cursoDetalle";
import { ordenEntre, siguienteOrden } from "@/lib/orden";
import {
  contenidoLeccionSchema,
  contenidoEstaVacio,
  TAMANO_MAXIMO_CONTENIDO,
  type DocumentoContenido,
} from "@/lib/editor/tipos";
// Nombre de carpeta legible para Storage (solo eso: no es un identificador
// único por sí solo, `subirRecursoLeccion` siempre le agrega un sufijo del
// id del curso al lado). Es la misma normalización que genera el slug de
// las categorías — ver lib/slug.ts.
import { slugificar as slugificarTexto, slugDisponible } from "@/lib/slug";

const BUCKET_MATERIALES = "materiales-lecciones";
const BUCKET_PORTADAS = "portadas-cursos";

const slugificar = (texto: string) => slugificarTexto(texto, "curso");

/**
 * Slug libre para `titulo`, ignorando el propio curso al editar (`exceptoId`)
 * para que reguardar sin cambiar el título no le agregue un sufijo contra sí
 * mismo. Mismo criterio que generarSlug() en actions/admin/categorias.ts.
 */
async function generarSlugCurso(
  supabase: SupabaseClient,
  titulo: string,
  exceptoId?: string,
): Promise<string> {
  const base = slugificar(titulo);

  let consulta = supabase.from("cursos").select("slug").like("slug", `${base}%`);
  if (exceptoId) consulta = consulta.neq("id", exceptoId);
  const { data } = await consulta;

  return slugDisponible(base, (data ?? []).map((fila) => fila.slug as string));
}

/** Ruta dentro del bucket a partir de una public URL de Storage, o null si
 * `url` no viene de `BUCKET_PORTADAS` (el placeholder, u otro valor). */
function extraerRutaPortada(url: string | null) {
  if (!url) return null;
  const marcador = `/object/public/${BUCKET_PORTADAS}/`;
  const indice = url.indexOf(marcador);
  return indice === -1 ? null : url.slice(indice + marcador.length);
}

export type NivelCurso = "BASICO" | "INTERMEDIO" | "AVANZADO";

// ------------------------------------------------------------
// Validación de esquema (nunca confiar en la validación del formulario:
// cualquiera de estas Server Actions es un endpoint que se puede llamar
// directo, sin pasar por la UI que arma sus props).
// ------------------------------------------------------------
const idSchema = z.string().uuid("Identificador inválido.");
const nivelSchema = z.enum(["BASICO", "INTERMEDIO", "AVANZADO"], "Selecciona un nivel válido.");

/**
 * Al menos uno: un curso sin instructor no se puede mostrar en el catálogo con
 * sentido. Varios, porque `curso_instructores` es muchos-a-muchos — un curso
 * puede dictarlo más de un profesor.
 */
const idsInstructoresSchema = z
  .array(idSchema)
  .min(1, "Selecciona al menos un instructor.")
  .max(20, "Demasiados instructores para un mismo curso.");

const crearCursoSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(1, "El nombre del curso es obligatorio.")
    .max(200, "El nombre del curso es demasiado largo."),
  descripcion: z.string().trim().max(5000, "La descripción es demasiado larga."),
  categoriaIds: z.array(idSchema).min(1, "Selecciona al menos una categoría."),
  nivel: nivelSchema,
  idsInstructores: idsInstructoresSchema,
});

const actualizarInfoCursoSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(1, "El nombre del curso es obligatorio.")
    .max(200, "El nombre del curso es demasiado largo."),
  descripcion: z.string().trim().max(5000, "La descripción es demasiado larga."),
  categoriaIds: z.array(idSchema).min(1, "Selecciona al menos una categoría."),
  nivel: nivelSchema,
  idsInstructores: idsInstructoresSchema,
});

const actualizarConfiguracionCursoSchema = z.object({
  mostrado: z.boolean(),
  destacado: z.boolean(),
  ordenVisualizacion: z
    .number()
    .finite("El orden debe ser un número.")
    .int("El orden debe ser un número entero.")
    .min(0, "El orden no puede ser negativo.")
    .max(100000, "El orden es demasiado alto."),
});

const tituloModuloSchema = z
  .string()
  .trim()
  .min(1, "El nombre del módulo es obligatorio.")
  .max(200, "El nombre del módulo es demasiado largo.");

const tituloLeccionSchema = z
  .string()
  .trim()
  .min(1, "El nombre de la lección es obligatorio.")
  .max(200, "El nombre de la lección es demasiado largo.");

const actualizarLeccionSchema = z.object({
  titulo: tituloLeccionSchema,
  contenido: contenidoLeccionSchema.nullable(),
});

const moverSchema = z.object({
  elementoId: idSchema,
  idAnterior: idSchema.nullable(),
  idSiguiente: idSchema.nullable(),
});

/** Primer mensaje de error de un `safeParse` fallido, listo para `{ error }`. */
function primerError(resultado: { success: false; error: z.ZodError }): string {
  return resultado.error.issues[0]?.message ?? "Datos inválidos.";
}

/**
 * Comprueba que cada id corresponda a una cuenta REAL con rol PROFESOR.
 *
 * Sin esto, un cliente que llame la Server Action directamente podría colgar de
 * un curso el id de cualquier perfil —un estudiante, otro administrador— y su
 * nombre aparecería como profesor en el catálogo público a través de
 * `curso_instructores_publico`. La FK de la base solo garantiza que el perfil
 * exista, no qué rol tiene: esa parte se valida acá.
 *
 * Devuelve el mensaje de error, o `null` si todos son válidos.
 */
async function validarInstructores(
  supabase: SupabaseClient,
  idsInstructores: string[],
): Promise<string | null> {
  const { data, error } = await supabase
    .from("perfiles")
    .select("id")
    .eq("rol", "PROFESOR")
    .in("id", idsInstructores);

  if (error) return "No pudimos verificar los instructores.";

  const validos = new Set((data ?? []).map((perfil) => perfil.id as string));
  if (idsInstructores.some((id) => !validos.has(id))) {
    return "Alguno de los instructores seleccionados ya no tiene rol de profesor.";
  }
  return null;
}

/**
 * Deja `curso_instructores` con exactamente `idsInstructores` para ese curso.
 *
 * Reemplazo del set completo (borrar lo que sobra, insertar lo que falta) en
 * vez de un diff fino: la puente no guarda nada más que la relación, así que
 * no hay estado que preservar entre una fila borrada y una reinsertada.
 *
 * Primero inserta y después borra, igual que la sincronización de categorías:
 * si el borrado corriera antes y el insert fallara, el curso quedaría sin
 * ningún instructor visible en el catálogo. El UNIQUE
 * (id_curso, id_instructor) hace que reinsertar uno que ya estaba no cree
 * duplicados — por eso solo se insertan los que faltan.
 */
async function sincronizarInstructores(
  supabase: SupabaseClient,
  cursoId: string,
  idsInstructores: string[],
): Promise<string | null> {
  const { data: actuales, error: errorLectura } = await supabase
    .from("curso_instructores")
    .select("id, id_instructor")
    .eq("id_curso", cursoId);

  if (errorLectura) return "No pudimos guardar los instructores.";

  const yaAsignados = new Set((actuales ?? []).map((fila) => fila.id_instructor as string));
  const porAgregar = idsInstructores.filter((id) => !yaAsignados.has(id));
  // El borrado va por el id de la fila puente, no por `not.in` sobre ids que
  // vienen del cliente — mismo criterio que la sincronización de categorías.
  const porQuitar = (actuales ?? [])
    .filter((fila) => !idsInstructores.includes(fila.id_instructor as string))
    .map((fila) => fila.id as string);

  if (porAgregar.length > 0) {
    const { error } = await supabase
      .from("curso_instructores")
      .insert(porAgregar.map((id_instructor) => ({ id_curso: cursoId, id_instructor })));
    if (error) return "No pudimos guardar los instructores.";
  }

  if (porQuitar.length > 0) {
    const { error } = await supabase.from("curso_instructores").delete().in("id", porQuitar);
    if (error) return "No pudimos guardar los instructores.";
  }

  return null;
}

/**
 * Crea el curso SIEMPRE como borrador.
 *
 * Antes aceptaba `publicar: boolean` y el formulario tenía un botón
 * "Publicar curso", que dejaba en el catálogo público un curso sin portada,
 * sin módulos y sin lecciones. Con las reglas de motivosParaNoPublicar() un
 * curso recién creado nunca las cumple, así que ese botón solo podía fallar:
 * se publica desde el detalle, cuando ya hay contenido (ver Revcurso,
 * "publicar un curso a medias es peor que no publicarlo").
 */
export async function crearCurso(input: {
  titulo: string;
  descripcion: string;
  categoriaIds: string[];
  nivel: NivelCurso;
  idsInstructores: string[];
}): Promise<AdminActionResult & { id?: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  // Se deduplica ANTES de validar por si el cliente manda el mismo id
  // repetido: el UNIQUE (id_curso, id_categoria) de la puente rechazaría el
  // insert entero, y min(1) no debe fallar solo porque el duplicado infló
  // el conteo. Mismo motivo para los instructores, que tienen su propio
  // UNIQUE (id_curso, id_instructor).
  const parseo = crearCursoSchema.safeParse({
    ...input,
    categoriaIds: [...new Set(input.categoriaIds)],
    idsInstructores: [...new Set(input.idsInstructores)],
  });
  if (!parseo.success) return { error: primerError(parseo) };
  const { titulo, descripcion, categoriaIds, nivel, idsInstructores } = parseo.data;

  const errorInstructores = await validarInstructores(admin.supabase, idsInstructores);
  if (errorInstructores) return { error: errorInstructores };

  // `id_instructor` (la FK vieja hacia `instructores`) NO se escribe: es una
  // columna vestigial desde la migración 20260903000000_multi_instructores,
  // que la dejó nullable justamente para esto. Ver el comentario del modelo
  // Instructores en prisma/schema.prisma.
  const { data, error } = await admin.supabase
    .from("cursos")
    .insert({
      titulo,
      slug: await generarSlugCurso(admin.supabase, titulo),
      descripcion,
      imagen_portada: IMAGEN_PORTADA_PLACEHOLDER,
      nivel,
      mostrado: false,
      id_admin_creador: admin.adminId,
    })
    .select("id")
    .single();

  if (error) return { error: "No pudimos crear el curso." };

  const { error: errorCategoria } = await admin.supabase
    .from("curso_categorias")
    .insert(categoriaIds.map((id_categoria) => ({ id_curso: data.id, id_categoria })));

  if (errorCategoria) {
    await admin.supabase.from("cursos").delete().eq("id", data.id);
    return { error: "No pudimos asignar las categorías." };
  }

  const { error: errorInstructor } = await admin.supabase
    .from("curso_instructores")
    .insert(idsInstructores.map((id_instructor) => ({ id_curso: data.id, id_instructor })));

  if (errorInstructor) {
    // Las dos puentes son ON DELETE CASCADE, así que borrar el curso se lleva
    // también las filas de categorías ya insertadas: no queda basura.
    await admin.supabase.from("cursos").delete().eq("id", data.id);
    return { error: "No pudimos asignar los instructores." };
  }

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Creó un curso en borrador",
    entidadAfectada: "cursos",
    idEntidadAfectada: data.id,
    detalles: titulo,
  });

  revalidatePath("/admin/cursos");
  return { success: true, id: data.id };
}

export async function actualizarInfoCurso(
  cursoId: string,
  input: {
    titulo: string;
    descripcion: string;
    categoriaIds: string[];
    nivel: NivelCurso;
    idsInstructores: string[];
  },
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const parseo = actualizarInfoCursoSchema.safeParse({
    ...input,
    categoriaIds: [...new Set(input.categoriaIds)],
    idsInstructores: [...new Set(input.idsInstructores)],
  });
  if (!parseo.success) return { error: primerError(parseo) };
  const { titulo, descripcion, categoriaIds, nivel, idsInstructores } = parseo.data;

  const errorInstructores = await validarInstructores(admin.supabase, idsInstructores);
  if (errorInstructores) return { error: errorInstructores };

  const { error } = await admin.supabase
    .from("cursos")
    .update({
      titulo,
      slug: await generarSlugCurso(admin.supabase, titulo, cursoId),
      descripcion,
      nivel,
    })
    .eq("id", cursoId);

  if (error) return { error: "No pudimos guardar los cambios." };

  // Sincroniza la puente con la selección: se agregan las que faltan y se
  // quitan las que sobran. El diff se calcula acá y el borrado va por el id
  // de la fila puente para no interpolar ids que vienen del cliente dentro
  // de un filtro `not.in` de PostgREST.
  const { data: actuales, error: errorLectura } = await admin.supabase
    .from("curso_categorias")
    .select("id, id_categoria")
    .eq("id_curso", cursoId);

  if (errorLectura) return { error: "No pudimos guardar las categorías." };

  const yaAsignadas = new Set((actuales ?? []).map((fila) => fila.id_categoria as string));
  const porAgregar = categoriaIds.filter((id) => !yaAsignadas.has(id));
  const porQuitar = (actuales ?? [])
    .filter((fila) => !categoriaIds.includes(fila.id_categoria as string))
    .map((fila) => fila.id as string);

  // Primero se agrega y después se quita: si el borrado corriera antes y el
  // insert fallara, el curso quedaría sin ninguna categoría y desaparecería
  // del catálogo.
  if (porAgregar.length > 0) {
    const { error: errorInsert } = await admin.supabase
      .from("curso_categorias")
      .insert(porAgregar.map((id_categoria) => ({ id_curso: cursoId, id_categoria })));
    if (errorInsert) return { error: "No pudimos guardar las categorías." };
  }

  if (porQuitar.length > 0) {
    const { error: errorDelete } = await admin.supabase
      .from("curso_categorias")
      .delete()
      .in("id", porQuitar);
    if (errorDelete) return { error: "No pudimos guardar las categorías." };
  }

  const errorSincronizacion = await sincronizarInstructores(
    admin.supabase,
    cursoId,
    idsInstructores,
  );
  if (errorSincronizacion) return { error: errorSincronizacion };

  revalidatePath(`/admin/cursos/${cursoId}`);
  revalidatePath("/admin/cursos");
  revalidatePath("/catalogo");
  revalidatePath("/dashboard/catalogo");
  revalidatePath(`/cursos/${cursoId}`);
  return { success: true };
}

/**
 * Comprueba en el servidor que un curso esté listo para publicarse.
 *
 * Es el único sitio donde se lee el estado real (portada, módulos y estado
 * de procesamiento de cada lección) para pasárselo a la regla pura de
 * lib/admin/publicacion.ts. La UI también la aplica para deshabilitar el
 * interruptor, pero esa comprobación es cortesía: la que manda es esta,
 * porque publicar es una mutación y el cliente puede llamarla directamente.
 *
 * Devuelve `null` si se puede publicar, o el mensaje de error si no.
 */
async function bloqueoDePublicacion(
  supabase: SupabaseClient,
  cursoId: string,
): Promise<string | null> {
  const { data: curso } = await supabase
    .from("cursos")
    .select("titulo, imagen_portada, modulos(lecciones(estado_procesamiento))")
    .eq("id", cursoId)
    .single();

  if (!curso) return "El curso ya no existe.";

  const motivos = motivosParaNoPublicar({
    titulo: curso.titulo,
    imagenPortada: curso.imagen_portada,
    modulos: (curso.modulos ?? []).map((modulo) => ({
      lecciones: (modulo.lecciones ?? []).map((leccion) => ({
        estadoProcesamiento: leccion.estado_procesamiento,
      })),
    })),
  });

  if (motivos.length === 0) return null;
  return `No se puede publicar todavía: ${motivos.join(" ")}`;
}

export async function actualizarConfiguracionCurso(
  cursoId: string,
  input: { mostrado: boolean; destacado: boolean; ordenVisualizacion: number },
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const parseo = actualizarConfiguracionCursoSchema.safeParse(input);
  if (!parseo.success) return { error: primerError(parseo) };
  const { mostrado, destacado, ordenVisualizacion } = parseo.data;

  // Solo se valida al ENCENDER la visibilidad. Despublicar siempre debe
  // poderse, incluso un curso incompleto: es la vía de escape si algo salió
  // mal en producción.
  if (mostrado) {
    const bloqueo = await bloqueoDePublicacion(admin.supabase, cursoId);
    if (bloqueo) return { error: bloqueo };
  }

  const { error } = await admin.supabase
    .from("cursos")
    .update({
      mostrado,
      destacado,
      orden_visualizacion: ordenVisualizacion,
    })
    .eq("id", cursoId);

  if (error) return { error: "No pudimos guardar la configuración." };

  revalidatePath(`/admin/cursos/${cursoId}`);
  revalidatePath("/admin/cursos");
  return { success: true };
}

export async function alternarPublicacionCurso(cursoId: string, mostrado: boolean): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(cursoId).success) return { error: "Curso inválido." };
  if (typeof mostrado !== "boolean") return { error: "Datos inválidos." };

  // Igual que en actualizarConfiguracionCurso: se valida al publicar, nunca
  // al despublicar.
  if (mostrado) {
    const bloqueo = await bloqueoDePublicacion(admin.supabase, cursoId);
    if (bloqueo) return { error: bloqueo };
  }

  const { error } = await admin.supabase.from("cursos").update({ mostrado }).eq("id", cursoId);
  if (error) return { error: "No pudimos actualizar el curso." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: mostrado ? "Publicó un curso" : "Despublicó un curso",
    entidadAfectada: "cursos",
    idEntidadAfectada: cursoId,
  });

  revalidatePath("/admin/cursos");
  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}

export async function subirPortadaCurso(
  cursoId: string,
  formData: FormData,
): Promise<AdminActionResult & { url?: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(cursoId).success) return { error: "Curso inválido." };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) return { error: "Selecciona una imagen." };

  // Valida el formato real (magic bytes, no el `type` que manda el cliente)
  // y devuelve un WebP 1280×720 — ver lib/admin/portada.ts.
  const procesada = await procesarPortada(archivo);
  if ("error" in procesada) return { error: procesada.error };
  const { cuerpo, contentType, extension } = procesada.portada;

  const { data: curso } = await admin.supabase
    .from("cursos")
    .select("titulo, imagen_portada")
    .eq("id", cursoId)
    .single();

  // El nombre es aleatorio, nunca el que traía el archivo del usuario: evita
  // colisiones entre subidas y que un nombre malicioso ("../..") escape de
  // la carpeta del curso.
  const carpetaCurso = `${slugificar(curso?.titulo ?? "curso")}-${cursoId.slice(0, 8)}`;
  const rutaArchivo = `${carpetaCurso}/${randomUUID()}.${extension}`;

  const { error: errorSubida } = await admin.supabase.storage
    .from(BUCKET_PORTADAS)
    .upload(rutaArchivo, cuerpo, { contentType });

  if (errorSubida) return { error: "No pudimos subir la imagen." };

  const {
    data: { publicUrl },
  } = admin.supabase.storage.from(BUCKET_PORTADAS).getPublicUrl(rutaArchivo);

  const { error } = await admin.supabase
    .from("cursos")
    .update({ imagen_portada: publicUrl })
    .eq("id", cursoId);

  if (error) {
    await admin.supabase.storage.from(BUCKET_PORTADAS).remove([rutaArchivo]);
    return { error: "No pudimos guardar la portada." };
  }

  // Se borra después de confirmar el update: si algo falla antes, la
  // portada anterior se queda intacta en vez de perderse.
  const rutaAnterior = extraerRutaPortada(curso?.imagen_portada ?? null);
  if (rutaAnterior) {
    await admin.supabase.storage.from(BUCKET_PORTADAS).remove([rutaAnterior]);
  }

  revalidatePath(`/admin/cursos/${cursoId}`);
  revalidatePath("/admin/cursos");
  revalidatePath(`/cursos/${cursoId}`);
  return { success: true, url: publicUrl };
}

export async function eliminarCurso(cursoId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(cursoId).success) return { error: "Curso inválido." };

  // Bloqueo explícito por inscripciones (Revcurso: "eliminar un curso con
  // inscripciones debe estar bloqueado; ofrece despublicar en su lugar").
  // No es solo defensa en profundidad del FK de abajo: es el mensaje que de
  // verdad le dice al administrador qué hacer en su lugar.
  const { count: inscritos, error: errorInscritos } = await admin.supabase
    .from("inscripciones")
    .select("id", { count: "exact", head: true })
    .eq("id_curso", cursoId);
  if (errorInscritos) return { error: "No pudimos verificar los estudiantes del curso." };
  if ((inscritos ?? 0) > 0) {
    return {
      error:
        inscritos === 1
          ? "Este curso tiene 1 estudiante inscrito. No se puede eliminar — despublícalo en vez de borrarlo."
          : `Este curso tiene ${inscritos} estudiantes inscritos. No se puede eliminar — despublícalo en vez de borrarlo.`,
    };
  }

  // modulos.id_curso es ON DELETE RESTRICT a propósito (ver auditoría de
  // esquema, Bloque 1): un curso con contenido nunca debe desaparecer por
  // accidente en un solo DELETE. Se comprueba antes para devolver un
  // mensaje claro en vez de dejar que Postgres rechace la operación con
  // una violación de llave foránea genérica.
  const { count, error: errorConteo } = await admin.supabase
    .from("modulos")
    .select("id", { count: "exact", head: true })
    .eq("id_curso", cursoId);
  if (errorConteo) return { error: "No pudimos verificar el contenido del curso." };
  if ((count ?? 0) > 0) {
    return { error: "Este curso tiene módulos. Elimínalos primero para poder borrar el curso." };
  }

  const { error } = await admin.supabase.from("cursos").delete().eq("id", cursoId);
  if (error) return { error: "No pudimos eliminar el curso." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Eliminó un curso",
    entidadAfectada: "cursos",
    idEntidadAfectada: cursoId,
  });

  revalidatePath("/admin/cursos");
  return { success: true };
}

// ------------------------------------------------------------
// Módulos
// ------------------------------------------------------------

export async function crearModulo(cursoId: string, titulo: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(cursoId).success) return { error: "Curso inválido." };

  const parseo = tituloModuloSchema.safeParse(titulo);
  if (!parseo.success) return { error: primerError(parseo) };
  const tituloLimpio = parseo.data;

  const { data: ultimo } = await admin.supabase
    .from("modulos")
    .select("orden")
    .eq("id_curso", cursoId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await admin.supabase.from("modulos").insert({
    id_curso: cursoId,
    titulo: tituloLimpio,
    orden: siguienteOrden(ultimo?.orden ?? null),
  });

  if (error) return { error: "No pudimos crear el módulo." };

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}

export async function actualizarModulo(
  moduloId: string,
  cursoId: string,
  titulo: string,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(moduloId).success) return { error: "Módulo inválido." };

  const parseo = tituloModuloSchema.safeParse(titulo);
  if (!parseo.success) return { error: primerError(parseo) };

  const { error } = await admin.supabase.from("modulos").update({ titulo: parseo.data }).eq("id", moduloId);
  if (error) return { error: "No pudimos renombrar el módulo." };

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}

export async function eliminarModulo(moduloId: string, cursoId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(moduloId).success) return { error: "Módulo inválido." };

  const { error } = await admin.supabase.from("modulos").delete().eq("id", moduloId);
  if (error) return { error: "No pudimos eliminar el módulo." };

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}

/**
 * Mueve un módulo a la posición entre `idAnterior` e `idSiguiente` (los
 * vecinos ya reordenados en el frontend). Camino feliz: una sola escritura
 * (el `orden` fraccionado entre los dos vecinos, ver ordenEntre() en
 * lib/orden.ts). Si no queda espacio entre ellos, reespacía el curso
 * completo de 10 en 10 — pero en una sola sentencia SQL transaccional
 * (reespaciar_orden_modulos, supabase/sql/029_reordenar_modulos_lecciones.sql),
 * no un UPDATE por fila desde aquí.
 */
export async function moverModulo(
  cursoId: string,
  moduloId: string,
  idAnterior: string | null,
  idSiguiente: string | null,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(cursoId).success) return { error: "Curso inválido." };
  const parseo = moverSchema.safeParse({ elementoId: moduloId, idAnterior, idSiguiente });
  if (!parseo.success) return { error: primerError(parseo) };

  const idsVecinos = [idAnterior, idSiguiente].filter((id): id is string => id !== null);
  const { data: vecinos } = idsVecinos.length
    ? await admin.supabase.from("modulos").select("id, orden").in("id", idsVecinos)
    : { data: [] };

  const ordenDe = (id: string | null) => (id ? (vecinos ?? []).find((v) => v.id === id)?.orden ?? null : null);
  const nuevoOrden = ordenEntre(ordenDe(idAnterior), ordenDe(idSiguiente));

  if (nuevoOrden !== null) {
    const { error } = await admin.supabase.from("modulos").update({ orden: nuevoOrden }).eq("id", moduloId);
    if (error) return { error: "No pudimos guardar el nuevo orden de los módulos." };
  } else {
    const { data: resto } = await admin.supabase
      .from("modulos")
      .select("id")
      .eq("id_curso", cursoId)
      .neq("id", moduloId)
      .order("orden");

    const ordenados = resto ?? [];
    const indiceDestino = idAnterior ? ordenados.findIndex((m) => m.id === idAnterior) + 1 : 0;
    ordenados.splice(indiceDestino, 0, { id: moduloId });

    // Server Actions no llegan a la base con la Service Role Key
    // (requireAdmin da el cliente de sesión); la RPC sí la necesita porque
    // está restringida a service_role — mismo criterio que
    // canjear_codigo_invitacion (017_canjear_codigo_invitacion.sql).
    const { error } = await createAdminClient().rpc("reespaciar_orden_modulos", {
      p_curso_id: cursoId,
      p_ids: ordenados.map((modulo) => modulo.id),
    });
    if (error) return { error: "No pudimos guardar el nuevo orden de los módulos." };
  }

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}

// ------------------------------------------------------------
// Lecciones
// ------------------------------------------------------------

export async function crearLeccion(
  moduloId: string,
  cursoId: string,
  titulo: string,
): Promise<AdminActionResult & { id?: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(moduloId).success) return { error: "Módulo inválido." };

  const parseoTitulo = tituloLeccionSchema.safeParse(titulo);
  if (!parseoTitulo.success) return { error: primerError(parseoTitulo) };
  const tituloLimpio = parseoTitulo.data;

  const { data: ultima } = await admin.supabase
    .from("lecciones")
    .select("orden")
    .eq("id_modulo", moduloId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await admin.supabase
    .from("lecciones")
    .insert({
      id_modulo: moduloId,
      titulo: tituloLimpio,
      orden: siguienteOrden(ultima?.orden ?? null),
    })
    .select("id")
    .single();

  if (error) return { error: "No pudimos crear la lección." };

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true, id: data.id };
}

export async function actualizarLeccion(
  leccionId: string,
  cursoId: string,
  input: { titulo: string; contenido: DocumentoContenido | null },
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(leccionId).success) return { error: "Lección inválida." };

  if (input.contenido && JSON.stringify(input.contenido).length > TAMANO_MAXIMO_CONTENIDO) {
    return { error: "El contenido de la lección es demasiado largo." };
  }

  const parseo = actualizarLeccionSchema.safeParse(input);
  if (!parseo.success) return { error: primerError(parseo) };
  const { titulo, contenido } = parseo.data;

  // `duracion` no se escribe desde acá a propósito: es el webhook de Mux
  // (video.asset.ready, src/app/api/webhooks/mux/route.ts) el único que la
  // sincroniza con la duración real del video subido. Un input editable a
  // mano permitía que quedara desincronizada del video después de procesar.
  //
  // `resumen` (texto plano legado) no se escribe más — `contenido` es la
  // única fuente de verdad desde aquí en adelante. Ver comentario en
  // schema.prisma y resolverContenidoLeccion.
  const { error } = await admin.supabase
    .from("lecciones")
    .update({ titulo, contenido: contenido && !contenidoEstaVacio(contenido) ? contenido : null })
    .eq("id", leccionId);

  if (error) return { error: "No pudimos guardar la lección." };

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}

export async function eliminarLeccion(leccionId: string, cursoId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(leccionId).success) return { error: "Lección inválida." };

  const { error } = await admin.supabase.from("lecciones").delete().eq("id", leccionId);
  if (error) return { error: "No pudimos eliminar la lección." };

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}

/**
 * Mueve una lección a la posición entre `idAnterior` e `idSiguiente`
 * dentro del mismo módulo. Camino feliz: una sola escritura (`orden`
 * fraccionado). Si no queda espacio, reespacía el módulo completo en una
 * sola sentencia SQL transaccional (reespaciar_orden_lecciones,
 * supabase/sql/029_reordenar_modulos_lecciones.sql) — no un UPDATE por fila.
 */
export async function moverLeccion(
  cursoId: string,
  moduloId: string,
  leccionId: string,
  idAnterior: string | null,
  idSiguiente: string | null,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(moduloId).success) return { error: "Módulo inválido." };
  const parseo = moverSchema.safeParse({ elementoId: leccionId, idAnterior, idSiguiente });
  if (!parseo.success) return { error: primerError(parseo) };

  const idsVecinos = [idAnterior, idSiguiente].filter((id): id is string => id !== null);
  const { data: vecinos } = idsVecinos.length
    ? await admin.supabase.from("lecciones").select("id, orden").in("id", idsVecinos)
    : { data: [] };

  const ordenDe = (id: string | null) => (id ? (vecinos ?? []).find((v) => v.id === id)?.orden ?? null : null);
  const nuevoOrden = ordenEntre(ordenDe(idAnterior), ordenDe(idSiguiente));

  if (nuevoOrden !== null) {
    const { error } = await admin.supabase.from("lecciones").update({ orden: nuevoOrden }).eq("id", leccionId);
    if (error) return { error: "No pudimos guardar el nuevo orden de las lecciones." };
  } else {
    const { data: resto } = await admin.supabase
      .from("lecciones")
      .select("id")
      .eq("id_modulo", moduloId)
      .neq("id", leccionId)
      .order("orden");

    const ordenadas = resto ?? [];
    const indiceDestino = idAnterior ? ordenadas.findIndex((l) => l.id === idAnterior) + 1 : 0;
    ordenadas.splice(indiceDestino, 0, { id: leccionId });

    const { error } = await createAdminClient().rpc("reespaciar_orden_lecciones", {
      p_modulo_id: moduloId,
      p_ids: ordenadas.map((leccion) => leccion.id),
    });
    if (error) return { error: "No pudimos guardar el nuevo orden de las lecciones." };
  }

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}

// ------------------------------------------------------------
// Material adicional (recursos_descargables)
// ------------------------------------------------------------

export async function subirRecursoLeccion(
  leccionId: string,
  cursoId: string,
  formData: FormData,
): Promise<AdminActionResult & { recurso?: RecursoDetalle }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(leccionId).success) return { error: "Lección inválida." };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Selecciona un archivo." };
  }

  const resultado = await procesarRecurso(archivo);
  if ("error" in resultado) return { error: resultado.error };
  const { cuerpo, contentType, extension } = resultado.recurso;

  const { data: curso } = await admin.supabase.from("cursos").select("titulo").eq("id", cursoId).single();
  // Sufijo de 8 caracteres del id: el slug del título por sí solo no es
  // único (dos cursos podrían llamarse igual), y esta carpeta es la que
  // reemplaza al uuid crudo que se veía en Storage.
  const carpetaCurso = `${slugificar(curso?.titulo ?? "curso")}-${cursoId.slice(0, 8)}`;

  // La extensión es la que detectó procesarRecurso a partir de los magic
  // bytes, no la del nombre subido por el usuario — evita que un archivo
  // con extensión falsificada termine sirviéndose con un Content-Type que
  // no corresponde a su contenido real.
  const rutaArchivo = `${carpetaCurso}/${leccionId}/${randomUUID()}.${extension}`;

  const { error: errorSubida } = await admin.supabase.storage
    .from(BUCKET_MATERIALES)
    .upload(rutaArchivo, cuerpo, { contentType });

  if (errorSubida) return { error: "No pudimos subir el archivo." };

  const { data, error } = await admin.supabase
    .from("recursos_descargables")
    .insert({
      id_leccion: leccionId,
      nombre: archivo.name,
      tipo_archivo: contentType,
      url_archivo: rutaArchivo,
      tamano_bytes: cuerpo.byteLength,
    })
    .select("id, nombre, tipo_archivo, tamano_bytes")
    .single();

  if (error) {
    await admin.supabase.storage.from(BUCKET_MATERIALES).remove([rutaArchivo]);
    return { error: "No pudimos guardar el material adicional." };
  }

  revalidatePath(`/admin/cursos/${cursoId}`);
  return {
    success: true,
    recurso: {
      id: data.id,
      nombre: data.nombre,
      tipoArchivo: data.tipo_archivo,
      tamanoBytes: data.tamano_bytes,
    },
  };
}

export async function eliminarRecursoLeccion(recursoId: string, cursoId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(recursoId).success) return { error: "Material inválido." };

  const { data: recurso } = await admin.supabase
    .from("recursos_descargables")
    .select("url_archivo")
    .eq("id", recursoId)
    .single();

  const { error } = await admin.supabase.from("recursos_descargables").delete().eq("id", recursoId);
  if (error) return { error: "No pudimos eliminar el material." };

  if (recurso?.url_archivo) {
    await admin.supabase.storage.from(BUCKET_MATERIALES).remove([recurso.url_archivo]);
  }

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}
