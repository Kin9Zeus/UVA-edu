import { calcularDiasGracia } from "@/lib/gracia";
import type { SuscripcionActual } from "@/lib/suscripcion";

/** A partir de cuántos días restantes se muestra el aviso de vencimiento próximo. */
const UMBRAL_AVISO_DIAS = 7;

/**
 * Toda fecha que ve el estudiante —y todo conteo de días sobre ella— se
 * resuelve en el calendario de Colombia. Es una zona sin horario de verano,
 * pero se pasa por `Intl` en vez de restar 5 horas a mano para que el día
 * civil que cuenta esta función y el que imprime `formatFecha`
 * (src/lib/admin/format.ts, mismo `timeZone`) no puedan separarse.
 */
const ZONA_COLOMBIA = "America/Bogota";

/** `en-CA` porque formatea como `2026-09-03`, ya ordenable y troceable. */
const diaCivilColombia = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_COLOMBIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Número de día absoluto (días desde epoch) del instante, en calendario de Bogotá. */
function numeroDeDiaEnColombia(instante: Date): number {
  const [anio, mes, dia] = diaCivilColombia.format(instante).split("-").map(Number);
  return Date.UTC(anio, mes - 1, dia) / 86_400_000;
}

/**
 * OTORGADO_ADMIN (no "CORTESIA": esa palabra ya la usa
 * `Inscripciones.tipo_acceso` para el acceso a UN curso puntual otorgado
 * vía `ofrecerCortesia` — un concepto distinto a una suscripción completa
 * otorgada manualmente. Mismo nombre para dos cosas distintas confundía
 * tanto en el código como en la UI del admin).
 */
export type TipoAccesoGratuito = "INVITACION" | "OTORGADO_ADMIN";

/**
 * Etiqueta corta del tipo de acceso. Vive aquí —y no en cada componente—
 * porque la usan tres pantallas distintas (perfil del estudiante, listado
 * de usuarios y ficha de usuario del admin) y el requisito es que las tres
 * digan lo mismo. Tenerla escrita tres veces ya las había separado:
 * el estudiante leía "Invitación gratuita a U.V.A." y el admin
 * "Invitación gratuita".
 */
export const ETIQUETA_TIPO_ACCESO: Record<TipoAccesoGratuito, string> = {
  INVITACION: "Invitación gratuita",
  OTORGADO_ADMIN: "Acceso otorgado",
};

/**
 * Clasifica un acceso manual (Fase 4: cupos gratuitos) para mostrarlo tanto
 * en el perfil del estudiante como en la ficha de usuario del admin — única
 * fuente de verdad para que ambos lados usen la misma etiqueta. `null` si la
 * suscripción es de pago (Stripe/Wompi) — esa vista vive en
 * `SuscripcionContent`, no aquí.
 *
 * INVITACION: el propio estudiante canjeó un código (`id_codigo_invitacion`
 * no nulo, ver `canjear_codigo_invitacion`, 017_canjear_codigo_invitacion.sql).
 * OTORGADO_ADMIN: un administrador lo otorgó directo (`otorgarMembresia`,
 * src/actions/admin/usuarios.ts), sin código de por medio.
 */
export function tipoAccesoGratuito(
  suscripcion: Pick<SuscripcionActual, "accesoManual" | "tieneCodigoInvitacion">,
): TipoAccesoGratuito | null {
  if (!suscripcion.accesoManual) return null;
  return suscripcion.tieneCodigoInvitacion ? "INVITACION" : "OTORGADO_ADMIN";
}

export type EstadoSuscripcionAdmin = "ACTIVA" | "PAST_DUE" | "VENCIDA" | "CANCELADA";

/**
 * Única fuente de verdad para pintar `suscripciones.estado` en el panel
 * admin (listado de usuarios y ficha de usuario) — vivía duplicada solo en
 * `UsuariosTable.tsx`, y la ficha de usuario no la mostraba en absoluto:
 * un admin que revocaba una membresía manual (`revocarMembresia`, deja
 * `estado = 'CANCELADA'`) no tenía forma de verlo en la ficha del usuario,
 * solo notaba que el botón "Revocar membresía" había desaparecido.
 */
export const ETIQUETA_ESTADO_SUSCRIPCION: Record<EstadoSuscripcionAdmin, string> = {
  ACTIVA: "Activa",
  PAST_DUE: "Pago pendiente",
  VENCIDA: "Vencida",
  CANCELADA: "Cancelada",
};

export const TONO_ESTADO_SUSCRIPCION: Record<EstadoSuscripcionAdmin, "success" | "warning" | "error" | "neutral"> = {
  ACTIVA: "success",
  PAST_DUE: "warning",
  VENCIDA: "error",
  CANCELADA: "neutral",
};

/**
 * Si el estado todavía da acceso (misma regla que `suscripcionDaAcceso`,
 * sin mirar la fecha: aquí solo importa si vale la pena seguir mostrando
 * "Acceso otorgado"/"Invitación gratuita" como si el acceso siguiera en
 * pie). Una suscripción CANCELADA o VENCIDA no debería seguir luciendo esa
 * etiqueta junto a su estado — leía como si el acceso "otorgado" siguiera
 * activo cuando ya no lo está.
 */
export function suscripcionEstaVigentePorEstado(estado: EstadoSuscripcionAdmin | null): boolean {
  return estado === "ACTIVA" || estado === "PAST_DUE";
}

