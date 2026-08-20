"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";
type ToastEntry = { id: number; message: string; variant: ToastVariant };

const ToastContext = createContext<((message: string, variant?: ToastVariant) => void) | null>(null);

/* El mockup define un único toast, con la franja magenta a la izquierda y sin
   icono. Los errores se distinguen tiñendo esa franja de rojo, que es la
   señal más visible sin salirse del diseño. */
const FRANJA: Record<ToastVariant, string> = {
  success: "border-l-uva-accent",
  info: "border-l-uva-accent",
  error: "border-l-uva-error",
};

export function AdminToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, variant }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2500);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed right-6 bottom-6 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "rounded-uva-md border border-uva-divider border-l-[3px] bg-uva-surface px-[18px] py-[13px] text-[13.5px] text-uva-text shadow-[0_12px_30px_rgba(0,0,0,.4)] animate-in fade-in slide-in-from-bottom-2",
              FRANJA[toast.variant],
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useAdminToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useAdminToast debe usarse dentro de <AdminToastProvider>");
  }
  return context;
}
