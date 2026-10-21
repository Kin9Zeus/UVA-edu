import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { getPerfilActual } from "@/lib/perfil";

/**
 * Encabezado y pie del catálogo público en el layout, no en cada página: así
 * `loading.tsx` muestra el esqueleto de la lista con el encabezado ya puesto,
 * en vez de una pantalla sin nada mientras llega el catálogo.
 */
export default async function CatalogoLayout({ children }: LayoutProps<"/catalogo">) {
  const perfilActual = await getPerfilActual();
  return (
    <>
      <SiteHeader {...perfilActual} />
      {children}
      <Footer />
    </>
  );
}
