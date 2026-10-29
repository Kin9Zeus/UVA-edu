"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";
type ToastEntry = { id: number; message: string; variant: ToastVariant };

const ToastContext = createContext<((message: string, variant?: ToastVariant) => void) | null>(null);

/** Tiempo que se ve un aviso de éxito. Los errores no se van solos. */
const DURACION_EXITO_MS = 4000;

/* El mockup define un único toast, con la franja magenta a la izquierda y sin
   icono. Los errores se distinguen tiñendo esa franja de rojo, que es la
   señal más visible sin salirse del diseño. */
const FRANJA: Record<ToastVariant, string> = {
  success: "border-l-uva-accent",
  info: "border-l-uva-accent",
  error: "border-l-uva-error",
};

/**
 * Avisos del panel.
 *
 * - Éxito: se va a los 4 s y el nuevo reemplaza al anterior (subir una
 *   lección cinco veces no apila cinco avisos).
 * - Error: se queda hasta que se cierra (WCAG 2.2.1: nadie alcanza a leer un
 *   error de dos líneas en 2,5 s) y se anuncia con `role="alert"`.
 *
 * Las dos regiones vivas existen desde el principio y vacías: un lector de
 * pantalla no anuncia de forma fiable una región que aparece con el texto ya
 * dentro.
 */
export function AdminToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  const cerrar = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = nextId.current++;
      setToasts((current) =>
        variant === "error"
          ? [...current.filter((toast) => toast.message !== message), { id, message, variant }]
          : [...current.filter((toast) => toast.variant === "error"), { id, message, variant }],
      );
      if (variant !== "error") setTimeout(() => cerrar(id), DURACION_EXITO_MS);
    },
    [cerrar],
  );

  const errores = toasts.filter((toast) => toast.variant === "error");
  const avisos = toasts.filter((toast) => toast.variant !== "error");

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {/* En celular va encima de la barra de navegación inferior (88 px más
          el área segura), sin taparla; desde md esa barra no existe. */}
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-[100] flex flex-col items-stretch gap-2 md:inset-x-auto md:right-6 md:bottom-6 md:w-[min(420px,calc(100vw-3rem))]">
        <div role="alert" className="flex flex-col gap-2">
          {errores.map((toast) => (
            <Aviso key={toast.id} toast={toast} onCerrar={() => cerrar(toast.id)} />
          ))}
        </div>
        <div role="status" className="flex flex-col gap-2">
          {avisos.map((toast) => (
            <Aviso key={toast.id} toast={toast} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function Aviso({ toast, onCerrar }: { toast: ToastEntry; onCerrar?: () => void }) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-3 rounded-uva-md border border-uva-divider border-l-[3px] bg-uva-surface py-2 pr-2 pl-4 text-uva-detalle text-uva-text shadow-uva-flotante animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none",
        !onCerrar && "py-3 pr-4",
        FRANJA[toast.variant],
      )}
    >
      <span className="min-w-0 flex-1">{toast.message}</span>
      {onCerrar && (
        <Button type="button" variant="ghost" size="sm" onClick={onCerrar} className="shrink-0">
          <X aria-hidden="true" />
          Cerrar
        </Button>
      )}
    </div>
  );
}

export function useAdminToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useAdminToast debe usarse dentro de <AdminToastProvider>");
  }
  return context;
}
