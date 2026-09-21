"use server";

import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { getUsuarioActual } from "@/lib/perfil";

export type ExportarDatosResultado =
  | { error: string }
  | { success: true; nombreArchivo: string; datos: string };

/**
 * Autoservicio de acceso a datos personales (P2-11, AUDIT-2026-09-15.md,
 * junto a eliminarMiCuenta en este mismo directorio). Ley 1581 art. 8 da
 * derecho a "acceder de forma gratuita a tus datos personales" — hoy solo se
 * podía pedir por correo a soporte.
 *
 * Con el cliente de SESIÓN, nunca con service role: lo que hace seguro este
 * export es que RLS acota cada tabla a `auth.uid() = id_usuario` por su
 * cuenta (mismas policies que ya usa cada pantalla del dashboard para leer
 * lo propio) — no hay una lista de tablas que mantener sincronizada con RLS
 * a mano, ni riesgo de que este endpoint devuelva la fila de otra persona
 * por un `.eq()` mal puesto.
 *
 * Vuelve JSON (no CSV/PDF): es la única forma que preserva la estructura
 * anidada (p. ej. los pagos DENTRO de la suscripción) sin inventar un
 * formato tabular para cada tabla. La descarga la dispara el cliente con un
 * Blob — este action no sube nada a Storage ni lo manda por correo, para no
 * dejar una copia adicional del dato en otro sitio de la que también haya
 * que rendir cuentas.
 */
export async function exportarMisDatos(): Promise<ExportarDatosResultado> {
  const supabase = await createClient();
  const user = await getUsuarioActual();

  if (!user) {
    return { error: "Debes iniciar sesión." };
  }

  const [
    { data: perfil },
    { data: suscripciones },
    { data: inscripciones },
    { data: progreso },
    { data: certificados },
    { data: intentosExamen },
    { data: comentarios },
    { data: comunidadPosts },
    { data: comunidadRespuestas },
    { data: calificaciones },
    { data: notificaciones },
  ] = await Promise.all([
    supabase
      .from("perfiles")
      .select("nombre, correo, celular, pais, especialidad, rol, creado_en")
      .eq("id", user.id)
      .single(),
    supabase
      .from("suscripciones")
      .select(
        "fecha_inicio, fecha_renovacion, estado, acceso_manual, plan:planes(nombre), pagos(fecha_pago, creado_en, monto_centavos, moneda, estado, proveedor)",
      )
      .eq("id_usuario", user.id),
    supabase
      .from("inscripciones")
      .select("creado_en, activo, curso:cursos(titulo)")
      .eq("id_usuario", user.id),
    supabase
      .from("progreso")
      .select(
        "completado, segundo_actual, actualizado_en, leccion:lecciones(titulo, modulo:modulos(titulo, curso:cursos(titulo)))",
      )
      .eq("id_usuario", user.id),
    supabase
      .from("certificados")
      .select("nombre_curso, fecha_emision, codigo_verificacion")
      .eq("id_usuario", user.id),
    supabase
      .from("intentos_examen")
      .select("respuestas, nota_requerida, iniciado_en, finalizado_en")
      .eq("id_usuario", user.id),
    supabase
      .from("comentarios")
      .select("contenido, creado_en, leccion:lecciones(titulo)")
      .eq("id_usuario", user.id)
      .eq("eliminado", false),
    supabase
      .from("comunidad_posts")
      .select("titulo, contenido, categoria, creado_en")
      .eq("id_usuario", user.id)
      .eq("eliminado", false),
    supabase
      .from("comunidad_respuestas")
      .select("contenido, creado_en, post:comunidad_posts(titulo)")
      .eq("id_usuario", user.id)
      .eq("eliminado", false),
    supabase
      .from("curso_calificaciones")
      .select("puntuacion, comentario, creado_en, curso:cursos(titulo)")
      .eq("id_usuario", user.id)
      .eq("eliminado", false),
    supabase
      .from("notificaciones")
      .select("tipo, leida, creado_en")
      .eq("id_usuario", user.id),
  ]);

  if (!perfil) {
    logError("exportarMisDatos", "No se encontró el perfil de la sesión actual", undefined, {
      area: "cuenta",
    });
    return { error: "No pudimos armar tu exportación. Intenta de nuevo." };
  }

  const datos = {
    exportado_en: new Date().toISOString(),
    perfil,
    suscripciones: suscripciones ?? [],
    inscripciones: inscripciones ?? [],
    progreso: progreso ?? [],
    certificados: certificados ?? [],
    intentos_examen: intentosExamen ?? [],
    comentarios: comentarios ?? [],
    comunidad_posts: comunidadPosts ?? [],
    comunidad_respuestas: comunidadRespuestas ?? [],
    calificaciones_de_curso: calificaciones ?? [],
    notificaciones: notificaciones ?? [],
  };

  return {
    success: true,
    nombreArchivo: `uva-mis-datos-${new Date().toISOString().slice(0, 10)}.json`,
    datos: JSON.stringify(datos, null, 2),
  };
}
