import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { SoporteCentro } from "@/components/soporte/SoporteCentro";
import { getPerfilActual } from "@/lib/perfil";
import { esTemaSoporte } from "@/lib/soporte";
import { metadataPublica } from "@/lib/seo/metadata";

export const metadata: Metadata = metadataPublica({
  titulo: "Soporte",
  descripcion:
    "Respuestas a las dudas frecuentes sobre cuenta, acceso, certificados y pagos en U.V.A., y cómo escribirnos.",
  ruta: "/soporte",
});

/**
 * Soporte público (tablero "Soporte sin sesion"): se llega desde el pie del
 * home. Con sesión el SiteHeader cambia solo al header del dashboard y no se
 * muestra la invitación a entrar. /dashboard/soporte usa el mismo
 * SoporteCentro dentro del panel.
 */
export default async function SoportePublicoPage({
  searchParams,
}: {
  searchParams: Promise<{ tema?: string }>;
}) {
  const [{ tema }, perfilActual] = await Promise.all([searchParams, getPerfilActual()]);

  return (
    <>
      <SiteHeader {...perfilActual} />
      <main>
        <SoporteCentro
          temaAbierto={esTemaSoporte(tema) ? tema : undefined}
          conSesion={Boolean(perfilActual.user)}
        />
      </main>
      <Footer />
    </>
  );
}
