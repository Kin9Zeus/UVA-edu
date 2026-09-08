import type { Metadata } from "next";
import { Header } from "@/components/home/Header";
import { Footer } from "@/components/home/Footer";
import { Pricing } from "@/components/home/Pricing";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "U.V.A. — Un plan, todo el gremio",
};

export default async function PlanesPage() {
  // P2-2 (AUDIT-2026-09-08): fuerza el render dinámico. Esta era una de las
  // 4 rutas que `next build` prerenderizaba, y una página prerenderizada se
  // genera cuando todavía no existe la petición — así que sus scripts salen
  // sin el nonce que Next inyecta desde la CSP. Con `'strict-dynamic'` un
  // script externo sin nonce queda bloqueado (strict-dynamic ignora 'self'),
  // o sea que esta pantalla se rompería el día que la política deje de ser
  // Report-Only. El coste es perder la optimización estática de una página
  // de bajo tráfico; el beneficio es que la CSP puede forzarse en TODO el
  // sitio y no en el 90%.
  await connection();
  return (
    <>
      <Header />
      <main className="pt-[clamp(24px,4vw,44px)]">
        <Pricing
          titulo="Un plan, todo el gremio"
          subtitulo="Acceso a todo el catálogo, las plantillas descargables y los certificados. Cambia o cancela cuando quieras."
        />
      </main>
      <Footer />
    </>
  );
}
