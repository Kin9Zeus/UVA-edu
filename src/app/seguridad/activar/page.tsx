import type { Metadata } from "next";
import { AccesoMarco } from "@/components/auth/AccesoMarco";
import { ActivarSegundoFactorFlujo } from "@/components/auth/ActivarSegundoFactorFlujo";
import { resolverPantallaSegundoFactor } from "@/lib/auth/pantallaSegundoFactor";

// Pantalla privada: no tiene nada que hacer en un buscador (`robots.ts` también
// la deja fuera).
export const metadata: Metadata = {
  title: "U.V.A. — Activa la verificación en dos pasos",
  robots: { index: false, follow: false },
};

export default async function ActivarSegundoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const { destino } = await resolverPantallaSegundoFactor("activar", redirect);

  return (
    <AccesoMarco>
      <ActivarSegundoFactorFlujo destino={destino} />
    </AccesoMarco>
  );
}
