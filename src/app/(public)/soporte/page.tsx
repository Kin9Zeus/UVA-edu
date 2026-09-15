import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { SoporteContent } from "@/components/soporte/SoporteContent";
import { getPerfilActual } from "@/lib/perfil";
import { esTemaSoporte } from "@/lib/soporte";
import { metadataPublica } from "@/lib/seo/metadata";

export const metadata: Metadata = metadataPublica({
  titulo: "Soporte",
  descripcion:
    "Respuestas a las dudas frecuentes sobre cuenta, acceso, certificados y pagos en U.V.A, y cómo escribirnos.",
  ruta: "/soporte",
});

/**
 * Misma pantalla de soporte que /dashboard/soporte, pero sin sidebar: aquí se
 * llega desde el footer del home, sin sesión. Con sesión el SiteHeader cambia
 * solo al header del dashboard, así que el enlace sirve en ambos casos.
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
        <SoporteContent temaAbierto={esTemaSoporte(tema) ? tema : undefined} />
      </main>
      <Footer />
    </>
  );
}
