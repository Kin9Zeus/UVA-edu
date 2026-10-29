import { formatMoneda } from "@/lib/admin/format";
import type { AccesoListado, UsuarioListado } from "@/lib/admin/usuarios";

/**
 * Cómo se dice el acceso de una persona en Usuarios (tabla y ficha). Puro y
 * sin servidor: lo usan componentes de cliente. `ahora` llega del servidor
 * para que el "en 4 días" no cambie entre el render del servidor y el del
 * navegador.
 */

const formatoDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" });

/** Días de calendario (hora de Colombia) de `desde` a `hasta`; negativo si `hasta` ya pasó. */
export function diasCalendario(desde: string | Date, hasta: string | Date): number {
  const dia = (instante: string | Date) => new Date(`${formatoDia.format(new Date(instante))}T12:00:00Z`).getTime();
  return Math.round((dia(hasta) - dia(desde)) / 86_400_000);
}

export function enDias(n: number): string {
  if (n <= 0) return "hoy";
  if (n === 1) return "mañana";
  return `en ${n} días`;
}

export function haceDias(n: number): string {
  if (n <= 0) return "hoy";
  if (n === 1) return "ayer";
  return `hace ${n} días`;
}

const PASARELA: Record<string, string> = { stripe: "Stripe", wompi: "Wompi" };
export const nombrePasarela = (proveedor: string) => PASARELA[proveedor] ?? proveedor;

/** Tope de "Dar más días": un año por vez, como el código más largo. */
export const MAXIMO_DIAS_EXTRA = 365;

/** Desde cuántos días antes se avisa en amarillo que el acceso se acaba. */
export const DIAS_AVISO_ACCESO = 7;
/** Cuántos días sin estudiar, teniendo acceso, cuentan como "dejó de estudiar" (igual que el SQL 127). */
export const DIAS_SIN_ESTUDIAR = 14;

export type TonoAcceso = "success" | "warning" | "error" | "neutral" | "accent";

export type TextoAcceso = {
  etiqueta: string;
  tono: TonoAcceso;
  /** Líneas de detalle debajo de la etiqueta. */
  lineas: { texto: string; alerta?: boolean }[];
};

/** De dónde salió el acceso, en pasado: para un acceso que ya terminó. */
export function deDondeEra(acceso: AccesoListado): string {
  if (acceso.origen === "PAGO") return `Pagó el plan ${acceso.plan ?? ""}`.trim();
  if (acceso.origen === "MANUAL") return "Se lo dio U.V.A.";
  return "Entró por invitación";
}

export function diasDeAcceso(acceso: AccesoListado): number | null {
  return acceso.fin ? Math.max(1, diasCalendario(acceso.inicio, acceso.fin)) : null;
}

export function textoAcceso(
  acceso: AccesoListado | null,
  rol: UsuarioListado["rol"],
  ahora: string,
  conCobro: boolean,
): TextoAcceso {
  // Un administrador ve todo el catálogo sin suscripción (obtenerAccesoAlCurso):
  // la fila que tenga, si tiene, no decide nada.
  if (rol === "ADMINISTRADOR") return { etiqueta: "Permanente", tono: "accent", lineas: [{ texto: "Es administrador" }] };
  if (!acceso) {
    return { etiqueta: "Nunca tuvo", tono: "neutral", lineas: [{ texto: conCobro ? "Nunca canjeó un código ni pagó" : "Nunca canjeó un código" }] };
  }

  const falta = acceso.fin ? diasCalendario(ahora, acceso.fin) : null;
  const pasarela = nombrePasarela(acceso.proveedor);

  if (acceso.estado === "PAST_DUE") {
    return { etiqueta: "Pago pendiente", tono: "warning", lineas: [{ texto: `${pasarela} no pudo cobrar la renovación`, alerta: true }] };
  }
  if (acceso.estado === "VENCIDA") {
    return {
      etiqueta: "Vencido",
      tono: "neutral",
      lineas: [{ texto: deDondeEra(acceso) }, ...(falta !== null ? [{ texto: `Se le acabó ${haceDias(-falta)}` }] : [])],
    };
  }
  if (acceso.estado === "CANCELADA") {
    return acceso.origen === "PAGO"
      ? { etiqueta: "Cancelado", tono: "neutral", lineas: [{ texto: deDondeEra(acceso) }, { texto: "Se canceló en la pasarela" }] }
      : { etiqueta: "Revocado", tono: "error", lineas: [{ texto: deDondeEra(acceso) }, { texto: "Se lo quitó un administrador" }] };
  }

  const fin =
    falta === null
      ? { texto: "Sin fecha de fin" }
      : {
          texto: acceso.origen === "PAGO" && acceso.proveedor === "stripe" ? `Se renueva sola ${enDias(falta)}` : `Se le acaba ${enDias(falta)}`,
          alerta: acceso.proveedor !== "stripe" && falta <= DIAS_AVISO_ACCESO,
        };

  if (acceso.origen === "PAGO") {
    const monto =
      acceso.montoCentavos !== null && acceso.moneda ? `${formatMoneda(acceso.montoCentavos, acceso.moneda)} con ${pasarela}` : `Con ${pasarela}`;
    return { etiqueta: `Paga · ${acceso.plan ?? "plan"}`, tono: "success", lineas: [fin, { texto: monto }] };
  }
  const dias = diasDeAcceso(acceso);
  return {
    etiqueta: acceso.origen === "MANUAL" ? "Dado por U.V.A." : "Por invitación",
    tono: "success",
    lineas: [fin, ...(dias ? [{ texto: `${dias} días gratis` }] : [])],
  };
}

/** Tiene acceso y lleva 14 días o más sin ver una clase (o nunca vio una): mismo criterio que el filtro PARADOS. */
export function dejoDeEstudiar(acceso: AccesoListado | null, ultimaActividad: string | null, ahora: string): boolean {
  if (!acceso || (acceso.estado !== "ACTIVA" && acceso.estado !== "PAST_DUE")) return false;
  return ultimaActividad === null || diasCalendario(ultimaActividad, ahora) >= DIAS_SIN_ESTUDIAR;
}

export function textoEstudio(ultimaActividad: string | null, ahora: string): string {
  if (!ultimaActividad) return "Nunca ha estudiado";
  const dias = diasCalendario(ultimaActividad, ahora);
  if (dias <= 0) return "Estudió hoy";
  if (dias === 1) return "Estudió ayer";
  return `Estudió hace ${dias} días`;
}
