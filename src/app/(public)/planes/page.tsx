import type { Metadata } from "next";
import { Header } from "@/components/home/Header";
import { Footer } from "@/components/home/Footer";
import { Pricing } from "@/components/home/Pricing";

export const metadata: Metadata = {
  title: "U.V.A. — Un plan, todo el gremio",
};

export default function PlanesPage() {
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
