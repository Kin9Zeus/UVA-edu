import type { Metadata } from "next";
import { AccesoMarco } from "@/components/auth/AccesoMarco";
import { VerificarSegundoFactorFlujo } from "@/components/auth/VerificarSegundoFactorFlujo";
import { resolverPantallaSegundoFactor } from "@/lib/auth/pantallaSegundoFactor";

// Pantalla privada: no tiene nada que hacer en un buscador (`robots.ts` también
// la deja fuera).
export const metadata: Metadata = {
  title: "U.V.A. — Escribe tu código",
  robots: { index: false, follow: false },
};

export default async function VerificarSegundoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const { destino } = await resolverPantallaSegundoFactor("verificar", redirect);

  return (
    <AccesoMarco>
      <VerificarSegundoFactorFlujo destino={destino} />
    </AccesoMarco>
  );
}
