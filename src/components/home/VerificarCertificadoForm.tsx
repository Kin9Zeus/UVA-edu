"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import {
  extraerCodigoCertificado,
  formatearCodigoCertificadoEscribiendo,
  normalizarCodigoCertificado,
} from "@/lib/certificados/codigo";
import { cn } from "@/lib/utils";

type Props =
  | { variante?: "compacto" }
  | {
      /** La página /verificar-certificado: campo con etiqueta visible y botón a lo ancho. */
      variante: "pagina";
      /** El código que no se encontró, ya escrito para corregirlo. */
      valorInicial?: string;
      /** Marca el campo como inválido (el código buscado no existe). */
      invalido?: boolean;
      textoBoton: string;
      /** id de la caja "Dónde encontrar el código", que describe el campo. */
      ayudaId: string;
    };

/**
 * Formulario para verificar un código de certificado. Va en el pie del sitio,
 * en Soporte y en la propia página de verificación.
 *
 * Es un GET real a /verificar-certificado?codigo=…, que redirige a
 * /verificar-certificado/[codigo]: sin JavaScript también funciona. Con
 * JavaScript se navega directo, con el código ya normalizado.
 */
export function VerificarCertificadoForm(props: Props) {
  const router = useRouter();
  const pagina = props.variante === "pagina" ? props : null;
  const [codigo, setCodigo] = useState(pagina?.valorInicial ?? "");

  function escribir(event: React.ChangeEvent<HTMLInputElement>) {
    const nuevo = event.target.value;
    setCodigo(formatearCodigoCertificadoEscribiendo(nuevo, nuevo.length < codigo.length));
  }

  // Lo pegado no pasa por el formateador de teclear: el enlace del QR o un
  // código con espacios saldrían destrozados (ver extraerCodigoCertificado).
  function pegar(event: React.ClipboardEvent<HTMLInputElement>) {
    const { value, selectionStart, selectionEnd } = event.currentTarget;
    const pegado = event.clipboardData.getData("text");
    event.preventDefault();
    setCodigo(
      extraerCodigoCertificado(
        value.slice(0, selectionStart ?? value.length) + pegado + value.slice(selectionEnd ?? value.length),
      ),
    );
  }

  function verificar(event: React.FormEvent) {
    event.preventDefault();
    const limpio = normalizarCodigoCertificado(codigo);
    if (!limpio) return;
    router.push(`/verificar-certificado/${encodeURIComponent(limpio)}`);
  }

  if (pagina) {
    return (
      <form action="/verificar-certificado" method="get" onSubmit={verificar} className="grid gap-5.5">
        <div>
          <label htmlFor="codigo-certificado" className="mb-1.5 block text-uva-cuerpo font-semibold text-uva-text">
            Código del certificado
          </label>
          <input
            id="codigo-certificado"
            name="codigo"
            type="text"
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={codigo}
            onChange={escribir}
            onPaste={pegar}
            placeholder="XXXXX-XXXXX"
            aria-invalid={pagina.invalido || undefined}
            aria-describedby={pagina.ayudaId}
            className="h-14 w-full min-w-0 rounded-uva-md border-[1.5px] border-uva-line-strong bg-uva-bg px-4 font-codigo text-base tracking-[0.08em] text-uva-text uppercase placeholder:text-uva-text-faint aria-invalid:border-uva-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
          />
        </div>
        <button
          type="submit"
          className={cn(buttonVariants({ variant: "uva-primary", size: "uva" }), "h-auto min-h-13 text-uva-cuerpo whitespace-normal")}
        >
          {pagina.textoBoton}
        </button>
      </form>
    );
  }

  return (
    <form action="/verificar-certificado" method="get" onSubmit={verificar} className="flex flex-wrap gap-2">
      <input
        id="verificar-certificado"
        name="codigo"
        type="text"
        required
        autoComplete="off"
        spellCheck={false}
        value={codigo}
        onChange={escribir}
        onPaste={pegar}
        autoCapitalize="characters"
        placeholder="Ej. K7M2Q-XP4TB"
        aria-label="Código de verificación del certificado"
        className="h-12 min-w-0 flex-[1_1_12rem] rounded-uva-md border-[1.5px] border-uva-line-strong bg-uva-surface px-3 font-codigo text-base text-uva-text placeholder:text-uva-text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
      />
      <button
        type="submit"
        className="min-h-12 max-w-full shrink-0 rounded-uva-md border-[1.5px] border-uva-line-strong bg-transparent px-4 text-uva-cuerpo font-semibold text-uva-text hover:border-uva-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
      >
        Verificar certificado
      </button>
    </form>
  );
}
