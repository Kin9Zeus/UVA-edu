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
      // Tamaño y distancia en px, no en rem: con la letra del sistema agrandada
      // crecía hasta tapar "Tengo un código" en la portada. Es área táctil, no texto.
      className="fixed right-[24px] bottom-[24px] z-40 flex size-[56px] items-center justify-center rounded-full bg-uva-whatsapp text-uva-on-bright no-underline shadow-uva-flotante transition-[filter] duration-[160ms] [transition-timing-function:ease] hover:brightness-[1.08] hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
    >
      <WhatsappIcon size={28} />
    </a>
  );
}
