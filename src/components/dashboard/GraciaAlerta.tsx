"use client";

import { Bell } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { GraciaCard } from "@/components/dashboard/GraciaCard";

/**
 * Versión mobile del aviso de período de gracia: en vez de un banner que
 * ocupa espacio permanente, un ícono con un punto de notificación que abre
 * el mismo contenido (GraciaCard) que la tarjeta fija del Sidebar (desktop).
 */
export function GraciaAlerta({ diasGracia }: { diasGracia: number | null }) {
  if (diasGracia === null) return null;

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Aviso: quedan ${diasGracia} ${diasGracia === 1 ? "día" : "días"} de tu período de gracia`}
        className="relative flex size-9 shrink-0 items-center justify-center rounded-uva-sm text-uva-text hover:bg-[#1C1C20] md:hidden"
      >
        <Bell className="size-5" strokeWidth={1.9} />
        <span className="absolute top-2 right-2 size-1.5 rounded-full bg-uva-accent-2 ring-2 ring-uva-bg" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="isolate z-50 outline-none" sideOffset={8} align="end">
          <Popover.Popup className="w-[260px] shadow-lg outline-none">
            <GraciaCard diasGracia={diasGracia} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
