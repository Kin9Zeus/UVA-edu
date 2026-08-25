"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { IMAGEN_PORTADA_PLACEHOLDER } from "@/lib/media";
import type { AdminActionResult } from "@/actions/admin/categorias";
import type { RecursoDetalle } from "@/lib/admin/cursoDetalle";
import { ESPACIO_ORDEN, ordenEntre, siguienteOrden } from "@/lib/orden";

const BUCKET_MATERIALES = "materiales-lecciones";
const BUCKET_PORTADAS = "portadas-cursos";
// Igual al máximo que acepta Supabase Storage por archivo (plan actual).
const TAMANO_MAXIMO_RECURSO = 50 * 1024 * 1024;
const TAMANO_MAXIMO_PORTADA = 5 * 1024 * 1024;

/**
 * Nombre de carpeta legible para Storage (solo eso: no es un identificador
 * único por sí solo, `subirRecursoLeccion` siempre le agrega un sufijo del
 * id del curso al lado).
 */
function slugificar(texto: string) {
  return (
    texto
      .normalize("NFD")
      // Rango Unicode U+0300–U+036F (diacríticos combinantes que deja
      // "NFD" al separar tildes/eñes de su letra base).
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "curso"
  );
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

export async function crearCurso(input: {
  titulo: string;
  descripcion: string;
  categoriaId: string;
  nivel: NivelCurso;
  idInstructor: string;
  publicar: boolean;
}): Promise<AdminActionResult & { id?: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const titulo = input.titulo.trim();
  if (!titulo) return { error: "El nombre del curso es obligatorio." };
  if (!input.categoriaId) return { error: "Selecciona una categoría." };
  if (!input.idInstructor) return { error: "Selecciona un instructor." };

  const { data, error } = await admin.supabase
    .from("cursos")
    .insert({
      titulo,
      descripcion: input.descripcion.trim(),
      imagen_portada: IMAGEN_PORTADA_PLACEHOLDER,
      nivel: input.nivel,
      id_instructor: input.idInstructor,
      mostrado: input.publicar,
      id_admin_creador: admin.adminId,
    })
    .select("id")
    .single();

  if (error) return { error: "No pudimos crear el curso." };

  const { error: errorCategoria } = await admin.supabase
    .from("curso_categorias")
    .insert({ id_curso: data.id, id_categoria: input.categoriaId });

  if (errorCategoria) {
    await admin.supabase.from("cursos").delete().eq("id", data.id);
    return { error: "No pudimos asignar la categoría." };
  }

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: input.publicar ? "Creó y publicó un curso" : "Creó un curso en borrador",
    entidadAfectada: "cursos",
    idEntidadAfectada: data.id,
    detalles: titulo,
  });

  revalidatePath("/admin/cursos");
  return { success: true, id: data.id };
}

export async function actualizarInfoCurso(
  cursoId: string,
  input: { titulo: string; descripcion: string; categoriaId: string; nivel: NivelCurso },
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const titulo = input.titulo.trim();
  if (!titulo) return { error: "El nombre del curso es obligatorio." };

  const { error } = await admin.supabase
    .from("cursos")
    .update({
      titulo,
      descripcion: input.descripcion.trim(),
      nivel: input.nivel,
    })
    .eq("id", cursoId);

  if (error) return { error: "No pudimos guardar los cambios." };

  // El CMS solo asigna una categoría por curso hoy (sin selector múltiple),
  // así que "cambiar de categoría" es reemplazar la única fila de la puente
  // — ver curso_categorias en la auditoría de esquema (Bloque 3).
  const { error: errorCategoria } = await admin.supabase
    .from("curso_categorias")
    .upsert({ id_curso: cursoId, id_categoria: input.categoriaId }, { onConflict: "id_curso,id_categoria" });

  if (errorCategoria) return { error: "No pudimos guardar la categoría." };

  await admin.supabase
    .from("curso_categorias")
    .delete()
    .eq("id_curso", cursoId)
    .neq("id_categoria", input.categoriaId);

  revalidatePath(`/admin/cursos/${cursoId}`);
  revalidatePath("/admin/cursos");
  return { success: true };
}