/**
 * Días de calendario colombiano que faltan hasta `fechaRenovacion`:
 * 0 = vence hoy, 1 = mañana, y NEGATIVO si ya pasó.
 *
 * El signo importa: antes esto devolvía `Math.max(0, …)`, así que un acceso
 * vencido hace meses seguía diciendo "vence hoy" para siempre — nada en la
 * plataforma mueve todavía la suscripción a VENCIDA cuando pasa la fecha
 * (no hay job de expiración; la vista `metricas_panel_usuarios` cuenta
 * igualmente como vigente a cualquier ACTIVA). Quien necesite el conteo
 * acotado que use `Math.max(0, …)` en el punto donde lo muestra.
 *
 * `ahora` es inyectable para no invocar `Date.now()` en un componente
 * (react-hooks/purity), mismo criterio que `calcularDiasGracia` en gracia.ts.
 */
export function calcularDiasVigencia(
  fechaRenovacion: string | null,
  ahora: Date = new Date(),
): number | null {
  if (!fechaRenovacion) return null;
  return numeroDeDiaEnColombia(new Date(fechaRenovacion)) - numeroDeDiaEnColombia(ahora);
}

/**
 * SIN_LIMITE: acceso manual sin `fecha_renovacion` (no lo produce ningún
 * flujo actual, pero la columna es nullable y el perfil no puede quedarse
 * mudo si aparece uno).
 * POR_VENCER: quedan `UMBRAL_AVISO_DIAS` días o menos, incluido hoy.
 * VENCIDO: la fecha ya pasó, o el estado de la suscripción ya lo dice.
 */
export type EstadoVigencia = "SIN_LIMITE" | "VIGENTE" | "POR_VENCER" | "VENCIDO";

export type EstadoAcceso = {
  tipo: TipoAccesoGratuito;
  fechaVigencia: string | null;
  /** Días de calendario colombiano hasta la fecha; negativo si ya pasó, null sin fecha. */
  diasRestantes: number | null;
  vigencia: EstadoVigencia;
};

/**
 * Estado de acceso que ve el estudiante en su perfil, resuelto de una vez
 * (tipo + vigencia + días) para que la página no vuelva a componerlo a mano
 * y no pueda contradecir a la tarjeta.
 *
 * Devuelve `null` para suscripciones de pago: esas tienen su propia pantalla
 * con historial de pagos en /dashboard/suscripcion.
 */
export function calcularEstadoAcceso(
  suscripcion: Pick<
    SuscripcionActual,
    "accesoManual" | "tieneCodigoInvitacion" | "estado" | "fechaRenovacion"
  > | null,
  ahora: Date = new Date(),
): EstadoAcceso | null {
  if (!suscripcion) return null;

  const tipo = tipoAccesoGratuito(suscripcion);
  if (!tipo) return null;

  const diasRestantes = calcularDiasVigencia(suscripcion.fechaRenovacion, ahora);

  // La misma regla que decide si el video se reproduce (`suscripcionDaAcceso`),
  // no una paralela: si la tarjeta dijera "vigente" mientras el reproductor
  // responde "no tienes acceso", el estudiante no tendría forma de entender
  // qué le pasa.
  const vigencia: EstadoVigencia = !suscripcionDaAcceso(suscripcion, ahora)
    ? "VENCIDO"
    : diasRestantes === null
      ? "SIN_LIMITE"
      : diasRestantes < 0
        ? "VENCIDO"
        : diasRestantes <= UMBRAL_AVISO_DIAS
          ? "POR_VENCER"
          : "VIGENTE";

  return {
    tipo,
    fechaVigencia: suscripcion.fechaRenovacion,
    diasRestantes,
    vigencia,
  };
}

/**
 * ¿Esta suscripción da acceso al contenido AHORA MISMO?
 *
 * Única regla de vigencia de la plataforma: la usan el reproductor
 * (src/lib/mux/acceso.ts), el detalle de curso (src/lib/curso.ts), el
 * reproductor de lección (src/lib/leccion.ts), la comunidad y la tarjeta
 * "Tu acceso" del perfil. Su gemela en SQL es
 * `private.suscripcion_da_acceso()` (038_vigencia_por_fecha.sql), que
 * protege los recursos descargables y los cursos despublicados.
 *
 * Antes esto era `estado in (ACTIVA, PAST_DUE)` a secas, sin mirar la
 * fecha. Como nada mueve la fila a VENCIDA cuando el periodo termina, una
 * invitación de 30 días seguía reproduciendo video para siempre.
 *
 *   - ACTIVA: vigente hasta el FINAL del día colombiano impreso como
 *     "Vigente hasta …" en el perfil. Si se cortara en el instante exacto de
 *     `fecha_renovacion`, el acceso moriría a media mañana del día que la
 *     propia plataforma le anunció como suyo.
 *   - PAST_DUE: solo mientras queden días de gracia — los mismos que la
 *     barra lateral le está prometiendo al estudiante (`calcularDiasGracia`).
 *   - VENCIDA / CANCELADA: no, sin más.
 */
export function suscripcionDaAcceso(
  suscripcion: Pick<SuscripcionActual, "estado" | "fechaRenovacion"> | null,
  ahora: Date = new Date(),
): boolean {
  if (!suscripcion) return false;
  if (suscripcion.estado === "VENCIDA" || suscripcion.estado === "CANCELADA") return false;

  // Acceso manual sin fecha límite: no hay nada contra qué compararlo.
  if (!suscripcion.fechaRenovacion) return true;

  if (suscripcion.estado === "PAST_DUE") {
    return calcularDiasGracia(suscripcion.fechaRenovacion, ahora) > 0;
  }

  return (calcularDiasVigencia(suscripcion.fechaRenovacion, ahora) ?? 0) >= 0;
}
