"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

export type EstadoIntento = "PENDIENTE" | "APROBADO" | "RECHAZADO";

/**
 * Qué se le dice al estudiante que acaba de volver de la pasarela.
 *
 * El caso que justifica este componente es PENDIENTE: la pasarela devuelve al
 * estudiante por `redirect-url` normalmente ANTES de entregar el webhook, así
 * que hay una ventana —de segundos— en la que ya pagó y la suscripción todavía
 * no existe. Sin esto, la pantalla le diría "no tienes ninguna suscripción" a
 * alguien que acaba de pagar, que es la peor cosa que le puede decir un
 * producto de cobro.
 *
 * Se usan los tokens `uva-badge-success-*` / `uva-badge-danger-*` y NO los
 * `uva-success-*`: estos últimos son el AMARILLO del sitio público, no un
 * verde, y el propio globals.css advierte de no mezclarlos. Un «pago
 * confirmado» en amarillo se lee como advertencia.
 *
 * Mientras está PENDIENTE se refresca solo cada 3 segundos: `router.refresh()`
 * revalida el Server Component de la página, que vuelve a consultar el intento
 * y la suscripción. Cuando el webhook llega, la pantalla cambia sola.
 */
export function EstadoPagoBanner({ estado }: { estado: EstadoIntento }) {
  const router = useRouter();

  useEffect(() => {
    if (estado !== "PENDIENTE") return;

    // Sondeo acotado: 20 intentos a 3 s son 60 segundos. Si el webhook no
    // llegó en ese tiempo, algo pasó y seguir refrescando para siempre no lo
    // va a arreglar — el mensaje ya le dice al estudiante que puede cerrar.
    let restantes = 20;
    const id = setInterval(() => {
      if (restantes-- <= 0) {
        clearInterval(id);
        return;
      }
      router.refresh();
    }, 3000);

    return () => clearInterval(id);
  }, [estado, router]);

  if (estado === "APROBADO") {
    return (
      <div className="mb-5 flex items-start gap-3 rounded-uva-md bg-uva-badge-success-bg px-4 py-3">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-uva-badge-success-fg" aria-hidden />
        <div>
          <p className="m-0 text-sm font-semibold text-uva-badge-success-fg">Pago confirmado</p>
          <p className="m-0 mt-0.5 text-[13px] text-uva-text-muted">
            Tu acceso ya está activo. Abajo puedes ver la vigencia y el recibo.
          </p>
        </div>
      </div>
    );
  }

  if (estado === "RECHAZADO") {
    return (
      <div className="mb-5 flex items-start gap-3 rounded-uva-md bg-uva-badge-danger-bg px-4 py-3">
        <XCircle className="mt-0.5 size-4 shrink-0 text-uva-badge-danger-fg" aria-hidden />
        <div>
          <p className="m-0 text-sm font-semibold text-uva-badge-danger-fg">El pago no se completó</p>
          <p className="m-0 mt-0.5 text-[13px] text-uva-text-muted">
            No se te cobró nada. Puedes intentarlo otra vez desde Planes, con el
            mismo medio de pago u otro distinto.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mb-5 flex items-start gap-3 rounded-uva-md bg-uva-surface-2 px-4 py-3"
      aria-live="polite"
    >
      <Clock className="mt-0.5 size-4 shrink-0 animate-pulse text-uva-text-muted" aria-hidden />
      <div>
        <p className="m-0 text-sm font-semibold text-uva-text">Estamos confirmando tu pago</p>
        <p className="m-0 mt-0.5 text-[13px] text-uva-text-muted">
          Puede tardar unos segundos. Esta página se actualiza sola; si cierras,
          te llega un correo cuando quede listo.
        </p>
      </div>
    </div>
  );
}
