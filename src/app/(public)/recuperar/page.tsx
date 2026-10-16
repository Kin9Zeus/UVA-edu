import type { Metadata } from "next";
import { AccesoMarco } from "@/components/auth/AccesoMarco";
import { RecuperarFlujo } from "@/components/auth/RecuperarFlujo";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "U.V.A. — Recuperar contraseña",
};

export default async function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
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
  // Viene del login ("¿Olvidaste tu contraseña?") con el correo que ya se
  // escribió: el campo aparece lleno.
  const { email } = await searchParams;
  return (
    <AccesoMarco>
      <RecuperarFlujo emailInicial={typeof email === "string" ? email : ""} />
    </AccesoMarco>
  );
}
