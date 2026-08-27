import { formatFecha } from "@/lib/admin/format";
import type { TipoAccesoGratuito } from "@/lib/estadoAcceso";

const TITULO_TIPO: Record<TipoAccesoGratuito, string> = {
  INVITACION: "Invitación gratuita a U.V.A.",
  OTORGADO_ADMIN: "Acceso otorgado por U.V.A.",
};

const DESCRIPCION_TIPO: Record<TipoAccesoGratuito, string> = {
  INVITACION: "Canjeaste un código de invitación con cupo limitado.",
  OTORGADO_ADMIN: "El equipo de U.V.A. te dio acceso completo a la plataforma.",
};

/**
 * Sección de "estado de acceso" para estudiantes con cupo gratuito (Fase 4).
 * No se muestra a suscripciones de pago (Stripe/Wompi) — esas tienen su
 * propio historial de pagos en /dashboard/suscripcion. El tono es
 * deliberadamente el de un regalo con cupo limitado, no el de una prueba
 * gratuita a punto de caducar (ver requisitos de calidad, Revf4.md).
 */
export function EstadoAccesoCard({
  tipo,
  fechaVigencia,
  diasRestantes,
  avisoVencimiento,
}: {
  tipo: TipoAccesoGratuito;
  fechaVigencia: string | null;
  diasRestantes: number | null;
  avisoVencimiento: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-uva-md border border-uva-divider bg-uva-surface p-[22px]">
      <div className="flex items-center gap-2.5">
        <h4 className="font-heading text-[17px] text-uva-text">Tu acceso</h4>
        <span className="ml-auto shrink-0 rounded-full bg-uva-accent-soft px-2.5 py-1 text-[11px] text-uva-accent-text">
          {TITULO_TIPO[tipo]}
        </span>
      </div>

      <p className="text-sm text-uva-text-muted">{DESCRIPCION_TIPO[tipo]}</p>

      {fechaVigencia && (
        <p className="text-[12.5px] text-uva-text">
          Vigente hasta <span className="font-mono">{formatFecha(fechaVigencia)}</span>
        </p>
      )}

      {avisoVencimiento && diasRestantes !== null && (
        <div className="rounded-[10px] bg-uva-accent-soft px-3 py-2.5 text-[12.5px] text-uva-accent-text">
          {diasRestantes === 0
            ? "Tu acceso vence hoy. Escríbenos si quieres seguir con nosotros."
            : `Tu acceso vence en ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"}. Escríbenos si quieres seguir con nosotros.`}
        </div>
      )}
    </div>
  );
}
