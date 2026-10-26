"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { ErrorBlock } from "@/components/errores/ErrorBlock";
import { reportarErrorDelCliente } from "@/lib/reportar-cliente";

function suscribirConexion(aviso: () => void) {
  window.addEventListener("online", aviso);
  window.addEventListener("offline", aviso);
  return () => {
    window.removeEventListener("online", aviso);
    window.removeEventListener("offline", aviso);
  };
}

/**
 * Pantalla de los `error.tsx` (raíz, panel y admin) y de `global-error.tsx`.
 * Es la que ve el usuario cuando falla una consulta (`lanzarSiFalla`).
 *
 * Sin conexión no dice "algo falló de nuestro lado, el equipo fue notificado",
 * que sería falso: pide revisar la red, no se reporta a Sentry y reintenta
 * sola cuando vuelve la conexión.
 *
 * Se reporta aquí además de en el servidor (`onRequestError`,
 * src/instrumentation.ts) porque eso no ve los errores que ocurren solo en el
 * cliente después de la hidratación.
 */
export function PantallaError({
  error,
  reintentar,
  standalone,
  salida,
  soporteHref = "/soporte#contacto",
}: {
  error: Error & { digest?: string };
  /** `retry` de Next (vuelve a pedir el contenido al servidor; `reset` solo repinta). */
  reintentar: () => void;
  standalone?: boolean;
  salida: { label: string; href: string };
  soporteHref?: string;
}) {
  const enLinea = useSyncExternalStore(suscribirConexion, () => navigator.onLine, () => true);

  useEffect(() => {
    if (navigator.onLine) reportarErrorDelCliente(error);
  }, [error]);

  const sinConexionAntes = useRef(!enLinea);
  useEffect(() => {
    if (enLinea && sinConexionAntes.current) reintentar();
    sinConexionAntes.current = !enLinea;
  }, [enLinea, reintentar]);

  if (!enLinea) {
    return (
      <ErrorBlock
        standalone={standalone}
        icono={<WifiOff strokeWidth={1.8} />}
        titulo="Sin conexión a internet"
        texto="Revisa tu wifi o tus datos móviles. Volvemos a intentar solos cuando vuelva la conexión."
        accionPrimaria={{ label: "Reintentar", onClick: reintentar }}
        cajetin={{
          enVivo: true,
          celdas: [
            {
              etiqueta: "Estado",
              texto: true,
              valor: (
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="size-2 rounded-full bg-uva-accent-2 motion-safe:animate-pulse" />
                  Esperando conexión…
                </span>
              ),
            },
          ],
        }}
      />
    );
  }

  return (
    <ErrorBlock
      standalone={standalone}
      codigo="500"
      codigoMuted
      titulo="Algo falló de nuestro lado"
      texto="Ya quedó registrado. Tu progreso no se pierde; reintenta en unos segundos."
      accionPrimaria={{ label: "Reintentar", onClick: reintentar }}
      accionSecundaria={salida}
      cajetin={{
        celdas: [
          { etiqueta: "Error", valor: "500" },
          ...(error.digest ? [{ etiqueta: "Referencia", valor: error.digest }] : []),
        ],
        pie: {
          pregunta: "¿Se repite?",
          enlace: { label: error.digest ? "Escríbenos con esta referencia" : "Escríbenos", href: soporteHref },
        },
      }}
    />
  );
}
