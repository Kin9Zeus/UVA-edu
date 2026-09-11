import { ErrorBlock } from "@/components/errores/ErrorBlock";

export default function DashboardNotFound() {
  return (
    <ErrorBlock
      codigo="404"
      indicador="punto"
      titulo="No encontramos esta página"
      texto="El contenido o el enlace que buscas no existe o cambió de lugar. Vuelve al inicio para encontrarlo de nuevo."
      accionPrimaria={{ label: "Volver al inicio", href: "/dashboard" }}
      accionSecundaria={{ label: "Ver catálogo", href: "/dashboard/catalogo" }}
      meta="HTTP 404 · /dashboard"
    />
  );
}
