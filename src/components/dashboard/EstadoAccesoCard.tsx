import type { ReactNode } from "react";
import Link from "next/link";
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

/**
 * Cómo se lee la fecha límite según en qué punto del periodo esté el
 * estudiante.
 *
 * Un acceso VENCIDO con `diasRestantes >= 0` terminó por su ESTADO
 * (cancelado o revocado a mano), no por la fecha, y esa fecha todavía no ha
 * llegado: "estuvo vigente hasta el 27 de octubre" dicho el 7 de octubre le
 * anuncia como pasada una fecha futura —y contradice a "Mi suscripción", que
 * ya la omite—. En ese caso no se imprime nada; el aviso de abajo lo explica.
 */
export function lineaVigencia(
  vigencia: EstadoVigencia,
  fechaVigencia: string | null,
  diasRestantes: number | null,
): string | null {
  if (vigencia === "SIN_LIMITE" || !fechaVigencia) return "Tu acceso no tiene fecha de cierre.";
  if (vigencia === "VENCIDO") {
    return diasRestantes !== null && diasRestantes < 0
      ? `Estuvo vigente hasta el ${formatFecha(fechaVigencia)}.`
      : null;
  }
  return `Vigente hasta el ${formatFecha(fechaVigencia)}.`;
}

function textoAviso(vigencia: EstadoVigencia, diasRestantes: number | null): ReactNode {
  if (vigencia === "VENCIDO") {
    return (
      <>
        Tu periodo de acceso ya terminó. Si tienes un código nuevo, canjéalo en{" "}
        <Link href="/dashboard/suscripcion" className="font-semibold text-uva-text underline underline-offset-2">
          Mi suscripción
        </Link>
        .
      </>
    );
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
 * periodo terminado empujan a pagar: el primero invita a escribirle al equipo
 * y el segundo lleva a canjear un código nuevo.
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
  const linea = lineaVigencia(vigencia, fechaVigencia, diasRestantes);

  return (
    <div className="flex flex-col gap-2 rounded-uva-lg border border-uva-divider bg-uva-surface p-[18px]">
      <h2 className="text-uva-cuerpo font-extrabold text-uva-text">Tu acceso</h2>
      <p className="flex flex-wrap items-baseline justify-between gap-x-2.5 text-uva-cuerpo font-bold text-uva-text">
        <span className={vencido ? "text-uva-text-muted" : undefined}>
          {/* Antes decía "Acceso otorgado"/"Invitación gratuita" (el
              ORIGEN del acceso) incluso ya terminado, y la línea de abajo
              decía "estuvo vigente hasta X, ya terminó" justo debajo — dos
              frases contradiciéndose en la misma tarjeta. El badge ahora
              habla del ESTADO actual; el origen queda solo en el párrafo
              de descripción. */}
          {vencido ? "Acceso finalizado" : ETIQUETA_TIPO_ACCESO[tipo]}
        </span>
        {!vencido && diasRestantes !== null && (
          <b className="font-mono text-uva-accent-ink">
            {diasRestantes} {diasRestantes === 1 ? "día" : "días"}
          </b>
        )}
      </p>

      <p className="text-uva-cuerpo text-uva-text-muted">{DESCRIPCION_TIPO[tipo]}</p>

      {linea && <p className="text-uva-cuerpo text-uva-text-muted">{linea}</p>}

      {aviso && (
        <div
          className={
            vencido
              ? "rounded-uva-md bg-uva-surface-2 px-3.5 py-2.5 text-uva-detalle text-uva-text-muted"
              : "rounded-uva-md bg-uva-accent-soft px-3.5 py-2.5 text-uva-detalle text-uva-accent-text"
          }
        >
          {aviso}
        </div>
      )}
    </div>
  );
}
