"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useModuloDiferido } from "@/lib/useModuloDiferido";
import type { MenuCuentaPanel } from "@/components/dashboard/MenuCuentaPanel";

export type PropsMenuCuenta = {
  nombre: string;
  fotoUrl?: string | null;
  esAdmin?: boolean;
  /** El primer nombre junto al avatar, desde `sm`. */
  mostrarNombre?: boolean;
  /** En el panel, Comunidad sale en el menú solo en celular (en escritorio ya
   * está en el Sidebar). La clase no tiene Sidebar: va siempre. */
  comunidadSiempre?: boolean;
  /** Tema claro/oscuro en el menú, solo en celular: donde la cabecera no tiene
   * el botón sol/luna (clase y examen). */
  temaEnMenu?: boolean;
};

export const CLASE_BOTON_CUENTA =
  "-my-0.5 flex min-h-11 cursor-pointer items-center gap-2 rounded-uva-md border-0 bg-transparent py-1 pr-1 pl-1 text-sm text-uva-text outline-hidden hover:bg-uva-hover focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-uva-accent";

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "");
  return letras.join("") || "U";
}

/** Avatar (foto o iniciales), nombre y flecha: igual antes y después de cargar el menú. */
export function ContenidoBotonCuenta({
  nombre,
  fotoUrl,
  mostrarNombre,
}: {
  nombre: string;
  fotoUrl: string | null;
  mostrarNombre: boolean;
}) {
  const [sinFoto, setSinFoto] = useState(false);
  const primerNombre = nombre.trim().split(/\s+/)[0] ?? nombre;
  return (
    <>
      <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border-[1.5px] border-uva-line-strong bg-uva-surface-2 text-uva-detalle font-extrabold text-uva-text">
        {iniciales(nombre)}
        {fotoUrl && !sinFoto && (
          // Foto de perfil de Supabase Storage: tamaño fijo y pequeño, sin next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fotoUrl} alt="" onError={() => setSinFoto(true)} className="absolute inset-0 size-full object-cover" />
        )}
      </span>
      {mostrarNombre && (
        <span className="hidden max-w-[120px] truncate text-uva-cuerpo font-bold sm:inline">{primerNombre}</span>
      )}
      <ChevronDown className="size-4 text-uva-text-faint max-[18rem]:hidden" aria-hidden="true" />
    </>
  );
}

let panel: Promise<typeof MenuCuentaPanel> | null = null;
function cargarPanel() {
  panel ??= import("@/components/dashboard/MenuCuentaPanel")
    .then((m) => m.MenuCuentaPanel)
    .catch((error) => {
      panel = null;
      throw error;
    });
  return panel;
}

/**
 * Avatar con el menú de la cuenta (perfil, suscripción, certificados, notas,
 * tema, cerrar sesión). Lo comparten el encabezado del panel (`Header`), la
 * clase (`LeccionMaqueta`) y el examen, para que el menú diga lo mismo.
 *
 * El botón se pinta con la página; el menú (base-ui Menu, con floating-ui)
 * se carga con la intención de usarlo (ver useModuloDiferido): en la clase
 * era casi la cuarta parte del JavaScript inicial. Si se toca antes de que
 * llegue, se abre al llegar.
 */
export function MenuCuenta(props: PropsMenuCuenta) {
  const { nombre, fotoUrl = null, mostrarNombre = true } = props;
  const { modulo: Panel, pedir } = useModuloDiferido(cargarPanel);
  const [tocado, setTocado] = useState(false);
  // Si el botón simple tenía el foco (teclado) al llegar el menú, el botón
  // del menú lo recibe: si no, el foco se perdería al reemplazarlo.
  const [enfocado, setEnfocado] = useState(false);
  const primerNombre = nombre.trim().split(/\s+/)[0] ?? nombre;

  if (Panel) {
    return (
      <Panel
        {...props}
        abiertoAlInicio={tocado}
        enfocarAlMontar={enfocado}
      />
    );
  }
  return (
    <button
      type="button"
      aria-label={`Menú de ${primerNombre}`}
      aria-haspopup="menu"
      aria-expanded={false}
      onPointerEnter={pedir}
      onPointerDown={pedir}
      onFocus={() => {
        setEnfocado(true);
        pedir();
      }}
      onBlur={() => setEnfocado(false)}
      onClick={() => {
        pedir();
        setTocado(true);
      }}
      className={CLASE_BOTON_CUENTA}
    >
      <ContenidoBotonCuenta nombre={nombre} fotoUrl={fotoUrl} mostrarNombre={mostrarNombre} />
    </button>
  );
}
