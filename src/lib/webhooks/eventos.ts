import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";
import type { ProveedorWebhook } from "@/lib/pagos/proveedores";

/**
 * Registro de idempotencia para webhooks entrantes
 * (CLAUDE.md §3.1, functional-spec.md §5.2, technical-spec.md §7).
 *
 * Toda pasarela reintenta: Stripe reenvía un evento hasta 3 días si no
 * recibe 2xx, Wompi y Mux hacen lo propio. Sin este registro, un reintento
 * de `invoice.paid` crea una segunda Suscripción, y uno de `charge.refunded`
 * descuenta dos veces. La tabla `eventos_webhook` tiene UNIQUE sobre
 * (proveedor, id_evento_externo) justamente para que la base sea el árbitro y
 * no la memoria del proceso. La clave se compone con el proveedor porque bajo
 * un único índice global conviven identificadores de formatos distintos —
 * `evt_...` de Stripe, un UUID de Mux y un checksum SHA-256 de Wompi.
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
  // La unión venía escrita a mano aquí. Ahora sale de la misma constante que
  // el CHECK de eventos_webhook (supabase/sql/042), con un test que falla si
  // las dos se separan.
  proveedor: ProveedorWebhook;
  idEventoExterno: string;
  tipoEvento: string;
  payload: unknown;
}): Promise<ResultadoRegistro> {
  const admin = createAdminClient();

  // Se filtra TAMBIÉN por proveedor: la clave de idempotencia es
  // (proveedor, id_evento_externo) desde 042, no el id a secas. Buscando solo
  // por el id, una colisión entre pasarelas devolvería el evento ajeno y este
  // se descartaría como "duplicado" sin procesarse jamás.
  const { data: existente, error: errorLectura } = await admin
    .from("eventos_webhook")
    .select("id, procesado")
    .eq("proveedor", params.proveedor)
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
export async function marcarProcesado(
  proveedor: ProveedorWebhook,
  idEventoExterno: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("eventos_webhook")
    .update({ procesado: true })
    .eq("proveedor", proveedor)
    .eq("id_evento_externo", idEventoExterno);

  if (error) {
    // No se aborta: el negocio ya se ejecutó. Queda como no procesado, así que
    // un reintento de la pasarela volverá a entrar — por eso la lógica de
    // negocio de cada handler debe ser idempotente por su cuenta también.
    logError("webhooks", "no se pudo marcar procesado", error, {
      proveedor,
      idEventoExterno,
      area: "webhook",
    });
  }
}
