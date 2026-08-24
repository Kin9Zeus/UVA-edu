import { ErrorBlock } from "@/components/errores/ErrorBlock";

export default function AdminNotFound() {
  return (
    <ErrorBlock
      codigo="404"
      indicador="punto"
      titulo="No encontramos esta página"
      texto="La sección del panel que buscas no existe o cambió de lugar. Revisa el menú lateral para encontrarla de nuevo."
      accionPrimaria={{ label: "Volver al panel", href: "/admin" }}
      accionSecundaria={{ label: "Ver cursos", href: "/admin/cursos" }}
      meta="HTTP 404 · /admin"
    />
  );
}
