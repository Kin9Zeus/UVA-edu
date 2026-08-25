import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";

/**
 * Registro de idempotencia para webhooks entrantes
 * (CLAUDE.md §3.1, functional-spec.md §5.2, technical-spec.md §7).
 *
 * Toda pasarela reintenta: Stripe reenvía un evento hasta 3 días si no
 * recibe 2xx, Wompi y Mux hacen lo propio. Sin este registro, un reintento
 * de `invoice.paid` crea una segunda Suscripción, y uno de `charge.refunded`
 * descuenta dos veces. La tabla `eventos_webhook` tiene `id_evento_externo`
 * UNIQUE justamente para que la base sea el árbitro y no la memoria del
 * proceso.
 *
 * Se usa Service Role Key: `eventos_webhook` tiene RLS activo y ninguna
 * política (ver supabase/sql/001_rls_policies.sql:44 y la nota al final de
 * 003), así que es inalcanzable para anon/authenticated por diseño — solo el
 * backend escribe ahí.
 */

export type ResultadoRegistro =
  /** Primera vez que se ve este evento: hay que procesarlo. */
  | { estado: "nuevo" }
  /** Ya se procesó por completo: responder 200 sin volver a ejecutar nada. */
  | { estado: "duplicado" }
  /** Se registró antes pero no se completó (fallo a mitad): reintentar. */
  | { estado: "reintento" }
  /** No se pudo decidir. Nunca se procesa el evento en este caso. */
  | { estado: "error"; mensaje: string };

/**
 * Deja constancia del evento antes de ejecutar lógica de negocio, y dice si
 * corresponde ejecutarla.
 *
 * Ante la duda devuelve `error` y el handler responde 500 sin procesar: es
 * preferible que la pasarela reintente a arriesgar un cobro doble.
 */
export async function registrarEvento(params: {
  proveedor: "stripe" | "wompi" | "mux";
  idEventoExterno: string;
  tipoEvento: string;
  payload: unknown;
}): Promise<ResultadoRegistro> {
  const admin = createAdminClient();

  const { data: existente, error: errorLectura } = await admin
    .from("eventos_webhook")
    .select("id, procesado")
    .eq("id_evento_externo", params.idEventoExterno)
    .maybeSingle();

  if (errorLectura) {
    return { estado: "error", mensaje: errorLectura.message };
  }

  if (existente) {
    return existente.procesado ? { estado: "duplicado" } : { estado: "reintento" };
  }

  const { error: errorInsercion } = await admin.from("eventos_webhook").insert({
    proveedor: params.proveedor,
    id_evento_externo: params.idEventoExterno,
    tipo_evento: params.tipoEvento,
    payload: params.payload as never,
    procesado: false,
  });

  if (errorInsercion) {
    // 23505 = unique_violation: otra entrega del MISMO evento ganó la carrera
    // entre el select de arriba y este insert. La otra ejecución lo está
    // procesando ahora mismo, así que esta se retira sin hacer nada.
    if (errorInsercion.code === "23505") {
      return { estado: "duplicado" };
    }
    return { estado: "error", mensaje: errorInsercion.message };
  }

  return { estado: "nuevo" };
}

/**
 * Marca el evento como procesado. Se llama DESPUÉS de que la lógica de
 * negocio terminó bien: si se llamara antes, un fallo a mitad dejaría el
 * evento marcado y la pasarela no volvería a intentarlo nunca.
 */
export async function marcarProcesado(idEventoExterno: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("eventos_webhook")
    .update({ procesado: true })
    .eq("id_evento_externo", idEventoExterno);

  if (error) {
    // No se aborta: el negocio ya se ejecutó. Queda como no procesado, así que
    // un reintento de la pasarela volverá a entrar — por eso la lógica de
    // negocio de cada handler debe ser idempotente por su cuenta también.
    logError("webhooks", "no se pudo marcar procesado", error, { idEventoExterno, area: "webhook" });
  }
}
