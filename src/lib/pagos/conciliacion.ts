import { createAdminClient } from "@/lib/supabase/admin";
import { consultarTransaccion, type EstadoTransaccion } from "@/lib/pagos/wompi";
import { normalizarMoneda } from "@/lib/pagos/proveedores";
import { enviarCorreoReciboPago } from "@/lib/resend";
import { formatearPrecio } from "@/lib/planes";
import { formatFecha } from "@/lib/admin/format";
import { siteUrl } from "@/lib/site-url";
import { logError } from "@/lib/log";

/**
 * Qué hacer con un evento de Wompi ya verificado: convertirlo (o no) en acceso.
 *
 * Vive fuera del handler para poder probarse sin montar una petición HTTP, y
 * porque el handler ya tiene bastante con la firma y la idempotencia. El
 * handler decide el código de respuesta; esto decide el efecto.
 *
 * Todo lo que escribe pasa por los RPC de supabase/sql/101, no por INSERTs
 * sueltos: un pago aprobado toca cinco tablas y tiene que ser atómico.
 */

/** La parte del evento que nos interesa. */
export type TransaccionEvento = {
  id: string;
  reference: string;
  status: EstadoTransaccion;
  amount_in_cents: number;
  currency: string;
  finalized_at: string | null;
};

export type ResultadoConciliacion =
  /** Se aplicó el pago (o ya estaba aplicado): el estudiante tiene acceso. */
  | { estado: "aplicado" }
  /** El pago no prosperó. El intento queda cerrado, sin tocar el acceso. */
  | { estado: "rechazado" }
  /** Todavía no hay nada que hacer; llegará otro evento. */
  | { estado: "pendiente" }
  /** No se pudo decidir. El handler debe responder 5xx para que Wompi reintente. */
  | { estado: "error"; mensaje: string };

/**
 * Extrae la transacción del cuerpo del evento, o null si no viene con la forma
 * esperada. No se confía en el tipo declarado: el cuerpo es JSON de la red, y
 * que la firma sea válida solo prueba el ORIGEN, no la estructura.
 */
export function leerTransaccion(data: unknown): TransaccionEvento | null {
  if (typeof data !== "object" || data === null) return null;
  const transaccion = (data as { transaction?: unknown }).transaction;
  if (typeof transaccion !== "object" || transaccion === null) return null;

  const t = transaccion as Record<string, unknown>;
  if (typeof t.id !== "string" || typeof t.reference !== "string") return null;
  if (typeof t.status !== "string" || typeof t.currency !== "string") return null;

  // El monto puede llegar como número o como string según el emisor; lo que
  // no puede es llegar como algo que no sea un entero positivo, porque se
  // compara contra `intentos_pago.monto_centavos`.
  const monto = Number(t.amount_in_cents);
  if (!Number.isInteger(monto) || monto <= 0) return null;

  return {
    id: t.id,
    reference: t.reference,
    status: t.status as EstadoTransaccion,
    amount_in_cents: monto,
    currency: t.currency,
    finalized_at: typeof t.finalized_at === "string" ? t.finalized_at : null,
  };
}

/**
 * Aplica el efecto de una transacción.
 *
 * `verificarContraWompi` permite saltarse la consulta a la API cuando el
 * emisor no es Wompi de verdad — el simulador local de desarrollo
 * (`/api/dev/wompi`), cuyas transacciones no existen del lado de Wompi y
 * devolverían 404. En producción siempre va en true.
 */
