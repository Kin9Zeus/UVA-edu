import type { Metadata } from "next";
import { Header } from "@/components/home/Header";
import { Hero, TITULO_PORTADA } from "@/components/home/Hero";
import { DESCRIPCION_META_PORTADA } from "@/lib/seo/descripciones";
import { CategoriasPortada } from "@/components/home/CategoriasPortada";
import { getCategoriasActivas } from "@/lib/categoria";
import { CursoDestacado } from "@/components/home/CursoDestacado";
import { ProductBand } from "@/components/home/ProductBand";
import { Pricing } from "@/components/home/Pricing";
import { AccesoInvitacion } from "@/components/home/AccesoInvitacion";
import { Footer } from "@/components/home/Footer";
import { WhatsAppButton } from "@/components/home/WhatsAppButton";
import { connection } from "next/server";
import { PRECIOS_HABILITADOS } from "@/lib/features";
import { JsonLd } from "@/components/seo/JsonLd";
import { metadataPublica } from "@/lib/seo/metadata";
import { organizacionCompleta } from "@/lib/seo/organizacion";

// P2-6 (AUDIT-2026-09-15.md): la home era la única página del sitio que no
// exportaba `metadata` en absoluto — heredaba del layout raíz el título
// genérico y la descripción "Plataforma de cursos UVA". El título y la
// descripción salen del propio Hero: lo que promete la página y lo que
// promete el resultado de búsqueda tienen que ser lo mismo. La descripción
// además dice qué es UVA (SEO fase 14, ver lib/seo/descripciones.ts).
export const metadata: Metadata = metadataPublica({
  titulo: TITULO_PORTADA,
  descripcion: DESCRIPCION_META_PORTADA,
  ruta: "/",
});

export default async function Home() {
  // P2-2 (AUDIT-2026-09-08): fuerza el render dinámico. Esta página era
  // dinámica "de rebote", porque `CursoDestacado` leía con el cliente
  // cookie-bound; al pasar esa consulta al cliente público (P2-4,
  // AUDIT-2026-09-15) `next build` volvería a prerenderizarla, y una página
  // prerenderizada se genera cuando todavía no existe la petición — así que
  // sus scripts salen sin el nonce que Next inyecta desde la CSP. Con
  // `'strict-dynamic'` un script externo sin nonce queda bloqueado
  // (strict-dynamic ignora 'self'), o sea que esta pantalla se rompería el
  // día que la política deje de ser Report-Only. El coste es perder la
  // optimización estática; el beneficio es que la CSP puede forzarse en TODO
  // el sitio y no en el 90%.
  await connection();

  // "Tengo un código" va siempre al formulario de canje: con sesión abre la
  // pantalla, y sin sesión el proxy (lib/supabase/proxy.ts) manda a /login
  // con `?redirect=` — la misma pantalla ofrece entrar o crear cuenta y de
  // ahí vuelve al canje. Así la portada no hace una consulta de sesión por
  // visita.
  const hrefCodigo = "/canjear";

  // Una sola lectura (cacheada) para la maqueta del hero y la lista de
  // categorías; el pie la vuelve a pedir y le llega de la misma caché.
  const categorias = await getCategoriasActivas();

  return (
    <>
      {/* La `Organization` completa se publica UNA vez, aquí, y cada ficha
          de curso la referencia por `@id` desde su `provider` (P2-5). Es lo
          que le dice a Google que son la misma entidad y no dos con nombre
          parecido. */}
      <JsonLd data={organizacionCompleta()} />
      <Header />
      <main id="contenido" tabIndex={-1}>
        <Hero hrefCodigo={hrefCodigo} categorias={categorias} />
        <CategoriasPortada categorias={categorias} />
        <ProductBand />
        <CursoDestacado />
        {/* El bloque "Más de 400 empresas…" (FinalCta) se retiró de la
            portada: no hay oferta para empresas y su cifra no está
            respaldada. Lo que la portada anuncia vive en content/marketing.ts. */}
        {PRECIOS_HABILITADOS ? (
          <Pricing />
        ) : (
          <AccesoInvitacion hrefCodigo={hrefCodigo} />
        )}
      </main>
      <Footer conBotonWhatsApp />
      <WhatsAppButton />
    </>
  );
}
