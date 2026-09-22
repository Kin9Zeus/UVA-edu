"use server";

import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/perfil";
import { logError } from "@/lib/log";
import { aNotaLeccion, type NotaLeccion } from "@/lib/notas";
import {
  contenidoNotaSchema,
  idSchema,
  MAX_NOTAS_POR_LECCION,
  segundoNotaSchema,
} from "@/lib/notas-validacion";

export type CrearNotaResultado = { error: string } | { success: true; nota: NotaLeccion };

/**
 * Crea una nota privada en `segundo` de la lección (docs/notas-leccion.md).
 *
 * `id_usuario` sale de la sesión, nunca del cliente. El acceso a la clase
 * (vigente o introductoria), la cuenta activa y el correo verificado los
 * decide la policy `notas_leccion_insert_propio` (115); el tope de notas y
 * `id_video_mux` los fija el trigger de la misma migración. Acá solo se
 * valida la forma de la entrada y se traducen esos rechazos a mensajes
 * legibles.
 *
 * Sin `revalidatePath`: las notas son privadas y no forman parte del HTML
 * cacheado de la clase; el cliente agrega la nota que esto devuelve.
 */
export async function crearNota(
  leccionId: string,
  segundo: number,
  contenido: string,
): Promise<CrearNotaResultado> {
  const user = await getUsuarioActual();
  if (!user) return { error: "Debes iniciar sesión para guardar notas." };

  const leccion = idSchema.safeParse(leccionId);
  const tiempo = segundoNotaSchema.safeParse(segundo);
  const texto = contenidoNotaSchema.safeParse(contenido);
  if (!leccion.success) return { error: "Clase inválida." };
  if (!tiempo.success) return { error: tiempo.error.issues[0]?.message ?? "Minuto inválido." };
  if (!texto.success) return { error: texto.error.issues[0]?.message ?? "Nota inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notas_leccion")
    .insert({
      id_usuario: user.id,
      id_leccion: leccion.data,
      segundo: tiempo.data,
      contenido: texto.data,
    })
    .select("id, id_leccion, segundo, contenido, id_video_mux, actualizado_en")
    .single();

  if (error || !data) {
    if (error?.code === "P0N01") {
      return { error: `Llegaste al máximo de ${MAX_NOTAS_POR_LECCION} notas en esta clase.` };
    }
    // 42501: la policy de INSERT la rechazó (sin acceso vigente, cuenta
    // suspendida o correo sin verificar). No es un fallo del sistema.
    if (error?.code === "42501") {
      return { error: "No tienes acceso para guardar notas en esta clase." };
    }
    // Nunca el contenido de la nota en el log: es dato personal.
    logError("notas:crear", "no se pudo crear la nota", error, { area: "notas", leccionId });
    return { error: "No pudimos guardar tu nota. Intenta de nuevo." };
  }

  // Recién creada: su video de referencia ES el vigente.
  return { success: true, nota: aNotaLeccion(data, data.id_video_mux) };
}