export async function conciliarTransaccion(
  transaccion: TransaccionEvento,
  { verificarContraWompi = true }: { verificarContraWompi?: boolean } = {},
): Promise<ResultadoConciliacion> {
  if (transaccion.status === "PENDING") {
    return { estado: "pendiente" };
  }

  const admin = createAdminClient();

  if (transaccion.status !== "APPROVED") {
    // DECLINED / VOIDED / ERROR: se cierra el intento para que la pantalla de
    // retorno pueda decir "el pago no se completó" en vez de girar para
    // siempre en "confirmando". No se toca ninguna suscripción.
    const { data, error } = await admin
      .rpc("rechazar_intento_pago", {
        p_referencia: transaccion.reference,
        p_id_transaccion: transaccion.id,
      })
      .single();

    if (error) {
      return { estado: "error", mensaje: error.message };
    }

    const resultado = data as { ok: boolean; motivo: string | null };
    if (!resultado.ok) {
      // `intento_no_encontrado`: la referencia no es nuestra. No es un fallo
      // que deba hacer reintentar a Wompi — no hay nada que arreglar.
      logError("webhook:wompi", "no se pudo rechazar el intento", null, {
        area: "webhook",
        motivo: resultado.motivo,
        referencia: transaccion.reference,
      });
    }

    return { estado: "rechazado" };
  }

  // ---- APPROVED --------------------------------------------------------
  //
  // Defensa en profundidad: la firma del evento ya se verificó en el handler,
  // pero antes de dar acceso se confirma el estado contra la propia API de
  // Wompi. Cuesta una petición y cierra el hueco de un evento que pasara la
  // firma con un contenido que no corresponde a la transacción real.
  if (verificarContraWompi) {
    const real = await consultarTransaccion(transaccion.id);

    if (!real) {
      // No se pudo confirmar. NO se da acceso, y se devuelve error para que
      // el handler responda 5xx y Wompi reintente — es preferible a activar
      // una suscripción sobre un evento que no se pudo corroborar.
      return { estado: "error", mensaje: "no se pudo consultar la transacción en Wompi" };
    }

    if (real.status !== "APPROVED") {
      logError("webhook:wompi", "el evento dice APPROVED pero la API no", null, {
        area: "webhook",
        idTransaccion: transaccion.id,
        estadoReal: real.status,
      });
      return { estado: "rechazado" };
    }
  }

  const moneda = normalizarMoneda(transaccion.currency);
  if (!moneda) {
    return { estado: "error", mensaje: `moneda inválida: ${transaccion.currency}` };
  }

  // `finalized_at` es la fecha del cobro SEGÚN WOMPI, no la de ahora: Wompi
  // reintenta la entrega del webhook, y sin esta distinción el estudiante
  // vería la fecha del reintento como la fecha de su pago.
  const fechaPago = transaccion.finalized_at ?? new Date().toISOString();

  const { data, error } = await admin
    .rpc("aplicar_pago_wompi", {
      p_referencia: transaccion.reference,
      p_id_transaccion: transaccion.id,
      p_fecha_pago: fechaPago,
      p_monto_centavos: transaccion.amount_in_cents,
      p_moneda: moneda,
    })
    .single();

  if (error) {
    return { estado: "error", mensaje: error.message };
  }

  const resultado = data as { ok: boolean; motivo: string | null };

  if (!resultado.ok) {
    // Estos motivos NO se reintentan: reintentar no los arregla y dejaría el
    // evento sin marcar para siempre. Quedan registrados para soporte.
    logError("webhook:wompi", "el pago no se pudo aplicar", null, {
      area: "webhook",
      motivo: resultado.motivo,
      referencia: transaccion.reference,
      idTransaccion: transaccion.id,
    });
    return { estado: "rechazado" };
  }

  // `ya_aplicado` significa que el recibo salió en la entrega anterior: no se
  // reenvía. El acceso ya estaba dado, y un segundo recibo del mismo cobro
  // haría pensar que se cobró dos veces.
  if (resultado.motivo !== "ya_aplicado") {
    await enviarRecibo(transaccion.reference);
  }

  return { estado: "aplicado" };
}

/**
 * Manda el recibo del pago recién aplicado. Best-effort: el acceso ya está
 * dado y un fallo de Resend no puede revertirlo (docs/Correos.md, misma regla
 * que `canjearCodigoInvitacion`). Por eso no devuelve nada y solo registra.
 *
 * Los datos se leen DESPUÉS de aplicar, con Service Role, porque el correo
 * necesita cosas que el evento no trae: el nombre del estudiante, el nombre
 * del plan y la vigencia que acaba de calcular el RPC.
 */
async function enviarRecibo(referencia: string): Promise<void> {
  // Las pruebas automatizadas (scripts/pagos-e2e-test.ts) corren contra
  // perfiles REALES de la base —incluidos correos de personas— y aprueban
  // pagos de mentira. Sin esta salida, cada corrida le mandaría un recibo a
  // alguien por un cobro que nunca existió.
  if (process.env.PAGOS_SIN_CORREO === "1") return;

  try {
    const admin = createAdminClient();

    // Consultas separadas en vez de un embed con nombre de FK
    // (`perfiles!intentos_pago_id_usuario_fkey`): ese embed compila a un tipo
    // que supabase-js no sabe estrechar y obliga a castear el resultado
    // entero, que es peor que dos viajes más a la base en un camino que ya
    // es asíncrono y no bloquea a nadie.
    const { data: intento } = await admin
      .from("intentos_pago")
      .select("id_usuario, id_plan, monto_centavos, moneda")
      .eq("referencia", referencia)
      .maybeSingle();

    if (!intento) return;

    const [{ data: perfil }, { data: plan }, { data: suscripcion }] = await Promise.all([
      admin.from("perfiles").select("nombre, correo").eq("id", intento.id_usuario).maybeSingle(),
      admin.from("planes").select("nombre").eq("id", intento.id_plan).maybeSingle(),
      // La suscripción que el RPC acaba de crear: de ahí sale la vigencia,
      // que es el dato que el estudiante necesita del recibo.
      admin
        .from("suscripciones")
        .select("fecha_renovacion, pagos(fecha_pago, creado_en)")
        .eq("id_usuario", intento.id_usuario)
        .eq("proveedor", "wompi")
        .order("fecha_inicio", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!perfil?.correo) return;

    const pago = suscripcion?.pagos?.[0];

    const resultado = await enviarCorreoReciboPago(perfil.correo, {
      nombre: perfil.nombre ?? "",
      planNombre: plan?.nombre ?? "Acceso U.V.A",
      montoFormateado: formatearPrecio(Number(intento.monto_centavos), intento.moneda),
      fechaPago: formatFecha(pago?.fecha_pago ?? pago?.creado_en ?? new Date().toISOString()),
      vigenteHasta: suscripcion?.fecha_renovacion
        ? formatFecha(suscripcion.fecha_renovacion)
        : "sin fecha límite",
      referencia,
      urlSuscripcion: `${siteUrl()}/dashboard/suscripcion`,
    });

    if (!resultado.success) {
      logError("webhook:wompi", "no se pudo enviar el recibo", new Error(resultado.error), {
        area: "email",
        referencia,
      });
    }
  } catch (error) {
    // Nunca propaga: el pago ya está aplicado y el handler debe responder 200.
    logError("webhook:wompi", "fallo inesperado enviando el recibo", error, {
      area: "email",
      referencia,
    });
  }
}
