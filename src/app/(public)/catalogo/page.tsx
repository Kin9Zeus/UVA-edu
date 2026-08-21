import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { getPerfilActual } from "@/lib/perfil";
import { getCatalogo } from "@/lib/categoria";
import { CatalogoContent } from "@/components/catalogo/CatalogoContent";

export const metadata: Metadata = { title: "U.V.A. — Catálogo" };

export default async function CatalogoPage() {
  const perfilActual = await getPerfilActual();
  const categorias = await getCatalogo();

  return (
    <>
      <SiteHeader {...perfilActual} />
      <main>
        <CatalogoContent categorias={categorias} />
      </main>
      <Footer />
    </>
  );
}
