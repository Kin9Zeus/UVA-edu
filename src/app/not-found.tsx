import { ErrorBlock } from "@/components/errores/ErrorBlock";

export default function NotFound() {
  return (
    <ErrorBlock
      standalone
      codigo="404"
      indicador="punto"
      titulo="No encontramos esta página"
      texto="El curso, la lección o el enlace que buscas no existe o cambió de lugar. Revisa el catálogo para encontrarlo de nuevo."
      accionPrimaria={{ label: "Volver al catálogo", href: "/catalogo" }}
      accionSecundaria={{ label: "Ir al inicio", href: "/" }}
      meta="HTTP 404"
    />
  );
}
