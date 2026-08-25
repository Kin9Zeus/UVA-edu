"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import {
  MINUTOS_VIGENCIA_VALIDOS,
  MINUTOS_VIGENCIA_VISTA_PREVIA,
  VIGENCIAS_VISTA_PREVIA,
  calcularExpiracion,
  generarTokenVistaPrevia,
} from "@/lib/vistaPrevia";
import type { AdminActionResult } from "@/actions/admin/categorias";

/**
 * Crea un enlace temporal para revisar un curso en borrador.
 *
 * Devuelve el token EN CLARO: es la única vez que existe fuera del
 * navegador del administrador. La base guarda solo su SHA-256, así que si
 * se pierde el enlace no se recupera — se genera otro y se revoca el
 * anterior.
 */
export async function crearEnlaceVistaPrevia(
  cursoId: string,
  minutos: number = MINUTOS_VIGENCIA_VISTA_PREVIA,
): Promise<AdminActionResult & { url?: string; expiraEn?: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  // Lista blanca, no un rango: el valor llega del cliente y las únicas
  // vigencias que la interfaz ofrece son las de VIGENCIAS_VISTA_PREVIA.
  // Un rango dejaría pedir "43200 minutos" saltándose el selector.
  if (!MINUTOS_VIGENCIA_VALIDOS.includes(minutos)) {
    return { error: "Vigencia no permitida para un enlace de vista previa." };
  }

  const { data: curso } = await admin.supabase
    .from("cursos")
    .select("titulo")
    .eq("id", cursoId)
    .maybeSingle();

  if (!curso) return { error: "El curso ya no existe." };

  const { token, hash } = generarTokenVistaPrevia();
  const expiraEn = calcularExpiracion(minutos);

  const { error } = await admin.supabase.from("tokens_vista_previa").insert({
    token_hash: hash,
    id_curso: cursoId,
    id_admin_creador: admin.adminId,
    expira_en: expiraEn.toISOString(),
  });

  if (error) return { error: "No pudimos generar el enlace." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Generó un enlace de vista previa",
    entidadAfectada: "cursos",
    idEntidadAfectada: cursoId,
    detalles: `"${curso.titulo}" — vigente ${
      VIGENCIAS_VISTA_PREVIA.find((opcion) => opcion.minutos === minutos)?.etiqueta ?? `${minutos} min`
    }`,
  });

  revalidatePath(`/admin/cursos/${cursoId}`);

  return {
    success: true,
    // Relativa: la arma el cliente con su propio origen, así funciona igual
    // en local, en preview y en producción sin depender de una variable.
    url: `/vista-previa/${token}`,
    expiraEn: expiraEn.toISOString(),
  };
}

/**
 * Revoca un enlace antes de su caducidad.
 *
 * Marca `revocado_en` en vez de borrar la fila: el rastro de qué se
 * compartió, cuándo y por quién se conserva (ver 025_rls_tokens_vista_previa,
 * que a propósito no define policy de DELETE).
 */
export async function revocarEnlaceVistaPrevia(
  tokenId: string,
  cursoId: string,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { error } = await admin.supabase
    .from("tokens_vista_previa")
    .update({ revocado_en: new Date().toISOString() })
    .eq("id", tokenId)
    .is("revocado_en", null);

  if (error) return { error: "No pudimos revocar el enlace." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Revocó un enlace de vista previa",
    entidadAfectada: "cursos",
    idEntidadAfectada: cursoId,
  });

  revalidatePath(`/admin/cursos/${cursoId}`);
  return { success: true };
}
