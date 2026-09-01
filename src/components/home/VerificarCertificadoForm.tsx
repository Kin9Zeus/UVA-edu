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
    <form onSubmit={verificar} className="flex flex-col gap-2.5">
      <input
        type="text"
        value={codigo}
        onChange={(event) => setCodigo(event.target.value)}
        placeholder="Ej. K7M2Q-XP4TB"
        aria-label="Código de verificación del certificado"
        className="w-full rounded-uva-md border border-uva-divider bg-transparent px-3 py-2 font-mono text-[12.5px] text-uva-text placeholder:text-uva-text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
      />
      <button
        type="submit"
        className="w-fit rounded-uva-md border border-uva-divider bg-transparent px-3 py-1.5 text-[12.5px] text-uva-text-muted transition-colors hover:border-uva-accent hover:text-uva-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
      >
        Verificar certificado
      </button>
    </form>
  );
}
