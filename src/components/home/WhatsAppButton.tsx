import { WhatsappIcon } from "@/components/home/icons";

const WHATSAPP_URL =
  "https://api.whatsapp.com/send/?phone=%2B573234260022&text&type=phone_number&app_absent=0";

export function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-float"
      aria-label="Chatea con nosotros por WhatsApp"
    >
      <WhatsappIcon size={28} />
    </a>
  );
}
