import { ErrorBlock } from "@/components/errores/ErrorBlock";

export default function DashboardNotFound() {
  return (
    <ErrorBlock
      codigo="404"
      indicador="punto"
      titulo="No encontramos esta página"
      texto="El curso, la lección o el enlace que buscas no existe o cambió de lugar. Revisa el catálogo para encontrarlo de nuevo."
      accionPrimaria={{ label: "Volver al catálogo", href: "/dashboard/catalogo" }}
      accionSecundaria={{ label: "Ir al inicio", href: "/dashboard" }}
      meta="HTTP 404 · /dashboard"
    />
  );
}
