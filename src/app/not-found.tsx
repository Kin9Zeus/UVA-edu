import { ErrorBlock } from "@/components/errores/ErrorBlock";
import { connection } from "next/server";
import { URL_REPORTE_PROBLEMA } from "@/lib/soporte";
import { RutaActual } from "@/components/errores/RutaActual";

export default async function NotFound() {
  // P2-2 (AUDIT-2026-09-08): fuerza el render dinámico. Esta era una de las
  // 4 rutas que `next build` prerenderizaba, y una página prerenderizada se
  // genera cuando todavía no existe la petición — así que sus scripts salen
  // sin el nonce que Next inyecta desde la CSP. Con `'strict-dynamic'` un
  // script externo sin nonce queda bloqueado (strict-dynamic ignora 'self'),
  // o sea que esta pantalla se rompería el día que la política deje de ser
  // Report-Only. El coste es perder la optimización estática de una página
  // de bajo tráfico; el beneficio es que la CSP puede forzarse en TODO el
  // sitio y no en el 90%.
  await connection();
  return (
    <ErrorBlock
      standalone
      codigo="404"
      indicador="punto"
      titulo="No encontramos esta página"
      texto="El curso, la lección o el enlace que buscas no existe o cambió de lugar."
      accionPrimaria={{ label: "Ir al catálogo", href: "/catalogo" }}
      accionSecundaria={{ label: "Ir al inicio", href: "/" }}
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
