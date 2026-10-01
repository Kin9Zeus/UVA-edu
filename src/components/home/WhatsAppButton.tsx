import { WhatsappIcon } from "@/components/home/icons";

import { urlWhatsapp } from "@/lib/contacto";

const WHATSAPP_URL = urlWhatsapp();

export function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chatea con nosotros por WhatsApp"
      className="fixed right-6 bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-uva-whatsapp text-[#09090b] no-underline shadow-[0_18px_44px_rgba(0,0,0,0.55)] transition-[filter] duration-[160ms] [transition-timing-function:ease] hover:brightness-[1.08] hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
    >
      <WhatsappIcon size={28} />
    </a>
  );
}
