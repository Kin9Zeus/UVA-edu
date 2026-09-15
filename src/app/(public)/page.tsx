import { Header } from "@/components/home/Header";
import { Hero } from "@/components/home/Hero";
import { CursoDestacado } from "@/components/home/CursoDestacado";
import { ProductBand } from "@/components/home/ProductBand";
import { Pricing } from "@/components/home/Pricing";
import { FinalCta } from "@/components/home/FinalCta";
import { Footer } from "@/components/home/Footer";
import { WhatsAppButton } from "@/components/home/WhatsAppButton";
import { connection } from "next/server";

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
  return (
    <>
      <Header />
      <main>
        <Hero />
        <CursoDestacado />
        <ProductBand />
        <FinalCta />
        <Pricing />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
