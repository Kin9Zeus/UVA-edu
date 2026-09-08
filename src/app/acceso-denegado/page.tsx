import type { Metadata } from "next";
import { ErrorBlock } from "@/components/errores/ErrorBlock";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "No tienes permiso para ver esto — U.V.A.",
};

export default async function AccesoDenegadoPage() {
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
