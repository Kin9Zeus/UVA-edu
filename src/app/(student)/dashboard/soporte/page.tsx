import type { Metadata } from "next";
import { SoporteCentro } from "@/components/soporte/SoporteCentro";
import { permanentRedirect } from "next/navigation";
import { destinoTemaViejo } from "@/lib/soporte";

export const metadata: Metadata = { title: "U.V.A. — Soporte" };

/**
 * Soporte dentro del panel: el mismo diseño de /soporte (SoporteCentro), sin
 * la invitación a entrar y con el formulario de verificar certificados en la
 * página, porque el panel no tiene el pie del sitio. Los enlaces viejos con
 * `?tema=` se redirigen (Términos y Privacidad, a sus páginas públicas).
 */
export default async function SoportePage({
  searchParams,
}: {
  searchParams: Promise<{ tema?: string | string[] }>;
}) {
  const { tema } = await searchParams;
  const destino = destinoTemaViejo(tema, "/dashboard/soporte");
  if (destino) permanentRedirect(destino);

  return <SoporteCentro conSesion verificacionEnPagina />;
}
