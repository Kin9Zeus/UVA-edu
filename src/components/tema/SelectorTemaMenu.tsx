"use client";

import { Monitor } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useTema } from "@/components/tema/TemaProvider";
import { TEXTO_SISTEMA, textos } from "@/components/tema/SelectorTema";

/** Alterna claro/oscuro desde el menú de usuario. Para las pantallas cuya
 *  cabecera oculta el botón sol/luna en celular (clase y examen). */
export function SelectorTemaMenuItem({ className }: { className?: string }) {
  const { tema, alternarTema } = useTema();
  const { corto, Icono } = textos(tema);

  return (
    <DropdownMenuItem onClick={alternarTema} className={className}>
      <Icono className="size-4" aria-hidden="true" />
      {corto}
    </DropdownMenuItem>
  );
}

/** Igual que SelectorTemaSistemaFila, como opción del menú de usuario de los
 *  paneles. Cierra el menú: el botón sol/luna sigue a la vista en el header. */
export function SelectorTemaSistemaMenuItem({ className }: { className?: string }) {
  const { preferencia, usarTemaDelSistema } = useTema();
  if (preferencia === "sistema") return null;

  return (
    <DropdownMenuItem onClick={usarTemaDelSistema} className={className}>
      <Monitor className="size-4" aria-hidden="true" />
      {TEXTO_SISTEMA}
    </DropdownMenuItem>
  );
}
