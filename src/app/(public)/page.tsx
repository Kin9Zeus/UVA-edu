import { Header } from "@/components/home/Header";
import { Hero } from "@/components/home/Hero";
import { ProductBand } from "@/components/home/ProductBand";
import { Pricing } from "@/components/home/Pricing";
import { FinalCta } from "@/components/home/FinalCta";
import { Footer } from "@/components/home/Footer";
import { WhatsAppButton } from "@/components/home/WhatsAppButton";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <ProductBand />
        <FinalCta />
        <Pricing />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
