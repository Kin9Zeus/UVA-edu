"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { LogOut, Menu, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/actions/auth/logout";

export type ItemBarra = { href: string; label: string; icon: LucideIcon };

// Ítems que reparten el ancho (flex-1). Activo en magenta suave con
// `accent-text` (no `accent-ink`: en oscuro queda bajo AA a 12 px).
const ITEM =
  "grid min-h-[50px] min-w-0 flex-1 content-center justify-items-center gap-0.5 rounded-full py-1 text-uva-text-muted no-underline transition-colors hover:no-underline outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-uva-accent max-[359px]:[&[aria-current]]:flex-[2]";
const ITEM_ACTIVO = "bg-uva-accent-soft text-uva-accent-text";
// «Certificados» es el rótulo más largo (~66 px a 11 px): bajo 400 px baja a
// 11 px y bajo 360 px solo el ítem activo muestra el suyo (los demás lo
// conservan para lectores de pantalla).
const ROTULO = "text-xs leading-tight max-[399px]:text-[11px]";

/**
 * Barra inferior del celular (< md), compartida por el panel del estudiante y
 * el admin: 4 accesos fijos y un botón «Más» que abre el resto desde abajo.
 * Con cinco ítems con etiqueta no cabe el menú entero; lo de uso diario queda
 * a un toque (prueba de usabilidad USA-01: Certificados no se encontraba).
 */
export function BarraInferior({
  etiqueta,
  inicio,
  principales,
  secundarios,
  tituloMas,
}: {
  etiqueta: string;
  /** Ruta que solo se marca activa cuando coincide exacta. */
  inicio: string;
  principales: ItemBarra[];
  secundarios: ItemBarra[];
  tituloMas: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === inicio ? pathname === inicio : pathname.startsWith(href));
  const enSecundario = secundarios.some((item) => isActive(item.href));

  return (
    <nav
      aria-label={etiqueta}
      className="fixed inset-x-0 bottom-0 z-40 px-[max(0.5rem,env(safe-area-inset-left))] pb-[calc(env(safe-area-inset-bottom)+14px)] md:hidden"
    >
      {/* Ancho máximo en rem, como los rótulos: en px no crecía con la letra
          agrandada y a 768 px los rótulos se montaban. */}
      <div className="mx-auto flex max-w-[27.5rem] items-center rounded-full border border-uva-line-strong bg-uva-surface p-1">
        {principales.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn(ITEM, active && ITEM_ACTIVO)}>
              <Icon className="size-5" strokeWidth={1.9} aria-hidden />
              <span className={cn(ROTULO, active ? "font-extrabold" : "font-semibold max-[359px]:sr-only")}>{label}</span>
            </Link>
          );
        })}

        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Trigger
            aria-label="Más opciones"
            aria-current={enSecundario ? "true" : undefined}
            className={cn(ITEM, enSecundario && ITEM_ACTIVO)}
          >
            <Menu className="size-5" strokeWidth={1.9} aria-hidden />
            <span className={cn(ROTULO, enSecundario ? "font-extrabold" : "font-semibold max-[359px]:sr-only")}>Más</span>
          </DialogPrimitive.Trigger>

          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-uva-overlay/60 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
            <DialogPrimitive.Popup
              className={cn(
                "fixed inset-x-0 bottom-0 z-50 rounded-t-uva-lg border-t border-uva-divider bg-uva-bg p-4 outline-none",
                "pb-[max(1rem,env(safe-area-inset-bottom))]",
                "data-open:animate-in data-open:slide-in-from-bottom-4 data-open:fade-in-0",
                "data-closed:animate-out data-closed:slide-out-to-bottom-4 data-closed:fade-out-0",
              )}
            >
              <DialogPrimitive.Title className="sr-only">{tituloMas}</DialogPrimitive.Title>
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-uva-divider" />

              <nav className="flex flex-col" aria-label="Más secciones">
                {secundarios.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center gap-3 border-b border-uva-divider text-uva-cuerpo text-uva-text no-underline last:border-b-0 hover:no-underline",
                      isActive(item.href) && "font-bold text-uva-accent-ink",
                    )}
                  >
                    <item.icon className="size-[18px] shrink-0" strokeWidth={1.9} aria-hidden />
                    {item.label}
                  </Link>
                ))}
              </nav>

              <button
                type="button"
                onClick={() => logout()}
                className="mt-3 flex min-h-12 w-full items-center gap-3 text-uva-cuerpo text-uva-badge-danger-fg"
              >
                <LogOut className="size-[18px] shrink-0" strokeWidth={1.9} aria-hidden />
                Cerrar sesión
              </button>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
    </nav>
  );
}
