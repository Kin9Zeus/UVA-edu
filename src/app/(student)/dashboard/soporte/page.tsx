import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SoporteCentro } from "@/components/soporte/SoporteCentro";
import { esTemaSoporte } from "@/lib/soporte";
import { destinoLegalDeTema } from "@/lib/legal/redireccion-soporte";

export const metadata: Metadata = { title: "U.V.A. — Soporte" };

/**
 * Soporte dentro del panel: el mismo diseño de /soporte (SoporteCentro), sin
 * la invitación a entrar y con el formulario de verificar certificados en la
 * página, porque el panel no tiene el pie del sitio. `?tema=` abre un tema
 * (lo usa, por ejemplo, el enlace a Privacidad de "Eliminar cuenta").
 */
export default async function SoportePage({
  searchParams,
}: {
  searchParams: Promise<{ tema?: string }>;
}) {
  const { tema } = await searchParams;

  // Términos y Privacidad pasan a su texto legal cuando ya está publicado.
  const destinoLegal = await destinoLegalDeTema(tema);
  if (destinoLegal) redirect(destinoLegal);

  return <SoporteCentro temaAbierto={esTemaSoporte(tema) ? tema : undefined} conSesion verificacionEnPagina />;
}
