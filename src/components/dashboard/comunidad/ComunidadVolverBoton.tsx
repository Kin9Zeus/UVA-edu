"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * "Volver" desde el detalle de un post. Usa el historial del navegador en
 * vez de un `<Link href="/dashboard/comunidad">` fijo: así vuelve
 * exactamente a la sección por la que se entró (Todas, una categoría, o
 * Mis publicaciones), no siempre al feed raíz. Si no hay historial propio
 * de la app (se abrió el post directo, en pestaña nueva), cae a la
 * Comunidad general en vez de dejar al usuario varado o sacarlo del sitio.
 */
export function ComunidadVolverBoton() {
  const router = useRouter();

  function volver() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard/comunidad");
    }
  }

  return (
    <button
      type="button"
      onClick={volver}
      className="inline-flex items-center gap-1.5 text-sm text-uva-text-muted hover:text-uva-text"
    >
      <ArrowLeft className="size-4" strokeWidth={2} />
      Volver
    </button>
  );
}
