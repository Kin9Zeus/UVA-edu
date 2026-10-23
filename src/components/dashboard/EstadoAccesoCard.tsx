import type { ReactNode } from "react";
import Link from "next/link";
import { formatFecha } from "@/lib/admin/format";
import {
  type EstadoVigencia,
  type TipoAccesoGratuito,
} from "@/lib/estadoAcceso";

/** De dónde salió el acceso, dicho como el estudiante lo vivió. */
const ORIGEN_TIPO: Record<TipoAccesoGratuito, string> = {
  INVITACION: "Lo obtuviste con un código de invitación.",
  OTORGADO_ADMIN: "Te lo dio el equipo de U.V.A.",
};

/** "12 de marzo de 2027": la frase principal se lee completa, sin abreviar. */
const FECHA_COMPLETA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Bogota",
});

/**
 * Lo que el estudiante puede hacer hoy y hasta cuándo, en una frase. Va antes
 * que el origen del acceso porque es lo que vino a averiguar.
 */
export function fraseAcceso(vigencia: EstadoVigencia, fechaVigencia: string | null): string {
  if (vigencia === "VENCIDO") return "Tu acceso a los cursos terminó.";
  if (vigencia === "SIN_LIMITE" || !fechaVigencia) return "Puedes ver todos los cursos, sin fecha de cierre.";
  return `Puedes ver todos los cursos hasta el ${FECHA_COMPLETA.format(new Date(fechaVigencia))}.`;
}

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
  // Vencido: la frase dice que terminó y esta línea, hasta cuándo estuvo (si
  // la fecha ya pasó; ver lineaVigencia).
  const linea = vencido ? lineaVigencia(vigencia, fechaVigencia, diasRestantes) : null;
  // "Te quedan N días" ya lo dice el aviso cuando está por vencer.
  const quedan =
    !vencido && vigencia !== "POR_VENCER" && diasRestantes !== null ? diasRestantes : null;

  return (
    <div className="flex flex-col gap-2 rounded-uva-lg border border-uva-divider bg-uva-surface p-[18px] [&_p]:mb-0 [&_h2]:mb-0">
      <h2 className="text-uva-cuerpo font-extrabold text-uva-text">Tu acceso</h2>
      {/* El estado de hoy en una frase y, debajo, el origen. Antes la
          etiqueta era el origen ("Invitación gratuita") y la fecha iba
          aparte: había que juntar las dos para saber qué se podía hacer. */}
      <p className={vencido ? "text-uva-cuerpo font-bold text-uva-text-muted" : "text-uva-cuerpo font-bold text-uva-text"}>
        {fraseAcceso(vigencia, fechaVigencia)}
      </p>

      {linea && <p className="text-uva-cuerpo text-uva-text-muted">{linea}</p>}

      {!vencido && (
        <p className="text-uva-cuerpo text-uva-text-muted">
          {quedan !== null && (
            <>
              Te quedan{" "}
              <b className="font-mono text-uva-text">
                {quedan} {quedan === 1 ? "día" : "días"}
              </b>
              .{" "}
            </>
          )}
          {ORIGEN_TIPO[tipo]}
        </p>
      )}

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
