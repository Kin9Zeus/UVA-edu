"use client"

import { Toast } from "@base-ui/react/toast"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/* Avisos emergentes globales sobre Base UI Toast. A diferencia de
   `admin/Toast`, que sigue vivo en el panel hasta migrarlo:
   - se pausan con el cursor o el foco (WCAG 2.2.1) y se cierran a mano;
   - el contenedor es una región `aria-live`; los errores son `priority: "high"`
     (se anuncian de inmediato) y duran más;
   - F6 mueve el foco al contenedor para llegar a los avisos con teclado. */
const FRANJA: Record<string, string> = {
  success: "border-l-uva-valid",
  error: "border-l-uva-error",
  info: "border-l-uva-accent",
}

function ListaAvisos() {
  const { toasts } = Toast.useToastManager()
  return toasts.map((aviso) => (
    <Toast.Root
      key={aviso.id}
      toast={aviso}
      className={cn(
        "relative flex items-start gap-3 rounded-uva-md border border-uva-divider border-l-[3px] bg-uva-surface py-3 pr-2 pl-4 text-uva-text shadow-uva-flotante motion-safe:transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        FRANJA[aviso.type ?? "info"] ?? FRANJA.info
      )}
    >
      <div className="min-w-0 flex-1 py-1.5">
        <Toast.Title className="text-uva-detalle font-semibold" />
        <Toast.Description className="mt-0.5 text-uva-detalle text-uva-text-muted" />
      </div>
      <Toast.Close
        aria-label="Cerrar aviso"
        render={<Button variant="ghost" size="icon-sm" />}
      >
        <XIcon aria-hidden="true" />
      </Toast.Close>
    </Toast.Root>
  ))
}

/** Se monta una vez, en el layout raíz. */
function Toaster({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider timeout={5000} limit={3}>
      {children}
      <Toast.Viewport
        aria-label="Avisos"
        className="fixed right-4 bottom-4 left-4 z-[100] flex flex-col gap-2 sm:left-auto sm:w-96"
      >
        <ListaAvisos />
      </Toast.Viewport>
    </Toast.Provider>
  )
}

/** `const aviso = useAviso(); aviso.exito("Curso guardado")`. */
function useAviso() {
  const { add } = Toast.useToastManager()
  return {
    exito: (titulo: string, descripcion?: string) =>
      add({ type: "success", title: titulo, description: descripcion }),
    info: (titulo: string, descripcion?: string) =>
      add({ type: "info", title: titulo, description: descripcion }),
    /** Alta prioridad y 10 s: un error se lee más despacio que un "Guardado". */
    error: (titulo: string, descripcion?: string) =>
      add({
        type: "error",
        title: titulo,
        description: descripcion,
        priority: "high",
        timeout: 10000,
      }),
  }
}

export { Toaster, useAviso }
