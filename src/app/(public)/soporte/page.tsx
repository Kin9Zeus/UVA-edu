import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { SoporteCentro } from "@/components/soporte/SoporteCentro";
import { permanentRedirect } from "next/navigation";
import { getPerfilActual } from "@/lib/perfil";
import { destinoTemaViejo } from "@/lib/soporte";
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
 * SoporteCentro dentro del panel. Términos y Privacidad tienen página propia
 * (/soporte/[documento]); los enlaces viejos con `?tema=` se redirigen.
 */
export default async function SoportePublicoPage({
  searchParams,
}: {
  searchParams: Promise<{ tema?: string | string[] }>;
}) {
  const { tema } = await searchParams;
  const destino = destinoTemaViejo(tema, "/soporte");
  if (destino) permanentRedirect(destino);
  const perfilActual = await getPerfilActual();

  return (
    <>
      <SiteHeader {...perfilActual} />
      <main id="contenido" tabIndex={-1}>
        <SoporteCentro conSesion={Boolean(perfilActual.user)} />
      </main>
      <Footer />
    </>
  );
}
