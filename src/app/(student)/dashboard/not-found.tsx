import { ErrorBlock } from "@/components/errores/ErrorBlock";
import { URL_REPORTE_PROBLEMA } from "@/lib/soporte";
import { RutaActual } from "@/components/errores/RutaActual";

export default function DashboardNotFound() {
  return (
    <ErrorBlock
      codigo="404"
      indicador="punto"
      titulo="No encontramos esta página"
      texto="El contenido o el enlace que buscas no existe o cambió de lugar. Vuelve al inicio para encontrarlo de nuevo."
      accionPrimaria={{ label: "Volver al inicio", href: "/dashboard" }}
      accionSecundaria={{ label: "Ver catálogo", href: "/dashboard/catalogo" }}
      cajetin={{
        celdas: [
          { etiqueta: "Error", valor: "404" },
          { etiqueta: "Ruta", valor: <RutaActual /> },
        ],
        pie: {
          pregunta: "¿Llegaste por un enlace nuestro?",
          enlace: { label: "Avísanos del enlace roto", href: URL_REPORTE_PROBLEMA, externo: true },
        },
      }}
    />
  );
}
