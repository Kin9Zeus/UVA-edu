"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminSearch } from "@/components/admin/SearchContext";
import { cn } from "@/lib/utils";

/**
 * Lupa + overlay de búsqueda a pantalla completa para el header del panel
 * admin en mobile — el input inline (ver Header.tsx) no cabe ahí junto al
 * logo y el título. A diferencia de BuscadorMovilDialog de catálogo, esta
 * no navega: filtra en vivo sobre `useAdminSearch`, la misma fuente que ya
 * consume el input de escritorio.
 */
export function BuscadorMovilDialog({
  placeholder,
  className,
}: {
  placeholder: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { query, setQuery } = useAdminSearch();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        render={<Button variant="uva-icon" size="icon" className={className} aria-label={placeholder} />}
      >
        <Search className="size-[18px]" strokeWidth={2.2} />
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed inset-x-0 top-0 z-50 border-b border-uva-divider bg-uva-bg p-4 outline-none",
            "pt-[max(1rem,env(safe-area-inset-top))]",
            "data-open:animate-in data-open:slide-in-from-top-4 data-open:fade-in-0",
            "data-closed:animate-out data-closed:slide-out-to-top-4 data-closed:fade-out-0",
          )}
        >
          <DialogPrimitive.Title className="sr-only">{placeholder}</DialogPrimitive.Title>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2 text-uva-muted-2"
                strokeWidth={2.4}
              />
              <Input
                type="search"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                className="pl-9"
              />
            </div>
            <DialogPrimitive.Close render={<Button variant="uva-icon" size="icon" aria-label="Cerrar búsqueda" />}>
              <X className="size-[18px]" strokeWidth={2.2} />
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
