"use server";

/**
 * Opción "Lote de códigos": genera N códigos de invitación individuales
 * (uso único cada uno) en una sola operación — alternativa a "código único
 * con cupo de N usos" (src/actions/admin/codigosInvitacion.ts).
 *
 * rev.md deja pendiente cuál de las dos formas de distribución se usará en
 * producción, así que este archivo es intencionalmente independiente del
 * otro modo: comparte solo lo que de verdad es la misma regla de negocio en
 * cualquier escenario (validación de duración y vencimiento, en
 * src/lib/codigoInvitacion.ts) y la generación de un código individual
 * (generarCodigoInvitacion). Si se descarta este modo, se borra este
 * archivo, src/lib/admin/lotesCodigosInvitacion.ts y su pestaña en
 * CodigosPage — el modo de código único queda intacto.
 */

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import {
  generarCodigoInvitacion,
  validarDuracionDias,
  validarFechaVencimiento,
} from "@/lib/codigoInvitacion";
import type { AdminActionResult } from "@/actions/admin/categorias";

/** Mínimo para que un lote tenga sentido: para 1 código, está "código único" con límite 1. */
const MIN_LOTE = 2;

/**
 * Tope de códigos por lote. No es un límite técnico (el insert es una sola
 * sentencia SQL vía unnest, cabe un lote mucho mayor): es un freno a pedir
 * por accidente un lote de 100.000 códigos que nadie va a repartir, y que
 * de fallar a mitad de generación en memoria tarda en reintentarse.
 */
const MAX_LOTE = 500;

/** Intentos de generar un lote de códigos libres antes de rendirse. */
const INTENTOS_LOTE = 5;

function validarCantidad(cantidad: number): string | null {
  if (!Number.isInteger(cantidad) || cantidad < MIN_LOTE) {
    return `La cantidad debe ser un número entero de al menos ${MIN_LOTE}.`;
  }
  if (cantidad > MAX_LOTE) {
    return `Un lote no puede tener más de ${MAX_LOTE} códigos.`;
  }
  return null;
}

/**
 * Genera `cantidad` códigos distintos entre sí. Con 31^8 combinaciones
 * posibles, una colisión interna en un lote de a lo sumo 500 es
 * prácticamente imposible, pero el `Set` la descarta sin esfuerzo si
 * ocurriera — la unicidad CONTRA la base (códigos ya existentes) la
 * garantiza el índice único y el reintento de todo el lote en
 * `crearLoteCodigosInvitacion`.
 */
function generarCodigosUnicosEnMemoria(cantidad: number): string[] {
  const codigos = new Set<string>();
  while (codigos.size < cantidad) {
    codigos.add(generarCodigoInvitacion());
  }
  return [...codigos];
}

/**
 * Crea un lote de `cantidad` códigos de invitación individuales, cada uno de
 * un solo uso, en una única transacción (RPC `crear_lote_codigos_invitacion`,
 * supabase/sql/045): si el insert falla a mitad de camino, no queda ni el
 * lote ni ningún código suelto.
 */
export async function crearLoteCodigosInvitacion(input: {
  cantidad: number;
  duracionDias: number;
  fechaVencimiento: string;
}): Promise<AdminActionResult & { loteId?: string; codigos?: string[] }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const cantidadInvalida = validarCantidad(input.cantidad);
  if (cantidadInvalida) return { error: cantidadInvalida };

  const duracionInvalida = validarDuracionDias(input.duracionDias);
  if (duracionInvalida) return { error: duracionInvalida };

  const fechaInvalida = validarFechaVencimiento(input.fechaVencimiento);
  if (fechaInvalida) return { error: fechaInvalida };

  const fechaVencimientoIso = new Date(input.fechaVencimiento).toISOString();

  for (let intento = 0; intento < INTENTOS_LOTE; intento += 1) {
    const codigos = generarCodigosUnicosEnMemoria(input.cantidad);

    const { data: loteId, error } = await admin.supabase.rpc("crear_lote_codigos_invitacion", {
      p_codigos: codigos,
      p_duracion_dias: input.duracionDias,
      p_fecha_vencimiento: fechaVencimientoIso,
    });

    if (!error) {
      await registrarBitacora(admin.supabase, {
        idAdmin: admin.adminId,
        accion: "Generó un lote de códigos de invitación",
        entidadAfectada: "lotes_codigos_invitacion",
        idEntidadAfectada: loteId as string,
        detalles: `${input.cantidad} código(s) — ${input.duracionDias} día(s) de acceso`,
      });

      revalidatePath("/admin/codigos");
      return { success: true, loteId: loteId as string, codigos };
    }

    // 23505 = unique_violation: algún código del lote chocó con uno ya
    // existente. La transacción del RPC ya revirtió todo (ver 045); se
    // reintenta el lote completo con códigos nuevos.
    if (error.code !== "23505") return { error: "No pudimos generar el lote de códigos." };
  }

  return { error: "No pudimos generar un lote de códigos libres. Intenta de nuevo." };
}
