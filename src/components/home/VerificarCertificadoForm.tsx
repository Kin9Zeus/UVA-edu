"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "¿Ingresé en el Home la opción de verificar un código?" — sí: hasta ahora
 * la única forma de llegar a /verificar-certificado/[codigo] era el QR o
 * pegar la URL completa. Certificado.md pide una URL "corta y legible"
 * precisamente para que alguien pueda teclearla, así que este formulario le
 * da un punto de entrada visible en el sitio público, sin sesión.
 */
export function VerificarCertificadoForm() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");

  function verificar(event: React.FormEvent) {
    event.preventDefault();
    const limpio = codigo.trim();
    if (!limpio) return;
    router.push(`/verificar-certificado/${encodeURIComponent(limpio)}`);
  }

  return (
    <form onSubmit={verificar} className="flex flex-wrap gap-2">
      <input
        id="verificar-certificado"
        type="text"
        value={codigo}
        onChange={(event) => setCodigo(event.target.value)}
        placeholder="Ej. K7M2Q-XP4TB"
        aria-label="Código de verificación del certificado"
        className="h-12 min-w-0 flex-[1_1_12rem] rounded-uva-md border-[1.5px] border-uva-line-strong bg-uva-surface px-3 font-codigo text-base text-uva-text placeholder:text-uva-text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
      />
      <button
        type="submit"
        className="h-12 shrink-0 rounded-uva-md border-[1.5px] border-uva-line-strong bg-transparent px-4 text-uva-cuerpo font-semibold text-uva-text hover:border-uva-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
      >
        Verificar certificado
      </button>
    </form>
  );
}
