import type { Metadata } from "next";
import { SoporteCentro } from "@/components/soporte/SoporteCentro";
import { esTemaSoporte } from "@/lib/soporte";

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

  return <SoporteCentro temaAbierto={esTemaSoporte(tema) ? tema : undefined} conSesion verificacionEnPagina />;
}
