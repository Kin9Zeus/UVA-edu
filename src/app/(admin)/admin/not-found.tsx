import { ErrorBlock } from "@/components/errores/ErrorBlock";
import { URL_REPORTE_PROBLEMA } from "@/lib/soporte";
import { RutaActual } from "@/components/errores/RutaActual";

export default function AdminNotFound() {
  return (
    <ErrorBlock
      codigo="404"
      indicador="punto"
      titulo="No encontramos esta página"
      texto="La sección del panel que buscas no existe o cambió de lugar. Revisa el menú lateral para encontrarla de nuevo."
      accionPrimaria={{ label: "Volver al panel", href: "/admin" }}
      accionSecundaria={{ label: "Ver cursos", href: "/admin/cursos" }}
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
