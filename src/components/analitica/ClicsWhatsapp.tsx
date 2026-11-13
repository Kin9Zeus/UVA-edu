"use client";

import { useEffect } from "react";
import { registrarEvento } from "@/lib/analitica";

/**
 * Registra `clic_whatsapp` con un solo oyente para todo el sitio: los enlaces
 * a WhatsApp están en el pie, el botón flotante, soporte y otros sitios, y
 * así ninguno se queda sin medir ni hay que tocar cada uno.
 */
export function ClicsWhatsapp() {
  useEffect(() => {
    function alHacerClic(evento: MouseEvent) {
      const enlace = (evento.target as Element | null)?.closest?.("a[href]");
      if (!(enlace instanceof HTMLAnchorElement)) return;
      if (!/(^|\.)whatsapp\.com$|^wa\.me$/.test(enlace.hostname)) return;
      registrarEvento("clic_whatsapp", { pagina: location.pathname });
    }
    document.addEventListener("click", alHacerClic);
    return () => document.removeEventListener("click", alHacerClic);
  }, []);
  return null;
}
