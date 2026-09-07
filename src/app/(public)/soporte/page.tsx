import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { SoporteContent } from "@/components/soporte/SoporteContent";
import { getPerfilActual } from "@/lib/perfil";
import { esTemaSoporte } from "@/lib/soporte";

export const metadata: Metadata = { title: "U.V.A. — Soporte" };

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
