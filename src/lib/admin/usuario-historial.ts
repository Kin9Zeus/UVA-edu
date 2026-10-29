import { diaEnColombia, sumarDias } from "@/lib/admin/bitacora";
import { lunesDe, semanasRecientes } from "@/lib/admin/semanas";
import { formatMoneda } from "@/lib/admin/format";
import { nombrePasarela } from "@/lib/admin/acceso-texto";
import type { SemanaGrafica } from "@/lib/admin/grafica";

/** Una fila de `suscripciones` de la persona, con lo que el historial necesita. */
export type AccesoDeLaFicha = {
  id: string;
  estado: "ACTIVA" | "PAST_DUE" | "VENCIDA" | "CANCELADA";
  proveedor: string;
  inicio: string;
  fin: string | null;
  plan: string | null;
  codigo: string | null;
  /** El código venía de un lote (uno por persona): no se muestra el código. */
  deLote: boolean;
  motivoCancelacion: string | null;
  /** Cuándo se tocó la fila por última vez: para una revocación, cuándo se revocó. */
  actualizadoEn: string;
};

export type PagoDeLaFicha = {
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  montoCentavos: number;
  moneda: string;
  plan: string;
  cupon: string | null;
  fecha: string;
};

export type EventoHistorial = {
  fecha: string;
  titulo: string;
  detalle: string;
  /** Solo los pagos llevan resultado. */
  resultado?: "Aprobado" | "Rechazado";
};

const dias = (a: AccesoDeLaFicha) =>
  a.fin ? Math.max(1, Math.round((new Date(a.fin).getTime() - new Date(a.inicio).getTime()) / 86_400_000)) : null;

/**
 * Línea de tiempo de accesos y pagos, de lo más reciente a lo más viejo.
 * Los pagos de Wompi salen de `intentos_pago` (aprobados y rechazados); los
 * de Stripe, de su suscripción, porque Stripe no pasa por esa tabla. Un
 * checkout abandonado (PENDIENTE) no se cuenta: no es algo que la persona hizo.
 */
export function construirHistorial(accesos: AccesoDeLaFicha[], pagos: PagoDeLaFicha[], ahora: Date = new Date()): EventoHistorial[] {
  const eventos: EventoHistorial[] = [];

  for (const a of accesos) {
    const n = dias(a);
    const gratis = n ? `${n} días gratis` : "Sin fecha de fin";
    if (a.proveedor === "invitacion") {
      eventos.push({
        fecha: a.inicio,
        titulo: a.deLote || !a.codigo ? "Entró con un código de lote" : `Entró con el código ${a.codigo}`,
        detalle: gratis,
      });
    } else if (a.proveedor === "manual") {
      eventos.push({ fecha: a.inicio, titulo: "Un administrador le dio acceso", detalle: a.plan ? `Plan ${a.plan}, ${gratis}` : gratis });
    } else if (a.proveedor === "stripe") {
      eventos.push({ fecha: a.inicio, titulo: `Se suscribió al plan ${a.plan ?? ""}`.trim(), detalle: "Con Stripe" });
    }

    if (a.estado === "CANCELADA") {
      eventos.push(
        a.proveedor === "manual" || a.proveedor === "invitacion"
          ? { fecha: a.actualizadoEn, titulo: "Un administrador le quitó el acceso", detalle: a.motivoCancelacion ?? "Sin motivo escrito" }
          : { fecha: a.actualizadoEn, titulo: "Canceló su plan", detalle: `En ${nombrePasarela(a.proveedor)}` },
      );
    } else if (a.fin && new Date(a.fin) <= ahora) {
      eventos.push({
        fecha: a.fin,
        titulo: a.proveedor === "invitacion" ? "Se le acabó la invitación" : a.proveedor === "manual" ? "Se le acabó el acceso" : `Se le acabó el plan ${a.plan ?? ""}`.trim(),
        detalle: a.proveedor === "invitacion" || a.proveedor === "manual" ? `Tuvo ${gratis}` : "No lo renovó",
      });
    }
  }

  for (const p of pagos) {
    if (p.estado === "PENDIENTE") continue;
    const monto = `${formatMoneda(p.montoCentavos, p.moneda)} con Wompi${p.cupon ? `, con el cupón ${p.cupon}` : ""}`;
    eventos.push(
      p.estado === "APROBADO"
        ? { fecha: p.fecha, titulo: `Pagó el plan ${p.plan}`, detalle: monto, resultado: "Aprobado" }
        : { fecha: p.fecha, titulo: `Intentó pagar el plan ${p.plan}`, detalle: "Wompi rechazó el pago", resultado: "Rechazado" },
    );
  }

  return eventos.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Lo que ha pagado en total, por moneda: "$99.800" o "$99.800 y US$119". */
export function totalPagado(pagos: PagoDeLaFicha[]): string | null {
  const porMoneda = new Map<string, number>();
  for (const p of pagos) {
    if (p.estado === "APROBADO") porMoneda.set(p.moneda, (porMoneda.get(p.moneda) ?? 0) + p.montoCentavos);
  }
  if (porMoneda.size === 0) return null;
  return [...porMoneda].map(([moneda, centavos]) => formatMoneda(centavos, moneda)).join(" y ");
}

export type EstudioDeLaPersona = {
  /** Días que estudió en cada una de las últimas 12 semanas (0 a 7). */
  semanas: SemanaGrafica[];
  dias30: number;
  /** Días seguidos que termina hoy o ayer; 0 si no estudió ninguno de los dos. */
  racha: number;
};

/** Agrupa los días de `actividad_diaria` ("YYYY-MM-DD", hora de Colombia) por semana. */
export function resumirDiasEstudio(fechas: string[], ahora: Date = new Date()): EstudioDeLaPersona {
  const { semanas, primerLunes } = semanasRecientes(ahora);
  const indice = new Map(semanas.map((s, i) => [s.inicio, i]));
  const hoy = diaEnColombia(ahora);
  const desde30 = sumarDias(hoy, -29);
  const conjunto = new Set(fechas);

  for (const dia of conjunto) {
    if (dia < primerLunes) continue;
    const semana = semanas[indice.get(lunesDe(dia)) ?? -1];
    if (!semana) continue;
    semana.total += 1;
    semana.porSerie.dias = semana.total;
  }

  let racha = 0;
  let dia = conjunto.has(hoy) ? hoy : sumarDias(hoy, -1);
  while (conjunto.has(dia)) {
    racha += 1;
    dia = sumarDias(dia, -1);
  }

  return { semanas, dias30: [...conjunto].filter((d) => d >= desde30 && d <= hoy).length, racha };
}
