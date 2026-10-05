import type { Metadata } from "next";
import { ErrorBlock } from "@/components/errores/ErrorBlock";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";

// El texto nombra la cuenta de quien mira: antes decía siempre "Tu cuenta de
// estudiante" y "rol: ESTUDIANTE", también a un profesor o a alguien sin
// sesión. Hoy solo llega aquí quien no es administrador (ver
// (admin)/admin/layout.tsx), pero la página se puede abrir directo.
const CUENTA_POR_ROL: Record<string, string> = {
  ESTUDIANTE: "Tu cuenta de estudiante",
  PROFESOR: "Tu cuenta de profesor",
};

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
  const { user, perfil } = await getPerfilActual();
  const rol = perfil?.rol as string | undefined;

  if (!user) {
    return (
      <ErrorBlock
        standalone
        codigo="403"
        indicador="raya"
        titulo="No tienes permiso para ver esto"
        texto="Esta sección está reservada para el equipo administrativo de U.V.A. Inicia sesión con una cuenta de administrador para entrar."
        accionPrimaria={{ label: "Iniciar sesión", href: "/login" }}
        accionSecundaria={{ label: "Volver al inicio", href: "/" }}
        meta="HTTP 403"
      />
    );
  }

  // Un administrador sí tiene acceso: si abre esta página directo, va al panel
  // en vez de leer que su cuenta "no tiene acceso".
  if (rol === "ADMINISTRADOR") redirect("/admin");

  const cuenta = CUENTA_POR_ROL[rol ?? ""] ?? "Tu cuenta";
  return (
    <ErrorBlock
      standalone
      codigo="403"
      indicador="raya"
      titulo="No tienes permiso para ver esto"
      texto={`Esta sección está reservada para el equipo administrativo de U.V.A. ${cuenta} no tiene acceso a esta ruta.`}
      accionPrimaria={{ label: "Volver al inicio", href: "/" }}
      accionSecundaria={{ label: "Ver mis cursos", href: "/dashboard" }}
      meta={rol ? `HTTP 403 · rol: ${rol}` : "HTTP 403"}
    />
  );
}
