import { formatFecha } from "@/lib/admin/format";
import {
  ETIQUETA_TIPO_ACCESO,
  type EstadoVigencia,
  type TipoAccesoGratuito,
} from "@/lib/estadoAcceso";

const DESCRIPCION_TIPO: Record<TipoAccesoGratuito, string> = {
  INVITACION: "Canjeaste un código de invitación con usos limitados.",
  OTORGADO_ADMIN: "El equipo de U.V.A. te dio acceso completo a la plataforma.",
};

/** Cómo se lee la fecha límite según en qué punto del periodo esté el estudiante. */
function lineaVigencia(vigencia: EstadoVigencia, fechaVigencia: string | null) {
  if (vigencia === "SIN_LIMITE" || !fechaVigencia) return "Tu acceso no tiene fecha de cierre.";
  if (vigencia === "VENCIDO") return `Estuvo vigente hasta el ${formatFecha(fechaVigencia)}.`;
  return `Vigente hasta el ${formatFecha(fechaVigencia)}.`;
}

function textoAviso(vigencia: EstadoVigencia, diasRestantes: number | null) {
  if (vigencia === "VENCIDO") {
    return "Tu periodo de acceso ya terminó. Escríbenos y con gusto lo renovamos.";
  }
  if (vigencia !== "POR_VENCER" || diasRestantes === null) return null;
  if (diasRestantes === 0) {
    return "Hoy es el último día de tu acceso. Escríbenos si quieres seguir con nosotros.";
  }
  return `Te quedan ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"} de acceso. Escríbenos si quieres seguir con nosotros.`;
}

/**
 * Sección de "estado de acceso" para estudiantes con cupo gratuito (Fase 4).
 * No se muestra a suscripciones de pago (Stripe/Wompi) — esas tienen su
 * propio historial de pagos en /dashboard/suscripcion. El tono es
 * deliberadamente el de un regalo con cupo limitado, no el de una prueba
 * gratuita a punto de caducar: ni el aviso de los últimos días ni el de
 * periodo terminado empujan a pagar, invitan a escribirle al equipo.
 *
 * Todo el estado (tipo, vigencia y días) llega ya resuelto por
 * `calcularEstadoAcceso` para que la página y la tarjeta no puedan discrepar.
 */
export function EstadoAccesoCard({
  tipo,
  fechaVigencia,
  diasRestantes,
  vigencia,
}: {
  tipo: TipoAccesoGratuito;
  fechaVigencia: string | null;
  diasRestantes: number | null;
  vigencia: EstadoVigencia;
}) {
  const vencido = vigencia === "VENCIDO";
  const aviso = textoAviso(vigencia, diasRestantes);

  return (
    <div className="flex flex-col gap-3 rounded-uva-md border border-uva-divider bg-uva-surface p-[22px]">
      <div className="flex items-center gap-2.5">
        <h4 className="font-heading text-[17px] text-uva-text">Tu acceso</h4>
        <span
          className={
            vencido
              ? "ml-auto shrink-0 rounded-full bg-uva-hover px-2.5 py-1 text-[11px] text-uva-text-muted"
              : "ml-auto shrink-0 rounded-full bg-uva-accent-soft px-2.5 py-1 text-[11px] text-uva-accent-text"
          }
        >
          {ETIQUETA_TIPO_ACCESO[tipo]}
        </span>
      </div>

      <p className="text-sm text-uva-text-muted">{DESCRIPCION_TIPO[tipo]}</p>

      <p className="text-[12.5px] text-uva-text">{lineaVigencia(vigencia, fechaVigencia)}</p>

      {aviso && (
        <div
          className={
            vencido
              ? "rounded-[10px] bg-uva-hover px-3 py-2.5 text-[12.5px] text-uva-text-muted"
              : "rounded-[10px] bg-uva-accent-soft px-3 py-2.5 text-[12.5px] text-uva-accent-text"
          }
        >
          {aviso}
        </div>
      )}
    </div>
  );
}
