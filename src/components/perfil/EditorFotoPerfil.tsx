"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { subirFotoPerfil, eliminarFotoPerfil } from "@/actions/perfil/foto";
import { ACCEPT_FOTO_PERFIL, TAMANO_MAXIMO_FOTO_PERFIL, ERROR_TAMANO_FOTO_PERFIL } from "@/lib/avatar";
import { cn } from "@/lib/utils";

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "");
  return letras.join("") || "U";
}

/**
 * Avatar editable de "Mi perfil" (estudiante y admin, mismo componente):
 * clic sobre la foto abre el selector de archivo y sube de inmediato — sin
 * paso de confirmación aparte, a diferencia de la portada de curso
 * (InfoTab.tsx), porque acá el archivo es chico y el propio usuario es el
 * único afectado por un cambio equivocado. La vista previa local
 * (URL.createObjectURL) se pinta mientras sube para que el clic se sienta
 * inmediato, y se libera (revokeObjectURL) apenas hay una URL real o un
 * error para no filtrar memoria entre cambios.
 *
 * `router.refresh()` tras cada cambio: el layout (Header, Sidebar) lee la
 * foto en un Server Component aparte (getPerfilActual), así que sin esto
 * el header no se enteraría hasta la próxima navegación.
 */
export function EditorFotoPerfil({
  nombre,
  fotoUrl,
  size = "default",
}: {
  nombre: string;
  fotoUrl: string | null;
  /** "carne": foto del carné de "Mi perfil" (estudiante), más grande y con borde. */
  size?: "default" | "lg" | "carne";
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fotoMostrada = preview ?? fotoUrl;
  const carne = size === "carne";

  function limpiarPreview() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }

  function handleSeleccionar(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    event.target.value = "";
    if (!archivo) return;

    if (archivo.size > TAMANO_MAXIMO_FOTO_PERFIL) {
      setError(ERROR_TAMANO_FOTO_PERFIL);
      return;
    }

    setError(null);
    limpiarPreview();
    setPreview(URL.createObjectURL(archivo));

    startTransition(async () => {
      const formData = new FormData();
      formData.set("archivo", archivo);
      const resultado = await subirFotoPerfil(formData);
      limpiarPreview();
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  function handleQuitar() {
    setError(null);
    startTransition(async () => {
      const resultado = await eliminarFotoPerfil();
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={cn("flex flex-col gap-1.5", carne && "items-start gap-2")}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        aria-label="Cambiar foto de perfil"
        className={cn(
          "group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-uva-accent disabled:pointer-events-none disabled:opacity-70",
          carne && "self-start",
        )}
      >
        <Avatar
          className={cn(
            "bg-uva-divider",
            size === "lg" ? "size-[68px]" : "size-10",
            carne &&
              "size-[72px] border-2 border-uva-text bg-uva-surface-2 @min-[900px]:size-[88px]",
          )}
        >
          {fotoMostrada && <AvatarImage src={fotoMostrada} alt="" />}
          <AvatarFallback
            className={cn(
              "bg-uva-divider font-heading font-bold text-uva-text",
              size === "lg" ? "text-[22px]" : "text-sm",
              carne && "bg-uva-surface-2 text-uva-titulo-3 font-extrabold",
            )}
          >
            {iniciales(nombre)}
          </AvatarFallback>
        </Avatar>
        {/* Overlay de cámara: siempre visible en touch (no hay hover), y
            aparece con hover/focus en desktop para no ensuciar la foto de
            por sí. */}
        {carne ? (
          // En el carné la cámara va como círculo en la esquina,
          // siempre visible: dice que la foto se puede cambiar sin taparla.
          <span className="pointer-events-none absolute -right-1.5 -bottom-1.5 grid size-10 place-items-center rounded-full border-[3px] border-uva-surface bg-uva-text text-uva-bg group-hover:bg-uva-btn group-hover:text-uva-on-accent">
            <Camera className="size-[18px]" strokeWidth={1.8} aria-hidden />
          </span>
        ) : (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 pointer-coarse:opacity-100">
            <Camera className="size-[18px] text-white" strokeWidth={2} />
          </span>
        )}
      </button>

      {fotoUrl && !pending && (
        <button
          type="button"
          onClick={handleQuitar}
          className={cn(
            "cursor-pointer border-0 bg-transparent p-0 text-[11px] text-uva-muted-2 hover:text-uva-text",
            carne && "min-h-11 text-uva-detalle font-semibold text-uva-text-muted underline underline-offset-3",
          )}
        >
          Quitar foto
        </button>
      )}

      {error && (
        <p role="alert" className={cn("max-w-[160px] text-[11px] text-uva-error-text", carne && "text-uva-detalle")}>
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_FOTO_PERFIL}
        className="hidden"
        onChange={handleSeleccionar}
      />
    </div>
  );
}
