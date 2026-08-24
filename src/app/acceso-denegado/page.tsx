import type { Metadata } from "next";
import { ErrorBlock } from "@/components/errores/ErrorBlock";

export const metadata: Metadata = {
  title: "No tienes permiso para ver esto — U.V.A.",
};

export default function AccesoDenegadoPage() {
  return (
    <ErrorBlock
      standalone
      codigo="403"
      indicador="raya"
      titulo="No tienes permiso para ver esto"
      texto="Esta sección está reservada para el equipo administrativo de U.V.A. Tu cuenta de estudiante no tiene acceso a esta ruta."
      accionPrimaria={{ label: "Volver al inicio", href: "/" }}
      accionSecundaria={{ label: "Ver mis cursos", href: "/dashboard" }}
      meta="HTTP 403 · rol: ESTUDIANTE"
    />
  );
}