export async function actualizarConfiguracionCurso(
  cursoId: string,
  input: { mostrado: boolean; destacado: boolean; ordenVisualizacion: number },
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase
    .from("cursos")
    .update({
      mostrado: input.mostrado,
      destacado: input.destacado,
      orden_visualizacion: input.ordenVisualizacion,
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

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Selecciona una imagen." };
  }
  if (!archivo.type.startsWith("image/")) {
    return { error: "El archivo debe ser una imagen." };
  }
  if (archivo.size > TAMANO_MAXIMO_PORTADA) {
    return { error: "La imagen no puede superar los 5 MB." };
  }

  const { data: curso } = await admin.supabase
    .from("cursos")
    .select("titulo, imagen_portada")
    .eq("id", cursoId)
    .single();

  const carpetaCurso = `${slugificar(curso?.titulo ?? "curso")}-${cursoId.slice(0, 8)}`;
  const extension = archivo.name.includes(".") ? archivo.name.split(".").pop() : "jpg";
  const rutaArchivo = `${carpetaCurso}/${randomUUID()}${extension ? `.${extension}` : ""}`;

  const { error: errorSubida } = await admin.supabase.storage
    .from(BUCKET_PORTADAS)
    .upload(rutaArchivo, archivo, { contentType: archivo.type });

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

  const tituloLimpio = titulo.trim();
  if (!tituloLimpio) return { error: "El nombre del módulo es obligatorio." };

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

  const tituloLimpio = titulo.trim();
  if (!tituloLimpio) return { error: "El nombre del módulo es obligatorio." };

  const { error } = await admin.supabase.from("modulos").update({ titulo: tituloLimpio }).eq("id", moduloId);
  if (error) return { error: "No pudimos renombrar el módulo." };

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}

export async function eliminarModulo(moduloId: string, cursoId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase.from("modulos").delete().eq("id", moduloId);
  if (error) return { error: "No pudimos eliminar el módulo." };

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}

/**
 * Mueve un módulo a la posición entre `idAnterior` e `idSiguiente` (los
 * vecinos ya reordenados en el frontend). Solo escribe la fila movida;
 * si no queda espacio entre los vecinos, reespacía el curso completo
 * de 10 en 10 como fallback. Ver src/lib/orden.ts.
 */
export async function moverModulo(
  cursoId: string,
  moduloId: string,
  idAnterior: string | null,
  idSiguiente: string | null,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

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

    const resultados = await Promise.all(
      ordenados.map((modulo, index) =>
        admin.supabase
          .from("modulos")
          .update({ orden: (index + 1) * ESPACIO_ORDEN })
          .eq("id", modulo.id),
      ),
    );
    if (resultados.some((resultado) => resultado.error)) {
      return { error: "No pudimos guardar el nuevo orden de los módulos." };
    }
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

  const tituloLimpio = titulo.trim();
  if (!tituloLimpio) return { error: "El nombre de la lección es obligatorio." };

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
  input: { titulo: string; duracion: number | null; resumen: string },
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const titulo = input.titulo.trim();
  if (!titulo) return { error: "El nombre de la lección es obligatorio." };

  const { error } = await admin.supabase
    .from("lecciones")
    .update({ titulo, duracion: input.duracion, resumen: input.resumen.trim() || null })
    .eq("id", leccionId);

  if (error) return { error: "No pudimos guardar la lección." };

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}

export async function eliminarLeccion(leccionId: string, cursoId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase.from("lecciones").delete().eq("id", leccionId);
  if (error) return { error: "No pudimos eliminar la lección." };

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}

/**
 * Mueve una lección a la posición entre `idAnterior` e `idSiguiente`
 * dentro del mismo módulo. Solo escribe la fila movida; si no queda
 * espacio entre los vecinos, reespacía el módulo completo de 10 en 10
 * como fallback. Ver src/lib/orden.ts.
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

    const resultados = await Promise.all(
      ordenadas.map((leccion, index) =>
        admin.supabase
          .from("lecciones")
          .update({ orden: (index + 1) * ESPACIO_ORDEN })
          .eq("id", leccion.id),
      ),
    );
    if (resultados.some((resultado) => resultado.error)) {
      return { error: "No pudimos guardar el nuevo orden de las lecciones." };
    }
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

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Selecciona un archivo." };
  }
  if (archivo.size > TAMANO_MAXIMO_RECURSO) {
    return { error: "El archivo no puede superar los 50 MB." };
  }

  const { data: curso } = await admin.supabase.from("cursos").select("titulo").eq("id", cursoId).single();
  // Sufijo de 8 caracteres del id: el slug del título por sí solo no es
  // único (dos cursos podrían llamarse igual), y esta carpeta es la que
  // reemplaza al uuid crudo que se veía en Storage.
  const carpetaCurso = `${slugificar(curso?.titulo ?? "curso")}-${cursoId.slice(0, 8)}`;

  const extension = archivo.name.includes(".") ? archivo.name.split(".").pop() : null;
  const rutaArchivo = `${carpetaCurso}/${leccionId}/${randomUUID()}${extension ? `.${extension}` : ""}`;

  const { error: errorSubida } = await admin.supabase.storage
    .from(BUCKET_MATERIALES)
    .upload(rutaArchivo, archivo, { contentType: archivo.type || undefined });

  if (errorSubida) return { error: "No pudimos subir el archivo." };

  const { data, error } = await admin.supabase
    .from("recursos_descargables")
    .insert({
      id_leccion: leccionId,
      nombre: archivo.name,
      tipo_archivo: archivo.type || "application/octet-stream",
      url_archivo: rutaArchivo,
      tamano_bytes: archivo.size,
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
