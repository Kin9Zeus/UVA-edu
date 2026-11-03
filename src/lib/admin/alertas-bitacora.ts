import * as Sentry from "@sentry/nextjs";

/**
 * Alertas sobre la bitácora — FASE 7 (datos, tarea 7) del plan de blindaje.
 *
 * La bitácora registra todo, pero nadie la mira a diario. Estas acciones son
 * las que alguien que se metió en una cuenta de administrador haría primero
 * (llevarse los datos, darse permisos, repartir accesos, quitar el 2FA de
 * otro) o las que no tienen vuelta atrás. Cada una manda un aviso a Sentry,
 * donde una regla de alerta lo convierte en correo al equipo:
 *
 *   Sentry → Alerts → Create Alert → Issues
 *   «A new issue is created» + filtro «tag area equals alerta-admin» → correo.
 *
 * Cada aviso es un issue nuevo (huella única), para que la regla dispare
 * siempre y no solo la primera vez que pasa algo de ese tipo.
 *
 * Lo que viaja: la acción, la entidad y los ids. Nunca los `detalles`, que
 * pueden traer nombres o correos de estudiantes.
 */

/** Un lote de códigos de invitación desde este tamaño avisa (el tope es 500). */
export const LOTE_GRANDE_DE_CODIGOS = 100;

const ACCIONES_CON_ALERTA: Readonly<Record<string, string>> = {
  "Exportó la lista de usuarios a CSV": "exportar-datos",
  "Exportó la bitácora a CSV": "exportar-datos",
  "Dio rol de profesor": "cambio-de-rol",
  "Quitó el rol de profesor": "cambio-de-rol",
  "Quitó la verificación en dos pasos de otro administrador": "quitar-2fa",
  "Suprimió los datos personales de una cuenta (Habeas Data)": "irreversible",
};

const ACCION_LOTE_DE_CODIGOS = "Generó un lote de códigos de invitación";

/** Por qué avisa esta acción, o `null` si no avisa. */
export function motivoDeAlerta(accion: string, cantidad?: number): string | null {
  if (accion === ACCION_LOTE_DE_CODIGOS) {
    return cantidad !== undefined && cantidad >= LOTE_GRANDE_DE_CODIGOS ? "lote-grande-de-codigos" : null;
  }
  return ACCIONES_CON_ALERTA[accion] ?? null;
}

export function avisarAccionSensible(params: {
  idAdmin: string;
  accion: string;
  entidadAfectada: string;
  idEntidadAfectada?: string;
  cantidad?: number;
}): void {
  const motivo = motivoDeAlerta(params.accion, params.cantidad);
  if (!motivo) return;

  const datos = {
    idAdmin: params.idAdmin,
    entidadAfectada: params.entidadAfectada,
    idEntidadAfectada: params.idEntidadAfectada ?? null,
    ...(params.cantidad !== undefined ? { cantidad: params.cantidad } : {}),
  };

  Sentry.captureMessage(`Alerta de administración: ${params.accion}`, {
    level: "warning",
    tags: { area: "alerta-admin", motivo },
    extra: datos,
    fingerprint: ["alerta-admin", params.accion, crypto.randomUUID()],
  });
  console.warn(JSON.stringify({ nivel: "warning", alerta: "alerta-admin", motivo, accion: params.accion, ...datos }));
}
